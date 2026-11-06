import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { createHash, timingSafeEqual } from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const prisma = new PrismaClient()
const NO_STORE = { 'Cache-Control': 'no-store' }

function equalSecret(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

/**
 * 数据库保活检查：仅执行 SELECT 1，不读取任何业务数据。
 * 供 Vercel Cron 每日调用，避免 Supabase 免费版因长时间无活动被暂停。
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  // 未配置时 fail-closed，避免接口在公网裸奔
  if (!secret) {
    return NextResponse.json(
      {
        ok: false,
        error: 'cron_secret_not_configured',
        hint: '请在 Vercel 项目设置的 Environment Variables 中添加 CRON_SECRET',
      },
      { status: 503, headers: NO_STORE }
    )
  }

  const authorization = request.headers.get('authorization') || ''
  if (!equalSecret(authorization, `Bearer ${secret}`)) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401, headers: NO_STORE }
    )
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
      { ok: false, error: 'database_unavailable' },
      { status: 503, headers: NO_STORE }
    )
  }
}
