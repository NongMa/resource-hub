import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateShareToken } from '@/lib/share-token'
import { getFileUrl, getDownloadUrl } from '@/lib/qiniu'

// 创建分享
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

    const { fileId, expiresIn } = await request.json()

    const file = await prisma.file.findUnique({
      where: { id: fileId },
    })

    if (!file) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 })
    }

    if (file.userId !== user.id) {
      return NextResponse.json({ error: '无权分享该文件' }, { status: 403 })
    }

    const token = generateShareToken()
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null

    const share = await prisma.share.create({
      data: {
        token,
        expiresAt,
        fileId,
        userId: user.id,
      },
    })

    const shareUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/share/${token}`

    return NextResponse.json({ url: shareUrl, token })
  } catch (error) {
    console.error('Create share error:', error)
    return NextResponse.json({ error: '创建分享失败' }, { status: 500 })
  }
}

// 获取分享信息
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token不能为空' }, { status: 400 })
    }

    const share = await prisma.share.findUnique({
      where: { token },
      include: {
        file: true,
      },
    })

    if (!share) {
      return NextResponse.json({ error: '分享不存在' }, { status: 404 })
    }

    // 检查是否过期
    if (share.expiresAt && new Date() > share.expiresAt) {
      return NextResponse.json({ error: '分享已过期' }, { status: 410 })
    }

    // 只下发分享页真正需要的字段：
    // password / userId / fileId / key 等内部字段不出现在匿名响应中
    return NextResponse.json({
      expiresAt: share.expiresAt,
      file: {
        name: share.file.name,
        size: share.file.size,
        mimeType: share.file.mimeType,
        url: getFileUrl(share.file.key),
        downloadUrl: getDownloadUrl(share.file.key, share.file.name),
      },
    })
  } catch (error) {
    console.error('Get share error:', error)
    return NextResponse.json({ error: '获取分享信息失败' }, { status: 500 })
  }
}
