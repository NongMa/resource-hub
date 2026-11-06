import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import LoginForm from './login-form'

export default async function LoginPage() {
  // 已登录访问登录页时由服务端直接跳转，避免先渲染表单再在客户端跳走
  const session = await getServerSession(authOptions)
  if (session) {
    redirect('/')
  }

  return <LoginForm />
}
