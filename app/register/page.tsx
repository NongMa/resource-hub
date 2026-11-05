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

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    if (password.length < 6) {
      setError('密码长度至少为6位')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '注册失败')
        return
      }

      // 注册成功后自动登录
      await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      router.push('/')
      router.refresh()
    } catch (err) {
      setError('注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <Card className={authCardClass}>
        <CardHeader className="space-y-2 pb-4 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">注册</CardTitle>
          <CardDescription>创建一个新账号</CardDescription>
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
                type="text"
                placeholder="昵称（可选）"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!error}
                className={authInputClass}
              />
            </div>
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
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="确认密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                aria-invalid={!!error}
                className={authInputClass}
              />
            </div>
            <Button type="submit" className={authSubmitClass} disabled={loading}>
              {loading && <span className={authSpinnerClass} aria-hidden="true" />}
              {loading ? '注册中...' : '注册'}
            </Button>
          </form>
          <div className={authFooterClass}>
            已有账号?{' '}
            <Link href="/login" className={authLinkClass}>
              登录
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
