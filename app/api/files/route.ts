import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import {
  deleteFile as deleteQiniuFile,
  getFileUrl,
  getDownloadUrl,
  getThumbnailUrl,
  getPreviewImageUrl,
  isProcessableImage,
} from '@/lib/qiniu'
import { isKeyOwnedByUser } from '@/lib/fileKey'

const prisma = new PrismaClient()

// 获取文件列表 / 创建文件
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('folderId')

    // 分页参数：page 从 1 开始，pageSize 限制在 1–100（默认 20）
    const pageParam = parseInt(searchParams.get('page') || '1', 10)
    const sizeParam = parseInt(searchParams.get('pageSize') || '20', 10)
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
    const pageSize = Number.isFinite(sizeParam)
      ? Math.min(Math.max(sizeParam, 1), 100)
      : 20

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // 搜索关键词：按文件名包含匹配，仅在当前文件夹内生效；q 为空时行为不变
    const q = (searchParams.get('q') || '').trim()

    const where = {
      userId: user.id,
      folderId: folderId || null,
      ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
    }

    // createdAt 可能相同，追加 id 作为次级排序，避免分页漏条/重条
    const [total, files] = await prisma.$transaction([
      prisma.file.count({ where }),
      prisma.file.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      files: files.map((file) => {
        // url 用于预览（内联展示），downloadUrl 带 attname 用于强制下载
        const base = {
          ...file,
          url: getFileUrl(file.key),
          downloadUrl: getDownloadUrl(file.key, file.name),
        }

        // 仅图片下发处理后的地址；签名在本地计算，不产生额外网络请求
        if (!isProcessableImage(file.mimeType)) {
          return base
        }

        return {
          ...base,
          thumbnailUrl: getThumbnailUrl(file.key),
          previewUrl: getPreviewImageUrl(file.key, 'slim'),
          smallUrl: getPreviewImageUrl(file.key, 'small'),
        }
      }),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    })
  } catch (error) {
    console.error('Get files error:', error)
    return NextResponse.json({ error: '获取文件列表失败' }, { status: 500 })
  }
}

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

    const { name, key, size, mimeType, folderId } = await request.json()

    // key 必须落在当前用户的目录下
    if (!isKeyOwnedByUser(user.id, key)) {
      return NextResponse.json({ error: '无权使用该文件路径' }, { status: 403 })
    }

    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, userId: user.id },
      })

      if (!folder) {
        return NextResponse.json({ error: '文件夹不存在' }, { status: 404 })
      }
    }

    const file = await prisma.file.create({
      data: {
        name,
        key,
        size,
        mimeType,
        folderId: folderId || null,
        userId: user.id,
      },
    })

    return NextResponse.json(file)
  } catch (error) {
    console.error('Create file error:', error)
    return NextResponse.json({ error: '创建文件记录失败' }, { status: 500 })
  }
}

// 删除文件
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('id')

    if (!fileId) {
      return NextResponse.json({ error: '文件ID不能为空' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const file = await prisma.file.findUnique({
      where: { id: fileId },
    })

    if (!file) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 })
    }

    if (file.userId !== user.id) {
      return NextResponse.json({ error: '无权操作该文件' }, { status: 403 })
    }

    // 删除七牛云文件
    try {
      await deleteQiniuFile(file.key)
    } catch (e) {
      console.error('Delete qiniu file error:', e)
    }

    // 删除数据库记录
    await prisma.file.delete({
      where: { id: fileId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete file error:', error)
    return NextResponse.json({ error: '删除文件失败' }, { status: 500 })
  }
}
