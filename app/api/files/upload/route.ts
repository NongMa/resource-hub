import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { getUploadToken, getUploadUrl, deleteFile } from '@/lib/qiniu'
import { nanoid } from 'nanoid'

const prisma = new PrismaClient()

// 获取上传凭证
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { key, fileName } = await request.json()

    // 生成唯一的存储 key
    const uniqueKey = key || `${session.user.id}/${nanoid()}-${fileName}`
    const token = getUploadToken(uniqueKey)

    return NextResponse.json({ token, key: uniqueKey, uploadUrl: getUploadUrl() })
  } catch (error) {
    console.error('Upload token error:', error)
    return NextResponse.json({ error: '获取上传凭证失败' }, { status: 500 })
  }
}
