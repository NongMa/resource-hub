import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { getUploadToken, getUploadUrl } from '@/lib/qiniu'
import { buildFileKey } from '@/lib/fileKey'

const prisma = new PrismaClient()

// 获取上传凭证
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const { fileName, folderId } = await request.json()

    if (typeof fileName !== 'string' || !fileName.trim()) {
      return NextResponse.json({ error: '文件名不能为空' }, { status: 400 })
    }

    // 文件夹必须属于当前用户
    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, userId: user.id },
      })

      if (!folder) {
        return NextResponse.json({ error: '文件夹不存在' }, { status: 404 })
      }
    }

    // key 由服务端生成，客户端无法指定
    const uniqueKey = buildFileKey(user.id, fileName)
    const token = getUploadToken(uniqueKey)

    return NextResponse.json({ token, key: uniqueKey, uploadUrl: getUploadUrl() })
  } catch (error) {
    console.error('Upload token error:', error)
    return NextResponse.json({ error: '获取上传凭证失败' }, { status: 500 })
  }
}
