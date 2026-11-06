'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  Home,
  Folder,
  FolderOpen,
  Settings,
  LogOut,
  User,
  Menu,
  X,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'

interface FolderItem {
  id: string
  name: string
  parentId: string | null
}

interface DashboardLayoutProps {
  children: React.ReactNode
  currentFolderId: string | null
  onNavigateToFolder: (folderId: string | null) => void
}

export function DashboardLayout({
  children,
  currentFolderId,
  onNavigateToFolder,
}: DashboardLayoutProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [folderError, setFolderError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // 移动端抽屉：Esc 关闭
  useEffect(() => {
    if (!sidebarOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [sidebarOpen])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const fetchFolders = useCallback(async () => {
    try {
      const res = await fetch('/api/folders')
      if (res.ok) {
        const data = await res.json()
        setFolders(data)
      }
    } catch (error) {
      console.error('Fetch folders error:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchFolders()
    }
  }, [status, fetchFolders])

  const handleDeleteFolder = async (folder: FolderItem) => {
    if (!confirm(`确定要删除文件夹「${folder.name}」吗？`)) return

    setFolderError('')
    try {
      const res = await fetch(`/api/folders?id=${folder.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        // 优先展示服务端返回的具体原因（如文件夹非空）
        setFolderError(data?.detail || data?.error || '删除文件夹失败')
        return
      }

      if (currentFolderId === folder.id) {
        onNavigateToFolder(null)
      }
      fetchFolders()
    } catch (error) {
      console.error('Delete folder error:', error)
      setFolderError('删除文件夹失败，请稍后重试')
    }
  }

  const handleSignOut = async () => {
    await signOut({ redirect: true, callbackUrl: '/login' })
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">加载中...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const handleNavigate = (folderId: string | null) => {
    onNavigateToFolder(folderId)
    setSidebarOpen(false)
  }

  const rootFolders = folders.filter((f) => !f.parentId)

  return (
    <div className="min-h-screen flex">
      {/* 移动端顶栏 */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background/95 px-3 backdrop-blur lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(true)}
          aria-label="打开侧边栏"
          title="打开侧边栏"
          aria-expanded={sidebarOpen}
          aria-controls="app-sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <Folder className="h-5 w-5 shrink-0 text-primary" />
          <span className="truncate">ResourceHub</span>
        </span>
        <ThemeToggle />
      </header>

      {/* 抽屉遮罩 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 侧边栏：窄屏为抽屉，宽屏固定 */}
      <aside
        id="app-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-4 border-b">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Folder className="h-6 w-6 text-primary" />
              ResourceHub
            </h1>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="关闭侧边栏"
              title="关闭侧边栏"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          <Button
            variant={currentFolderId === null ? 'secondary' : 'ghost'}
            className="w-full justify-start"
            onClick={() => handleNavigate(null)}
          >
            <Home className="h-4 w-4 mr-2" />
            我的文件
          </Button>

          <div className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">文件夹</span>
            </div>
            {loading ? (
              <div className="text-sm text-muted-foreground">加载中...</div>
            ) : rootFolders.length > 0 ? (
              <div className="space-y-1">
                {rootFolders.map((folder) => (
                  <div key={folder.id} className="flex items-center gap-1">
                    <Button
                      variant={currentFolderId === folder.id ? 'secondary' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => handleNavigate(folder.id)}
                    >
                      <FolderOpen className="h-4 w-4 mr-2 shrink-0" />
                      <span className="truncate">{folder.name}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteFolder(folder)}
                      aria-label={`删除文件夹 ${folder.name}`}
                      title={`删除文件夹 ${folder.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {folderError && (
                  <p
                    role="alert"
                    className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs leading-relaxed text-destructive"
                  >
                    {folderError}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">暂无文件夹</div>
            )}
          </div>
        </nav>

        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              {session.user?.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || ''}
                  className="h-10 w-10 rounded-full"
                />
              ) : (
                <User className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session.user?.name || '用户'}</p>
              <p className="text-xs text-muted-foreground truncate">{session.user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              退出登录
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="p-4 pt-20 sm:p-6 lg:pt-6">{children}</div>
      </main>
    </div>
  )
}
