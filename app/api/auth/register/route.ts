import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { createHash, timingSafeEqual } from 'crypto'
import { attemptLogin } from '@/lib/login-guard'

const prisma = new PrismaClient()

/** 读取 .env 中逗号分隔的授权码，允许配置多个 */
function getInviteCodes(): string[] {
  return (process.env.REGISTER_INVITE_CODES || '')
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean)
}

/** 定长摘要后再比较，避免长度差异与明显时序特征 */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, inviteCode } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: '邮箱和密码不能为空' }, { status: 400 })
    }

    // 授权码校验必须在服务端执行；未配置授权码时关闭注册（fail-closed）
    const inviteCodes = getInviteCodes()
    if (inviteCodes.length === 0) {
      return NextResponse.json(
        { error: '注册暂未开放：服务端未配置授权码' },
        { status: 503 }
      )
    }

    const submittedCode = typeof inviteCode === 'string' ? inviteCode.trim() : ''
    const matched = submittedCode
      ? inviteCodes.some((code) => safeEqual(submittedCode, code))
      : false

    if (!matched) {
      return NextResponse.json(
        { error: '授权码不正确，请联系管理员获取' },
        { status: 403 }
      )
    }

    // 检查用户是否已存在（放在授权码校验之后，避免向无授权者泄露邮箱状态）
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json({ error: '该邮箱已被注册' }, { status: 409 })
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 12)

    // 创建用户
    const user = await prisma.user.create({
      data: {
        name: name || email.split('@')[0],
        email,
        password: hashedPassword,
      },
    })

    // 与登录同源：走同一套验证码 / 限流 / 密码校验，通过后才签发一次性票据。
    // 新账号通常等价于「第一次尝试」，不需要验证码；但若该邮箱此前已有失败记录或被锁定，则不会签发票据。
    try {
      const outcome = await attemptLogin({ email, password })
      if (outcome.kind === 'ok') {
        return NextResponse.json({
          id: user.id,
          email: user.email,
          name: user.name,
          loginToken: outcome.loginToken,
        })
      }

      const message =
        outcome.kind === 'locked'
          ? '账号已创建，但尝试次数过多，请 15 分钟后前往登录页登录'
          : outcome.kind === 'captchaRequired'
            ? '账号已创建，请前往登录页并完成图形验证码后登录'
            : '账号已创建，请前往登录页登录'

      return NextResponse.json({
        id: user.id,
        email: user.email,
        name: user.name,
        loginToken: null,
        autoLogin: false,
        message,
      })
    } catch (error) {
      // 账号已创建但票据签发失败时，明确告知用户去登录页登录，避免静默的「半登录」状态
      console.error('Register auto-login failed:', error)
      return NextResponse.json({
        id: user.id,
        email: user.email,
        name: user.name,
        loginToken: null,
        autoLogin: false,
        message: '账号已创建，但自动登录暂时不可用，请前往登录页登录',
      })
    }
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: '注册失败' }, { status: 500 })
  }
}
