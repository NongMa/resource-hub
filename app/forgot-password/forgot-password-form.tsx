'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CircleAlert, CircleCheck } from 'lucide-react'
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
import { EmailCodeField } from '@/components/EmailCodeField'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('密码长度至少为6位')
      return
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, emailCode: emailCode.trim() }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        setError(data?.error || '重置密码失败，请重试')
        return
      }

      setDone(true)
    } catch {
      setError('重置密码失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <Card className={authCardClass}>
        <CardHeader className="space-y-2 pb-4 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">重置密码</CardTitle>
          <CardDescription>通过邮箱验证码设置新密码</CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="space-y-4 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-foreground">
                <CircleCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>密码已重置，请使用新密码登录</span>
              </div>
              <Button asChild className={authSubmitClass}>
                <Link href="/login">去登录</Link>
              </Button>
            </div>
          ) : (
            <>
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
                <EmailCodeField
                  purpose="reset"
                  email={email}
                  value={emailCode}
                  onChange={setEmailCode}
                  onError={setError}
                  invalid={!!error}
                />
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder="新密码"
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
                    placeholder="确认新密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    aria-invalid={!!error}
                    className={authInputClass}
                  />
                </div>
                <Button type="submit" className={authSubmitClass} disabled={loading}>
                  {loading && <span className={authSpinnerClass} aria-hidden="true" />}
                  {loading ? '提交中...' : '重置密码'}
                </Button>
              </form>
              <div className={authFooterClass}>
                想起密码了?{' '}
                <Link href="/login" className={authLinkClass}>
                  返回登录
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
