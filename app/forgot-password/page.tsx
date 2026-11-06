import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import ForgotPasswordForm from './forgot-password-form'

export default async function ForgotPasswordPage() {
  // 已登录访问重置密码页时由服务端直接跳转，避免先渲染表单再在客户端跳走
  const session = await getServerSession(authOptions)
  if (session) {
    redirect('/')
  }

  return <ForgotPasswordForm />
}
