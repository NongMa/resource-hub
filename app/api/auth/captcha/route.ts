import { NextResponse } from 'next/server'
import { createCaptcha } from '@/lib/login-guard'

export const dynamic = 'force-dynamic'

// 验证码图片接口：禁止任何层级的缓存，答案不在响应中明文出现
export async function GET() {
  try {
    const { id, svg } = await createCaptcha()
    return NextResponse.json(
      { id, svg },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    )
  } catch (error) {
    // 验证码状态写入数据库失败时同样拒绝签发，避免产生无法校验的验证码
    console.error('Captcha error:', error)
    return NextResponse.json(
      { error: '服务暂时不可用，请稍后重试', code: 'SERVICE_UNAVAILABLE' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
