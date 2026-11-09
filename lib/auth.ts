import { NextAuthOptions } from 'next-auth'
import type { Session, User } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import GitHubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { consumeLoginTicket } from '@/lib/login-guard'

/** JWT 中记录的会话版本与最近一次回库核对时间 */
type SessionVersionToken = JWT & {
  sessionVersion?: number
  sessionVersionCheckedAt?: number
  revoked?: boolean
}

// 同一 token 在该时间窗内不重复回库核对，用来平衡吊销及时性与数据库查询成本
const SESSION_VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: '邮箱', type: 'email' },
        password: { label: '密码', type: 'password' },
        loginTicket: { label: '登录票据', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // 必须持有服务端签发的短期一次性票据，避免绕过验证码直连 NextAuth；票据消费后不可复用
        if (!(await consumeLoginTicket(credentials.loginTicket, credentials.email))) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.password) {
          return null
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)

        if (!isValid) {
          return null
        }

        const result: User & { sessionVersion: number } = {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          sessionVersion: user.sessionVersion ?? 0,
        }

        return result
      },
    }),
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
          }),
        ]
      : []),
    ...(process.env.GOOGLE_ID && process.env.GOOGLE_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_ID,
            clientSecret: process.env.GOOGLE_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'github' || account?.provider === 'google') {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        })

        if (!existingUser) {
          await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name,
              image: user.image,
            },
          })
        }
      }
      return true
    },
    async jwt({ token, user }) {
      const versioned = token as SessionVersionToken

      if (user) {
        // 新登录：把当前账号的会话版本写入 JWT
        versioned.sessionVersion =
          (user as User & { sessionVersion?: number }).sessionVersion ?? 0
        versioned.sessionVersionCheckedAt = Date.now()
        delete versioned.revoked
        return versioned
      }

      // 已判定失效的 token 不再回库，直接保持未认证
      if (versioned.revoked) {
        return versioned
      }

      // 本次改造前签发的旧 token 没有版本字段：视为已失效，但不抛错
      if (typeof versioned.sessionVersion !== 'number') {
        versioned.revoked = true
        return versioned
      }

      const lastCheck =
        typeof versioned.sessionVersionCheckedAt === 'number'
          ? versioned.sessionVersionCheckedAt
          : 0

      if (Date.now() - lastCheck < SESSION_VERSION_CHECK_INTERVAL_MS) {
        return versioned
      }

      if (!versioned.sub) {
        versioned.revoked = true
        return versioned
      }

      try {
        const current = await prisma.user.findUnique({
          where: { id: versioned.sub },
          select: { sessionVersion: true },
        })

        // 用户被删除：立即失效
        if (!current) {
          versioned.revoked = true
          return versioned
        }

        const currentVersion = current.sessionVersion ?? 0
        if (currentVersion !== versioned.sessionVersion) {
          // 密码重置后版本自增 → 所有旧会话失效
          versioned.revoked = true
          return versioned
        }

        versioned.sessionVersionCheckedAt = Date.now()
        return versioned
      } catch (error) {
        // 数据库故障时不误伤在线用户，保留本次会话，下次再核对
        console.error('Session version check failed:', error)
        return versioned
      }
    },
    async session({ session, token }) {
      const versioned = token as SessionVersionToken

      if (versioned.revoked) {
        // 返回 null 让 NextAuth 视为未登录：getServerSession 得到 null，useSession 表现为登出
        return null as unknown as Session
      }

      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
