import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 获取文件夹列表 / 创建文件夹
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parentId = searchParams.get('parentId')

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const folders = await prisma.folder.findMany({
      where: {
        userId: user.id,
        parentId: parentId || null,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(folders)
  } catch (error) {
    console.error('Get folders error:', error)
    return NextResponse.json({ error: '获取文件夹列表失败' }, { status: 500 })
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

    const { name, parentId } = await request.json()

    const folder = await prisma.folder.create({
      data: {
        name,
        parentId: parentId || null,
        userId: user.id,
      },
    })

    return NextResponse.json(folder)
  } catch (error) {
    console.error('Create folder error:', error)
    return NextResponse.json({ error: '创建文件夹失败' }, { status: 500 })
  }
}

// 删除文件夹
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('id')

    if (!folderId) {
      return NextResponse.json({ error: '文件夹ID不能为空' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
    })

    if (!folder) {
      return NextResponse.json({ error: '文件夹不存在' }, { status: 404 })
    }

    if (folder.userId !== user.id) {
      return NextResponse.json({ error: '无权操作该文件夹' }, { status: 403 })
    }

    // 非空文件夹不允许删除：先统计其下文件与子文件夹数量
    const [fileCount, folderCount] = await Promise.all([
      prisma.file.count({ where: { folderId } }),
      prisma.folder.count({ where: { parentId: folderId } }),
    ])

    if (fileCount > 0 || folderCount > 0) {
      const parts: string[] = []
      if (folderCount > 0) parts.push(`${folderCount} 个子文件夹`)
      if (fileCount > 0) parts.push(`${fileCount} 个文件`)

      return NextResponse.json(
        {
          error: '文件夹非空，请先清空其中的文件与子文件夹',
          detail: `该文件夹下仍有 ${parts.join('、')}`,
          fileCount,
          folderCount,
        },
        { status: 409 }
      )
    }

    await prisma.folder.delete({
      where: { id: folderId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete folder error:', error)
    return NextResponse.json({ error: '删除文件夹失败' }, { status: 500 })
  }
}
