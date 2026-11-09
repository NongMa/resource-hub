import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'crypto'
import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

/**
 * 登录保护：图形验证码、失败计数、登录票据。
 * 计数与验证码消费状态存储在数据库（Supabase），多实例下共享同一份状态。
 */

const CAPTCHA_CHARS = '0123456789'
const CAPTCHA_LENGTH = 5
const CAPTCHA_TTL_MS = 5 * 60 * 1000
const TICKET_TTL_MS = 90 * 1000
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const LOCK_MS = 15 * 60 * 1000
const MAX_FAILURES = 5
/** 从第二次尝试（即已有 1 次失败）起要求验证码 */
const CAPTCHA_THRESHOLD = 1
/** 清理保留期 */
const CAPTCHA_RETENTION_MS = 15 * 60 * 1000
const ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not configured')
  }
  return secret
}

function derivedKey(info: string): Buffer {
  return Buffer.from(hkdfSync('sha256', getSecret(), 'resource-hub-login-salt', info, 32))
}

function captchaKey(): Buffer {
  return Buffer.from(hkdfSync('sha256', getSecret(), 'resource-hub-captcha-salt', 'resource-hub-captcha-key', 32))
}

function digest(value: string): Buffer {
  // 定长后再比较，避免长度差异带来的时序特征
  return Buffer.from(createHmac('sha256', getSecret()).update(value).digest())
}

function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b))
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** 邮箱的不可逆标识：带密钥的 HMAC-SHA256，库中不出现明文邮箱 */
function emailIdentifier(email: string): string {
  return createHmac('sha256', derivedKey('resource-hub-email-key'))
    .update(normalizeEmail(email))
    .digest('hex')
}

/** captchaId 的不可逆标识，用于记录消费状态 */
function captchaTokenHash(id: string): string {
  return createHmac('sha256', derivedKey('resource-hub-captcha-token-key'))
    .update(id)
    .digest('hex')
}

/** 登录票据的不可逆标识，用于记录消费状态（一次性） */
function loginTicketHash(ticket: string): string {
  return createHmac('sha256', derivedKey('resource-hub-login-ticket-key'))
    .update(ticket)
    .digest('hex')
}

/* ------------------------------ 图形验证码 ------------------------------ */

const SEGMENTS = {
  a: [4, 7, 24, 7],
  b: [24, 7, 24, 21],
  c: [24, 22, 24, 37],
  d: [4, 37, 24, 37],
  e: [4, 22, 4, 37],
  f: [4, 7, 4, 21],
  g: [4, 21, 24, 21],
} as const

const DIGIT_SEGMENTS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abcdg',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
}

function renderCaptchaSvg(answer: string): string {
  const cellWidth = 30
  let glyphs = ''
  for (let i = 0; i < answer.length; i += 1) {
    const segments = DIGIT_SEGMENTS[answer[i]]
    const offsetX = 8 + i * cellWidth + randomInt(-1, 2)
    const offsetY = 3 + randomInt(-1, 2)
    const rotate = randomInt(-7, 8)
    glyphs += `<g class="d" transform="translate(${offsetX} ${offsetY}) rotate(${rotate} 14 22)">`
    for (const name of segments) {
      const [x1, y1, x2, y2] = SEGMENTS[name as keyof typeof SEGMENTS]
      glyphs += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1e293b" stroke-width="2.2" stroke-linecap="round"/>`
    }
    glyphs += '</g>'
  }

  let noise = ''
  for (let i = 0; i < 4; i += 1) {
    noise += `<line x1="${randomInt(0, 160)}" y1="${randomInt(0, 50)}" x2="${randomInt(0, 160)}" y2="${randomInt(0, 50)}" stroke="#94a3b8" stroke-width="1" opacity="0.35"/>`
  }
  for (let i = 0; i < 26; i += 1) {
    noise += `<circle cx="${randomInt(0, 160)}" cy="${randomInt(0, 50)}" r="${randomInt(1, 3) / 2}" fill="#94a3b8" opacity="0.3"/>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="50" viewBox="0 0 160 50" role="img" aria-label="图形验证码"><rect width="160" height="50" fill="#f8fafc"/>${noise}${glyphs}</svg>`
}

function encryptCaptcha(answer: string, expiresAt: number): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', captchaKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify({ a: answer, e: expiresAt }), 'utf8'),
    cipher.final(),
  ])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')
}

function decryptCaptcha(id: string): { a: string; e: number } | null {
  try {
    const raw = Buffer.from(id, 'base64url')
    if (raw.length < 29) return null
    const iv = raw.subarray(0, 12)
    const tag = raw.subarray(12, 28)
    const content = raw.subarray(28)
    const decipher = createDecipheriv('aes-256-gcm', captchaKey(), iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(content), decipher.final()]).toString('utf8')
    const data = JSON.parse(decrypted)
    if (typeof data?.a !== 'string' || typeof data?.e !== 'number') return null
    return { a: data.a, e: data.e }
  } catch {
    return null
  }
}

