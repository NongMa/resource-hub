'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmailCodeField } from '@/components/EmailCodeField'
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
  const [inviteCode, setInviteCode] = useState('')
  const [emailCode, setEmailCode] = useState('')
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
        body: JSON.stringify({
          name,
          email,
          password,
          inviteCode: inviteCode.trim(),
          emailCode: emailCode.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(
          res.status === 409
            ? '该邮箱已被注册，请直接登录，或使用「忘记密码」重置密码'
            : data.error || '注册失败'
        )
        return
      }

      // 服务端未签发票据（例如该邮箱已有失败记录）时，明确提示去登录页登录，不假装已登录
      if (!data.loginToken) {
        setError(data.message || '账号已创建，请前往登录页登录')
        return
      }

      // 用一次性登录票据建立 NextAuth 会话
      try {
        const result = await signIn('credentials', {
          email,
          password,
          loginTicket: data.loginToken,
          redirect: false,
        })

        if (result?.error) {
          setError('账号已创建，但自动登录失败，请前往登录页登录')
          return
        }

        router.push('/')
        router.refresh()
      } catch {
        setError('账号已创建，但自动登录失败，请前往登录页登录')
      }
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
                placeholder="授权码"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!error}
                className={authInputClass}
              />
            </div>
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
            <EmailCodeField
              purpose="register"
              email={email}
              value={emailCode}
              onChange={setEmailCode}
              onError={setError}
              invalid={!!error}
            />
            <p className="text-xs text-muted-foreground">
              该邮箱已注册？请直接{' '}
              <Link href="/login" className={authLinkClass}>
                登录
              </Link>
              ，或使用{' '}
              <Link href="/forgot-password" className={authLinkClass}>
                忘记密码
              </Link>
            </p>
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
