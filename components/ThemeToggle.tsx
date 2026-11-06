'use client'

import { useCallback } from 'react'
import { cn } from '@/lib/utils'

const THEME_STORAGE_KEY = 'theme'

/**
 * 浅色 / 深色主题切换按钮（无第三方依赖）
 * - 使用 html 上的 .dark 类 + localStorage 持久化
 * - 图标用 CSS 根据 .dark 切换，避免首帧状态不一致
 */
export function ThemeToggle({ className }: { className?: string }) {
  const toggleTheme = useCallback(() => {
    const root = document.documentElement
    const isDark = root.classList.contains('dark')
    const next = isDark ? 'light' : 'dark'

    root.classList.toggle('dark', next === 'dark')
    root.style.colorScheme = next
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // 隐私模式等场景下 localStorage 不可用，忽略即可
    }
  }, [])

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="切换浅色/深色主题"
      title="切换浅色/深色主题"
      className={cn(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-background/70 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
    >
      {/* 浅色模式下显示月亮：点击切到深色 */}
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 dark:hidden"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
      </svg>
      {/* 深色模式下显示太阳：点击切到浅色 */}
      <svg
        viewBox="0 0 24 24"
        className="hidden h-4 w-4 dark:block"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    </button>
  )
}
