import { PrismaClient } from '@prisma/client'

/**
 * Prisma 单例：避免每个路由模块各自 new PrismaClient()，
 * 在 Serverless / 开发热更新下累积连接、打满数据库连接数。
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(
    process.env.NODE_ENV === 'development' ? { log: ['warn', 'error'] } : undefined
  )

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
