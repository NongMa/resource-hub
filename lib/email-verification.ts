import { createHmac, hkdfSync, randomInt } from 'crypto'
import type { Prisma, PrismaClient } from '@prisma/client'

export type EmailCodePurpose = 'register' | 'reset'

export type EmailCodeStatus = 'ok' | 'missing' | 'invalid' | 'expired' | 'used' | 'not_found'

export const EMAIL_CODE_TTL_SECONDS = 600
export const EMAIL_CODE_RESEND_SECONDS = 60

const TTL_MS = EMAIL_CODE_TTL_SECONDS * 1000
const RESEND_MS = EMAIL_CODE_RESEND_SECONDS * 1000
const HOUR_MS = 60 * 60 * 1000
const EMAIL_HOURLY_MAX = 5
const IP_HOURLY_MAX = 10
const CLEANUP_KEEP_MS = 24 * HOUR_MS

type DbClient = PrismaClient | Prisma.TransactionClient

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is not configured')
  return secret
}

function derivedKey(info: string): Buffer {
  return Buffer.from(
    hkdfSync('sha256', getSecret(), 'resource-hub-email-code-salt', info, 32)
  )
}

function hmac(info: string, value: string): string {
  return createHmac('sha256', derivedKey(info)).update(value).digest('hex')
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false
  const value = email.trim()
  return value.length <= 254 && EMAIL_PATTERN.test(value)
}

function hashEmail(email: string): string {
  return hmac('resource-hub-email-key', normalizeEmail(email))
}

function hashIp(ip: string): string {
  return hmac('resource-hub-email-key', `ip:${ip}`)
}

/** 验证码摘要包含场景，确保注册签发与重置签发互不可用 */
function hashCode(purpose: EmailCodePurpose, code: string): string {
  return hmac('resource-hub-email-code-key', `${purpose}:${code.trim()}`)
}

export type IssueEmailCodeResult =
  | { status: 'ok'; code: string; recordId: string }
  | { status: 'cooldown' | 'rate_limited'; retryAfter: number }

/**
 * 生成并落库验证码；同时执行重发冷却与发送次数上限检查。
 */