/** 顺带清理过期验证码与陈旧计数，避免表无限增长；失败不影响主流程 */
async function sweep() {
  try {
    const now = Date.now()
    await prisma.$executeRaw`DELETE FROM "login_captchas" WHERE "expiresAt" < ${new Date(now - CAPTCHA_RETENTION_MS)}`
    await prisma.$executeRaw`DELETE FROM "login_attempts" WHERE "updatedAt" < ${new Date(now - ATTEMPT_RETENTION_MS)}`
  } catch (error) {
    console.error('Login guard sweep failed:', error)
  }
}

/** 生成验证码；答案封装在加密票据中，同时把消费状态写入数据库 */
export async function createCaptcha(): Promise<{ id: string; svg: string }> {
  const answer = Array.from(
    { length: CAPTCHA_LENGTH },
    () => CAPTCHA_CHARS[randomInt(0, CAPTCHA_CHARS.length)]
  ).join('')
  const expiresAt = Date.now() + CAPTCHA_TTL_MS
  const id = encryptCaptcha(answer, expiresAt)
  const svg = renderCaptchaSvg(answer)
  await prisma.loginCaptcha.create({
    data: { tokenHash: captchaTokenHash(id), expiresAt: new Date(expiresAt) },
  })
  await sweep()
  return { id, svg }
}

type CaptchaVerifyResult = 'ok' | 'invalid' | 'expired'

/** 单条条件更新完成消费，保证同一验证码只会被成功使用一次 */
async function consumeCaptcha(
  tx: Prisma.TransactionClient,
  id: unknown,
  code: unknown
): Promise<CaptchaVerifyResult> {
  if (typeof id !== 'string' || typeof code !== 'string') return 'invalid'
  const payload = decryptCaptcha(id)
  if (!payload) return 'invalid'
  if (payload.e < Date.now()) return 'expired'

  if (!safeEqual(code.trim(), payload.a)) return 'invalid'

  const affected = await tx.$executeRaw`
    UPDATE "login_captchas"
    SET "usedAt" = ${new Date()}
    WHERE "tokenHash" = ${captchaTokenHash(id)}
      AND "usedAt" IS NULL
      AND "expiresAt" > ${new Date()}
  `
  return affected === 1 ? 'ok' : 'expired'
}

/* ------------------------------ 登录尝试 ------------------------------ */

export type LoginOutcome =
  | { kind: 'locked'; retryAfterSec: number }
  | { kind: 'captchaRequired' }
  | { kind: 'captchaExpired' }
  | { kind: 'captchaInvalid' }
  | { kind: 'invalidCredentials' }
  | { kind: 'ok'; loginToken: string }

/**
 * 在单个事务内完成「加锁读取 → 窗口滚动 → 锁定判断 → 验证码消费 → 密码校验 → 计数更新」。
 * `SELECT ... FOR UPDATE` 让同一账号的尝试串行化，避免并发读到相同 count 后各自放行；
 * 计数与验证码消费都是单条记录的条件更新。
 */
