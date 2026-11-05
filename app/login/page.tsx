'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AuthLayout,
  authCardClass,
  authErrorClass,
  authFooterClass,
  authInputClass,
  authLinkClass,
  authSpinnerClass,
  authSubmitClass,
} from '@/components/AuthLayout'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('邮箱或密码错误')
      } else {
        router.push('/')
        router.refresh()
      }
    } catch (err) {
      setError('登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <Card className={authCardClass}>
        <CardHeader className="space-y-2 pb-4 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">登录</CardTitle>
          <CardDescription>输入您的邮箱和密码以继续</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" className={authErrorClass}>
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-invalid={!!error}
                className={authInputClass}
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-invalid={!!error}
                className={authInputClass}
              />
            </div>
            <Button type="submit" className={authSubmitClass} disabled={loading}>
              {loading && <span className={authSpinnerClass} aria-hidden="true" />}
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>
          <div className={authFooterClass}>
            还没有账号?{' '}
            <Link href="/register" className={authLinkClass}>
              注册
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
