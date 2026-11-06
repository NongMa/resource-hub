'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authInputClass } from '@/components/AuthLayout'

type Purpose = 'register' | 'reset'

type Props = {
  purpose: Purpose
  email: string
  value: string
  onChange: (value: string) => void
  onError: (message: string) => void
  invalid?: boolean
}

/**
 * 邮箱验证码输入 + 发送按钮（60 秒倒计时），注册与重置密码共用。
 */
export function EmailCodeField({ purpose, email, value, onChange, onError, invalid }: Props) {
  const [sending, setSending] = useState(false)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((current) => current - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleSend = async () => {
    if (!email.trim()) {
      onError('请先填写邮箱')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/auth/email-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose }),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        // 按真实状态码提示：优先用后端 error，缺省时带上 HTTP 状态码，并追加可操作的 hint
        const message = data?.error || `验证码发送失败（HTTP ${res.status}），请稍后重试`
        const hint = typeof data?.hint === 'string' && data.hint ? ` ${data.hint}` : ''
        onError(`${message}${hint}`)
        if (typeof data?.retryAfter === 'number') {
          setCountdown(data.retryAfter)
        }
        return
      }

      const wait = typeof data?.resendAfter === 'number' ? data.resendAfter : 60
      setCountdown(wait)
    } catch {
      onError('验证码发送失败，请稍后重试')
    } finally {
      setSending(false)
    }
  }

  const disabled = sending || countdown > 0

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="text"
          placeholder="邮箱验证码"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          required
          maxLength={6}
          inputMode="numeric"
          autoComplete="one-time-code"
          spellCheck={false}
          aria-invalid={invalid}
          className={`${authInputClass} min-w-0 flex-1`}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleSend()}
          disabled={disabled}
          className="h-11 shrink-0 whitespace-nowrap px-3 text-sm sm:px-4"
        >
          {countdown > 0 ? `${countdown}s 后重发` : sending ? '发送中...' : '发送验证码'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        请查收邮箱中的 6 位验证码，10 分钟内有效，60 秒后可重发
      </p>
    </div>
  )
}
