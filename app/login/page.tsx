'use client'

import { signIn } from 'next-auth/react'
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CircleAlert, RefreshCw } from 'lucide-react'
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

type CaptchaState = { id: string; svg: string }

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [captcha, setCaptcha] = useState<CaptchaState | null>(null)
  const [captchaCode, setCaptchaCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const refreshCaptcha = useCallback(async () => {
    try {
      const res = await fetch(`/api/auth/captcha?t=${Date.now()}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok && data?.id && data?.svg) {
        setCaptcha({ id: data.id, svg: data.svg })
        setCaptchaCode('')
      }
    } catch {
      // 验证码加载失败时保留旧图，用户可再次点击刷新
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 先走服务端登录校验（失败计数 / 验证码），拿到短期票据后再建立 NextAuth 会话
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          captchaId: captcha?.id,
          captchaCode,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '登录失败，请重试')
        if (data.captchaRequired) {
          const needNewImage =
            !captcha ||
            data.code === 'CAPTCHA_INVALID' ||
            data.code === 'CAPTCHA_EXPIRED' ||
            data.code === 'INVALID_CREDENTIALS' ||
            data.code === 'TOO_MANY_ATTEMPTS'
          if (needNewImage) {
            void refreshCaptcha()
          }
        }
        return
      }

      const result = await signIn('credentials', {
        email,
        password,
        loginToken: data.loginToken,
        redirect: false,
      })

      if (result?.error) {
        setError('登录失败，请重试')
      } else {
        router.push('/')
        router.refresh()
      }
    } catch {
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
            {captcha && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    className="shrink-0 overflow-hidden rounded-md border border-border bg-muted/40"
                    // SVG 由本服务生成，内容可控；答案不以文本形式出现在图片中
                    dangerouslySetInnerHTML={{ __html: captcha.svg }}
                  />
                  <Input
                    type="text"
                    placeholder="验证码"
                    value={captchaCode}
                    onChange={(e) => setCaptchaCode(e.target.value)}
                    required
                    maxLength={5}
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={!!error}
                    className={`${authInputClass} min-w-0 flex-1`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => void refreshCaptcha()}
                    aria-label="刷新验证码"
                    title="刷新验证码"
                    className="shrink-0"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  请输入图片中的 5 位数字，看不清可点击右侧按钮刷新
                </p>
              </div>
            )}
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
          <div className="mt-2 text-center text-sm text-muted-foreground">
            <Link href="/forgot-password" className={authLinkClass}>
              忘记密码?
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
