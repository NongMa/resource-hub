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

    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId: user.id },
    })

    if (!folder) {
      return NextResponse.json({ error: '文件夹不存在' }, { status: 404 })
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