export async function attemptLogin(input: {
  email: string
  password: string
  captchaId?: unknown
  captchaCode?: unknown
}): Promise<LoginOutcome> {
  const { email, password } = input
  const emailHash = emailIdentifier(email)

  return prisma.$transaction(
    async (tx) => {
      const now = Date.now()
      const nowDate = new Date(now)

      // 确保记录存在，再对同一行加锁
      await tx.$executeRaw`
        INSERT INTO "login_attempts" ("emailHash", "failureCount", "windowStart", "createdAt", "updatedAt")
        VALUES (${emailHash}, 0, ${nowDate}, ${nowDate}, ${nowDate})
        ON CONFLICT ("emailHash") DO NOTHING
      `

      const rows = await tx.$queryRaw<
        { failureCount: number; windowStart: Date; lockedUntil: Date | null }[]
      >`
        SELECT "failureCount", "windowStart", "lockedUntil"
        FROM "login_attempts"
        WHERE "emailHash" = ${emailHash}
        FOR UPDATE
      `
      if (rows.length === 0) {
        throw new Error('login attempt row missing')
      }

      let count = rows[0].failureCount
      let windowStart = new Date(rows[0].windowStart).getTime()
      let lockedUntil = rows[0].lockedUntil ? new Date(rows[0].lockedUntil).getTime() : null

      // 锁定到期或窗口过期：计数归零并重新开窗
      const lockExpired = lockedUntil !== null && lockedUntil <= now
      const windowExpired = now - windowStart > ATTEMPT_WINDOW_MS
      if (lockExpired || windowExpired) {
        count = 0
        windowStart = now
        lockedUntil = null
        await tx.$executeRaw`
          UPDATE "login_attempts"
          SET "failureCount" = 0, "windowStart" = ${nowDate}, "lockedUntil" = NULL, "updatedAt" = ${nowDate}
          WHERE "emailHash" = ${emailHash}
        `
      } else if (lockedUntil !== null && lockedUntil > now) {
        return {
          kind: 'locked' as const,
          retryAfterSec: Math.max(1, Math.ceil((lockedUntil - now) / 1000)),
        }
      }

      const captchaRequired = count >= CAPTCHA_THRESHOLD
      if (captchaRequired) {
        const { captchaId, captchaCode } = input
        if (
          typeof captchaId !== 'string' ||
          !captchaId ||
          typeof captchaCode !== 'string' ||
          !captchaCode.trim()
        ) {
          return { kind: 'captchaRequired' as const }
        }

        const captchaResult = await consumeCaptcha(tx, captchaId, captchaCode)
        if (captchaResult === 'expired') return { kind: 'captchaExpired' as const }
        if (captchaResult === 'invalid') return { kind: 'captchaInvalid' as const }
      }

      const user = await tx.user.findUnique({ where: { email } })
      const passwordValid = user?.password ? await bcrypt.compare(password, user.password) : false

      if (!passwordValid) {
        const nextCount = count + 1
        const nextLockedUntil =
          nextCount >= MAX_FAILURES ? new Date(now + LOCK_MS) : null
        await tx.$executeRaw`
          UPDATE "login_attempts"
          SET "failureCount" = ${nextCount},
              "windowStart" = ${new Date(windowStart)},
              "lockedUntil" = ${nextLockedUntil},
              "updatedAt" = ${nowDate}
          WHERE "emailHash" = ${emailHash}
        `
        return { kind: 'invalidCredentials' as const }
      }

      // 登录成功：清零该账号的失败计数，并签发一次性票据
      await tx.$executeRaw`DELETE FROM "login_attempts" WHERE "emailHash" = ${emailHash}`
      const loginToken = await issueLoginTicket(email, tx)
      return { kind: 'ok' as const, loginToken }
    },
    { maxWait: 10000, timeout: 15000 }
  )
}

/* ------------------------------ 登录票据 ------------------------------ */

/**
 * 清除该邮箱的失败计数与锁定状态。
 * 密码重置已证明邮箱归属，旧的失败记录不应继续拦截合法登录。
 */
export async function clearLoginAttempts(
  db: Prisma.TransactionClient | PrismaClient,
  email: string
): Promise<void> {
  await db.$executeRaw`
    DELETE FROM "login_attempts" WHERE "emailHash" = ${emailIdentifier(email)}
  `
}

type DbClient = Prisma.TransactionClient | PrismaClient

function buildTicket(email: string): { ticket: string; expiresAt: number } {
  const expiresAt = Date.now() + TICKET_TTL_MS
  const payload = Buffer.from(
    JSON.stringify({ e: normalizeEmail(email), x: expiresAt })
  ).toString('base64url')
  const signature = createHmac('sha256', getSecret())
    .update(`ticket.${payload}`)
    .digest('base64url')
  return { ticket: `${payload}.${signature}`, expiresAt }
}

/**
 * 签发一次性登录票据：绑定邮箱、90 秒有效，同时在数据库中登记消费状态。
 * 只有真正通过 attemptLogin（与登录同源的验证码 / 限流 / 密码校验）才会调用到这里。
 */
export async function issueLoginTicket(email: string, client?: DbClient): Promise<string> {
  const db = client ?? prisma
  const { ticket, expiresAt } = buildTicket(email)
  await db.loginCaptcha.create({
    data: { tokenHash: loginTicketHash(ticket), expiresAt: new Date(expiresAt) },
  })
  return ticket
}

/**
 * 消费登录票据：先做签名 / 时效 / 邮箱绑定校验，再用单条条件更新标记已使用。
 * 同一票据只能成功消费一次，且无法用于其他邮箱。
 */
export async function consumeLoginTicket(ticket: unknown, email: unknown): Promise<boolean> {
  if (typeof ticket !== 'string' || typeof email !== 'string') return false
  const parts = ticket.split('.')
  if (parts.length !== 2) return false
  const [payload, signature] = parts
  const expected = createHmac('sha256', getSecret())
    .update(`ticket.${payload}`)
    .digest('base64url')
  if (signature.length !== expected.length) return false
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false

  let boundEmail = ''
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof data?.e !== 'string' || typeof data?.x !== 'number') return false
    if (data.x <= Date.now()) return false
    boundEmail = data.e
  } catch {
    return false
  }

  if (boundEmail !== normalizeEmail(email)) return false

  const affected = await prisma.$executeRaw`
    UPDATE "login_captchas"
    SET "usedAt" = ${new Date()}
    WHERE "tokenHash" = ${loginTicketHash(ticket)}
      AND "usedAt" IS NULL
      AND "expiresAt" > ${new Date()}
  `
  return affected === 1
}
