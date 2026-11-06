import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { consumeEmailCode, isValidEmail, normalizeEmail } from '@/lib/email-verification'
import type { EmailCodeStatus } from '@/lib/email-verification'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const prisma = new PrismaClient()
const NO_STORE = { 'Cache-Control': 'no-store' }

function emailCodeError(status: Exclude<EmailCodeStatus, 'ok'>) {
  switch (status) {
    case 'missing':
      return { status: 400, body: { error: '请输入邮箱验证码', code: 'EMAIL_CODE_REQUIRED' } }
    case 'invalid':
      return { status: 400, body: { error: '邮箱验证码不正确', code: 'EMAIL_CODE_INVALID' } }
    case 'used':
      return { status: 400, body: { error: '邮箱验证码已使用，请重新获取', code: 'EMAIL_CODE_USED' } }
    case 'expired':
    case 'not_found':
    default:
      return {
        status: 400,
        body: { error: '邮箱验证码已过期，请重新获取', code: 'EMAIL_CODE_EXPIRED' },
      }
  }
}

/**
 * 重置密码：校验通过 reset 场景签发的邮箱验证码后更新密码。
 */
export async function POST(request: NextRequest) {
  let payload: { email?: unknown; password?: unknown; emailCode?: unknown }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: '请求参数无效' }, { status: 400, headers: NO_STORE })
  }

  const { email, password, emailCode } = payload

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: '请输入有效的邮箱地址', code: 'INVALID_EMAIL' },
      { status: 400, headers: NO_STORE }
    )
  }

  if (typeof password !== 'string' || password.length < 6) {
    return NextResponse.json(
      { error: '密码长度至少为6位', code: 'WEAK_PASSWORD' },
      { status: 400, headers: NO_STORE }
    )
  }

  const normalizedEmail = normalizeEmail(email)

  // 不存在或未签发验证码时统一返回「验证码失效」，不区分邮箱是否存在
  const target = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    select: { id: true },
  })

  if (!target) {
    return NextResponse.json(
      { error: '邮箱验证码已过期，请重新获取', code: 'EMAIL_CODE_EXPIRED' },
      { status: 400, headers: NO_STORE }
    )
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  // 验证码消费与密码更新在同一事务内，避免消费成功但密码未更新的中间状态
  const result = await prisma.$transaction(async (tx) => {
    const status = await consumeEmailCode(tx, normalizedEmail, 'reset', emailCode)
    if (status !== 'ok') {
      return { status }
    }

    await tx.user.update({
      where: { id: target.id },
      data: {
        password: hashedPassword,
        // 使该账号此前签发的所有 JWT 失效（旧会话在下次版本核对时被判定为未登录）
        sessionVersion: { increment: 1 },
      },
    })

    return { status: 'ok' as const }
  })

  if (result.status !== 'ok') {
    const mapped = emailCodeError(result.status)
    return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE })
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
