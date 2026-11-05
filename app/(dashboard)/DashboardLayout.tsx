'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Home,
  Folder,
  FolderOpen,
  Settings,
  LogOut,
  User,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    const fetchFolders = async () => {
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
    }

    if (status === 'authenticated') {
      fetchFolders()
    }
  }, [status])

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

  const rootFolders = folders.filter((f) => !f.parentId)

  return (
    <div className="min-h-screen flex">
      {/* 侧边栏 */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Folder className="h-6 w-6 text-primary" />
            ResourceHub
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Button
            variant={currentFolderId === null ? 'secondary' : 'ghost'}
            className="w-full justify-start"
            onClick={() => onNavigateToFolder(null)}
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
                  <Button
                    key={folder.id}
                    variant={currentFolderId === folder.id ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => onNavigateToFolder(folder.id)}
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    <span className="truncate">{folder.name}</span>
                  </Button>
                ))}
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
          <Button variant="outline" className="w-full" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            退出登录
          </Button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
