import { NextRequest, NextResponse } from 'next/server'
import { attemptLogin } from '@/lib/login-guard'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const captchaId = body?.captchaId
    const captchaCode = body?.captchaCode

    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码不能为空' },
        { status: 400, headers: NO_STORE }
      )
    }

    // 计数、锁定、验证码消费与密码校验都在同一个事务里完成
    const outcome = await attemptLogin({ email, password, captchaId, captchaCode })

    switch (outcome.kind) {
      case 'locked':
        return NextResponse.json(
          { error: '尝试次数过多，请 15 分钟后再试', code: 'TOO_MANY_ATTEMPTS', captchaRequired: true },
          {
            status: 429,
            headers: { ...NO_STORE, 'Retry-After': String(outcome.retryAfterSec) },
          }
        )
      case 'captchaRequired':
        return NextResponse.json(
          { error: '请输入图形验证码', code: 'CAPTCHA_REQUIRED', captchaRequired: true },
          { status: 400, headers: NO_STORE }
        )
      case 'captchaExpired':
        return NextResponse.json(
          { error: '验证码已过期，请刷新后重试', code: 'CAPTCHA_EXPIRED', captchaRequired: true },
          { status: 400, headers: NO_STORE }
        )
      case 'captchaInvalid':
        return NextResponse.json(
          { error: '验证码不正确，请刷新后重试', code: 'CAPTCHA_INVALID', captchaRequired: true },
          { status: 400, headers: NO_STORE }
        )
      case 'invalidCredentials':
        return NextResponse.json(
          { error: '邮箱或密码不正确', code: 'INVALID_CREDENTIALS', captchaRequired: true },
          { status: 401, headers: NO_STORE }
        )
      default:
        return NextResponse.json(
          { ok: true, loginToken: outcome.loginToken },
          { headers: NO_STORE }
        )
    }
  } catch (error) {
    // 数据库不可用时拒绝登录（fail-closed），避免绕过验证码与失败计数
    console.error('Login error:', error)
    return NextResponse.json(
      { error: '服务暂时不可用，请稍后重试', code: 'SERVICE_UNAVAILABLE' },
      { status: 503, headers: NO_STORE }
    )
  }
}