export async function issueEmailCode(
  db: PrismaClient,
  email: string,
  purpose: EmailCodePurpose,
  ip?: string
): Promise<IssueEmailCodeResult> {
  const emailHash = hashEmail(email)
  const now = Date.now()

  const latest = await db.emailVerificationCode.findFirst({
    where: { emailHash, purpose },
    orderBy: { createdAt: 'desc' },
  })

  if (latest) {
    const waitMs = latest.createdAt.getTime() + RESEND_MS - now
    if (waitMs > 0) {
      return { status: 'cooldown', retryAfter: Math.ceil(waitMs / 1000) }
    }
  }

  const hourAgo = new Date(now - HOUR_MS)
  const emailCount = await db.emailVerificationCode.count({
    where: { emailHash, purpose, createdAt: { gte: hourAgo } },
  })
  if (emailCount >= EMAIL_HOURLY_MAX) {
    return { status: 'rate_limited', retryAfter: HOUR_MS / 1000 }
  }

  if (ip) {
    const ipCount = await db.emailVerificationCode.count({
      where: { ipHash: hashIp(ip), createdAt: { gte: hourAgo } },
    })
    if (ipCount >= IP_HOURLY_MAX) {
      return { status: 'rate_limited', retryAfter: HOUR_MS / 1000 }
    }
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const record = await db.emailVerificationCode.create({
    data: {
      emailHash,
      codeHash: hashCode(purpose, code),
      purpose,
      expiresAt: new Date(now + TTL_MS),
      ipHash: ip ? hashIp(ip) : null,
    },
  })

  // 顺带清理过期较久的记录，避免表无限增长（失败不影响主流程）
  db.emailVerificationCode
    .deleteMany({ where: { expiresAt: { lt: new Date(now - CLEANUP_KEEP_MS) } } })
    .catch(() => {})

  return { status: 'ok', code, recordId: record.id }
}

/** 发信失败时丢弃已写入的验证码，避免留下无法送达的记录 */
export async function discardEmailCode(db: PrismaClient, id: string): Promise<void> {
  await db.emailVerificationCode.delete({ where: { id } }).catch(() => {})
}

// 引导邮件（已注册邮箱）限流：计数与验证码分开，落库到 email_notice_counters
export type NoticeQuotaResult = { ok: true } | { ok: false; retryAfter: number }

class NoticeLimitError extends Error {
  constructor(readonly retryAfter: number) {
    super('notice rate limited')
  }
}

function windowStart(now: number, size: number): Date {
  return new Date(Math.floor(now / size) * size)
}

/**
 * 时间窗计数原子累加：INSERT ... ON CONFLICT DO UPDATE 会在同一窗口行上排队，
 * 返回累加后的计数，因此并发请求不会互相覆盖，也不会超发。
 */
async function bumpWindow(
  tx: Prisma.TransactionClient,
  keyType: 'email' | 'ip',
  keyHash: string,
  start: Date
): Promise<number> {
  const rows = await tx.$queryRaw<{ count: number }[]>`
    INSERT INTO "email_notice_counters" ("keyType", "keyHash", "windowStart", "count")
    VALUES (${keyType}, ${keyHash}, ${start}, 1)
    ON CONFLICT ("keyType", "keyHash", "windowStart")
    DO UPDATE SET "count" = "email_notice_counters"."count" + 1
    RETURNING "count"
  `
  return Number(rows[0]?.count ?? 0)
}

/**
 * 引导邮件限流：60 秒冷却、单邮箱 5 封/小时、单 IP 10 封/小时。
 * 三项检查都在同一事务内完成，任一超限即回滚，避免把已累加的计数留下来。
 */
export async function consumeNoticeQuota(
  db: PrismaClient,
  email: string,
  ip?: string
): Promise<NoticeQuotaResult> {
  const now = Date.now()
  const emailHash = hashEmail(email)
  const ipHash = ip ? hashIp(ip) : undefined

  const cooldownStart = windowStart(now, RESEND_MS)
  const hourStart = windowStart(now, HOUR_MS)
  const cooldownRetry = Math.max(1, Math.ceil((cooldownStart.getTime() + RESEND_MS - now) / 1000))
  const hourRetry = Math.max(1, Math.ceil((hourStart.getTime() + HOUR_MS - now) / 1000))

  try {
    await db.$transaction(async (tx) => {
      if ((await bumpWindow(tx, 'email', emailHash, cooldownStart)) > 1) {
        throw new NoticeLimitError(cooldownRetry)
      }
      if ((await bumpWindow(tx, 'email', emailHash, hourStart)) > EMAIL_HOURLY_MAX) {
        throw new NoticeLimitError(hourRetry)
      }
      if (ipHash && (await bumpWindow(tx, 'ip', ipHash, hourStart)) > IP_HOURLY_MAX) {
        throw new NoticeLimitError(hourRetry)
      }

      // 常规清理：早于 2 小时的窗口行（最长窗口为 1 小时）已失效，顺便删除避免表无限增长
      await tx.$executeRaw`
        DELETE FROM "email_notice_counters" WHERE "windowStart" < ${new Date(now - 2 * HOUR_MS)}
      `
    })
    return { ok: true }
  } catch (error) {
    if (error instanceof NoticeLimitError) {
      return { ok: false, retryAfter: error.retryAfter }
    }
    throw error
  }
}

/**
 * 校验并一次性消费验证码。必须在事务中调用，便于与建号/改密一起回滚。
 */
export async function consumeEmailCode(
  tx: DbClient,
  email: string,
  purpose: EmailCodePurpose,
  code: unknown
): Promise<EmailCodeStatus> {
  if (typeof code !== 'string' || !code.trim()) return 'missing'

  const emailHash = hashEmail(email)
  const latest = await tx.emailVerificationCode.findFirst({
    where: { emailHash, purpose },
    orderBy: { createdAt: 'desc' },
  })

  if (!latest) return 'not_found'
  if (latest.usedAt) return 'used'
  if (latest.expiresAt.getTime() <= Date.now()) return 'expired'
  if (latest.codeHash !== hashCode(purpose, code)) return 'invalid'

  const updated = await tx.emailVerificationCode.updateMany({
    where: { id: latest.id, usedAt: null },
    data: { usedAt: new Date() },
  })

  return updated.count === 1 ? 'ok' : 'used'
}
