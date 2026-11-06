import type { ReactNode } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'

export const authCardClass =
  'auth-card-in w-full max-w-md border-border/60 bg-card/85 shadow-2xl shadow-primary/10 backdrop-blur-md supports-[backdrop-filter]:bg-card/65'

export const authInputClass =
  'h-11 border-border/70 bg-background/70 transition-[border-color,box-shadow] duration-200 hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/25 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/30'

export const authSubmitClass =
  'h-11 w-full gap-2 shadow-lg shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30 active:scale-[0.985] motion-reduce:active:scale-100'

export const authErrorClass =
  'flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive'

export const authFooterClass = 'mt-5 text-center text-sm text-muted-foreground'

export const authLinkClass =
  'font-medium text-primary transition-colors hover:text-primary/80 hover:underline'

export const authSpinnerClass =
  'h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground motion-reduce:animate-none'

/**
 * 品牌 Logo：内联 SVG（叠层文档），无外部图片资源
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="资料管家"
      fill="none"
    >
      <defs>
        <linearGradient id="brand-logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.62" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#brand-logo-gradient)" />
      {/* 后方叠层文档 */}
      <rect x="12" y="18" width="15" height="20" rx="3" fill="hsl(var(--primary-foreground))" opacity="0.25" />
      <rect x="15.5" y="15" width="15" height="20" rx="3" fill="hsl(var(--primary-foreground))" opacity="0.4" />
      {/* 前方文档 + 折角 */}
      <path
        d="M23 9h9l7 7v17a3 3 0 0 1-3 3H23a3 3 0 0 1-3-3V12a3 3 0 0 1 3-3Z"
        fill="hsl(var(--primary-foreground))"
      />
      <path
        d="M31.5 9.5v6.5h6.5"
        stroke="hsl(var(--primary))"
        strokeOpacity="0.45"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* 文档内容线 */}
      <rect x="24" y="21" width="9" height="2.2" rx="1.1" fill="hsl(var(--primary))" opacity="0.55" />
      <rect x="24" y="26" width="6.5" height="2.2" rx="1.1" fill="hsl(var(--primary))" opacity="0.55" />
    </svg>
  )
}

/**
 * 登录 / 注册页共用外壳：渐变背景 + 光晕 + 网格 + 噪点，全部为 CSS 生成
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-bg relative min-h-screen overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="auth-grid auth-drift absolute -inset-8" />
        <div className="auth-float absolute -left-24 top-8 h-64 w-64 rounded-full bg-primary/20 blur-3xl sm:h-80 sm:w-80" />
        <div className="auth-float-slow absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl sm:h-96 sm:w-96" />
        <div className="auth-breathe absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-indigo-400/15 blur-3xl" />
        <div className="auth-noise absolute inset-0 opacity-[0.035]" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-background/70 to-transparent" />
      </div>

      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle className="bg-card/70 backdrop-blur-md" />
      </div>

      <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10 sm:px-6">
        <div className="auth-card-in flex items-center gap-3">
          <BrandLogo className="h-12 w-12 shrink-0" />
          <span className="text-xl font-semibold tracking-tight text-foreground">资料管家</span>
        </div>
        {children}
      </div>
    </div>
  )
}
