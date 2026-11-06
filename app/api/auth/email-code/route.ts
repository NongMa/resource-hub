import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { isSmtpConfigured, sendEmailCode, sendRegisteredNotice } from '@/lib/mailer'
import {
  EMAIL_CODE_RESEND_SECONDS,
  EMAIL_CODE_TTL_SECONDS,
  consumeNoticeQuota,
  discardEmailCode,
  isValidEmail,
  issueEmailCode,
  normalizeEmail,
} from '@/lib/email-verification'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const prisma = new PrismaClient()
const NO_STORE = { 'Cache-Control': 'no-store' }

type Purpose = 'register' | 'reset'

function isPurpose(value: unknown): value is Purpose {
  return value === 'register' || value === 'reset'
}

/**
 * 发送邮箱验证码（注册 / 重置密码两个场景共用，按 purpose 隔离）。
 */
export async function POST(request: NextRequest) {
  let payload: { email?: unknown; purpose?: unknown }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: '请求参数无效' }, { status: 400, headers: NO_STORE })
  }

  const email = payload.email
  const purpose = payload.purpose

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: '请输入有效的邮箱地址', code: 'INVALID_EMAIL' },
      { status: 400, headers: NO_STORE }
    )
  }

  if (!isPurpose(purpose)) {
    return NextResponse.json(
      { error: '请求场景无效', code: 'INVALID_PURPOSE' },
      { status: 400, headers: NO_STORE }
    )
  }

  // 未配置 SMTP 时 fail-closed：不发信，也不让注册/重置在没有校验的情况下继续
  if (!isSmtpConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: '邮件服务未配置，暂时无法发送验证码',
        code: 'EMAIL_SERVICE_NOT_CONFIGURED',
        hint: '请配置环境变量 SMTP_HOST、SMTP_PORT、SMTP_SECURE、SMTP_USER、SMTP_PASS、SMTP_FROM',
      },
      { status: 503, headers: NO_STORE }
    )
  }

  const normalizedEmail = normalizeEmail(email)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined

  // 防枚举：无论邮箱是否存在都返回同样的结果；仅对真正需要的场景发信
  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    select: { id: true },
  })

  const okBody = { ok: true, expiresIn: EMAIL_CODE_TTL_SECONDS, resendAfter: EMAIL_CODE_RESEND_SECONDS }

  if (purpose === 'register' && existing) {
    // 已注册邮箱：不签发验证码、不写 email_verification_codes，改为发送一封引导邮件
    let quota: Awaited<ReturnType<typeof consumeNoticeQuota>>
    try {
      quota = await consumeNoticeQuota(prisma, normalizedEmail, ip)
    } catch (error) {
      // 限流存储不可用时 fail-closed：拒绝发信，避免数据库故障等同于限流失效
      console.error('Notice quota check failed:', error)
      return NextResponse.json(
        { ok: false, error: '服务暂时不可用，请稍后重试', code: 'SERVICE_UNAVAILABLE' },
        { status: 503, headers: NO_STORE }
      )
    }

    if (!quota.ok) {
      return NextResponse.json(
        {
          error: '发送过于频繁，请稍后再试',
          code: 'EMAIL_CODE_RATE_LIMITED',
          retryAfter: quota.retryAfter,
        },
        { status: 429, headers: { ...NO_STORE, 'Retry-After': String(quota.retryAfter) } }
      )
    }

    try {
      await sendRegisteredNotice(normalizedEmail)
    } catch (error) {
      console.error('Send registered notice failed:', error)
      return NextResponse.json(
        { ok: false, error: '邮件发送失败，请稍后重试', code: 'EMAIL_SEND_FAILED' },
        { status: 502, headers: NO_STORE }
      )
    }

    return NextResponse.json(okBody, { headers: NO_STORE })
  }

  if (purpose === 'reset' && !existing) {
    return NextResponse.json(okBody, { headers: NO_STORE })
  }

  // 写库失败（表缺失、数据库宕机等）必须明确返回 5xx：既不能继续发信，也不能伪装成 200
  let issued: Awaited<ReturnType<typeof issueEmailCode>>
  try {
    issued = await issueEmailCode(prisma, normalizedEmail, purpose, ip)
  } catch (error) {
    console.error('Issue email code failed:', error)
    return NextResponse.json(
      {
        ok: false,
        error: '验证码服务暂时不可用，请稍后重试',
        code: 'EMAIL_CODE_STORE_FAILED',
      },
      { status: 500, headers: NO_STORE }
    )
  }

  if (issued.status !== 'ok') {
    return NextResponse.json(
      {
        error: '发送过于频繁，请稍后再试',
        code: 'EMAIL_CODE_RATE_LIMITED',
        retryAfter: issued.retryAfter,
      },
      { status: 429, headers: { ...NO_STORE, 'Retry-After': String(issued.retryAfter) } }
    )
  }

  try {
    await sendEmailCode(normalizedEmail, issued.code, purpose)
  } catch (error) {
    console.error('Send email code failed:', error)
    await discardEmailCode(prisma, issued.recordId)
    return NextResponse.json(
      { ok: false, error: '验证码发送失败，请稍后重试', code: 'EMAIL_SEND_FAILED' },
      { status: 502, headers: NO_STORE }
    )
  }

  return NextResponse.json(okBody, { headers: NO_STORE })
}
