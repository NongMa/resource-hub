'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { DashboardLayout } from '../DashboardLayout'
import { FileList } from '@/components/FileList'
import { PreviewModal } from '@/components/PreviewModal'
import { ShareModal } from '@/components/ShareModal'

interface FileItem {
  id: string
  name: string
  key: string
  size: number
  mimeType: string
  createdAt: string
  url: string
  thumbnailUrl?: string
  previewUrl?: string
  smallUrl?: string
}

interface FolderItem {
  id: string
  name: string
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [subfolders, setSubfolders] = useState<FolderItem[]>([])
  // 当前层级的进入路径，用于面包屑；仅前端状态，刷新后回到根目录
  const [folderTrail, setFolderTrail] = useState<FolderItem[]>([])
  const [files, setFiles] = useState<FileItem[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const loadingMoreRef = useRef(false)
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)
  const [shareFile, setShareFile] = useState<{ id: string; name: string } | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)

  const loadFiles = useCallback(
    async (targetPage: number, options: { append?: boolean; size?: number } = {}) => {
      const append = !!options.append

      // 追加加载用 ref 兜底，避免滚动监听连续触发导致重复请求
      if (append) {
        if (loadingMoreRef.current) return
        loadingMoreRef.current = true
        setLoadingMore(true)
      } else {
        setLoading(true)
      }

      try {
        const url = new URL('/api/files', window.location.origin)
        url.searchParams.set('page', String(targetPage))
        url.searchParams.set('pageSize', String(options.size ?? pageSize))
        if (currentFolderId) {
          url.searchParams.set('folderId', currentFolderId)
        }
        if (searchQuery) {
          url.searchParams.set('q', searchQuery)
        }

        const res = await fetch(url.toString())
        if (!res.ok) return

        const data = await res.json()
        setFiles((prev) => {
          if (!append) return data.files

          // 按 id 去重，避免翻页期间数据变化造成重复条目
          const seen = new Set(prev.map((item) => item.id))
          return [...prev, ...data.files.filter((item: FileItem) => !seen.has(item.id))]
        })
        setPage(data.page)
        setTotal(data.total)
        setHasMore(data.hasMore)
      } catch (error) {
        console.error('Fetch files error:', error)
      } finally {
        if (append) {
          loadingMoreRef.current = false
          setLoadingMore(false)
        } else {
          setLoading(false)
        }
      }
    },
    [currentFolderId, pageSize, searchQuery]
  )

  // 拉取当前层级的子文件夹（GET /api/folders 支持 parentId，无需新增接口）
  const loadSubfolders = useCallback(async () => {
    try {
      const url = new URL('/api/folders', window.location.origin)
      if (currentFolderId) {
        url.searchParams.set('parentId', currentFolderId)
      }
      const res = await fetch(url.toString())
      if (!res.ok) return

      const data = await res.json()
      setSubfolders(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Fetch folders error:', error)
    }
  }, [currentFolderId])

  useEffect(() => {
    if (status === 'authenticated') {
      loadSubfolders()
    }
  }, [status, loadSubfolders])

  // 输入防抖 300ms：停止输入后再发起服务端搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim())
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  // 目录 / 每页条数 / 视图切换 / 搜索条件变化时重置到第一页
  useEffect(() => {
    if (status === 'authenticated') {
      loadFiles(1)
    }
  }, [status, loadFiles, currentFolderId, pageSize, viewMode])

  const reload = useCallback(() => {
    // 网格已累积多页，刷新时回到第一页；列表按当前页刷新
    loadFiles(viewMode === 'list' ? page : 1)
  }, [loadFiles, viewMode, page])

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loading || loadingMoreRef.current) return
    loadFiles(page + 1, { append: true })
  }, [hasMore, loading, page, loadFiles])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const handleCreateFolder = async (name: string, parentId?: string) => {
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId }),
      })
      if (res.ok) {
        reload()
        // 新建的可能是当前层级的子文件夹，需同步刷新文件夹卡片
        loadSubfolders()
      }
    } catch (error) {
      console.error('Create folder error:', error)
    }
  }

  const handleDeleteFile = async (file: FileItem) => {
    if (!confirm(`确定要删除 "${file.name}" 吗？`)) return

    try {
      const res = await fetch(`/api/files?id=${file.id}`, { method: 'DELETE' })
      if (res.ok) {
        reload()
      }
    } catch (error) {
      console.error('Delete file error:', error)
    }
  }

  const handleRenameFile = async (file: FileItem) => {
    const newName = prompt('请输入新名称:', file.name)
    if (!newName || newName === file.name) return

    // TODO: 实现重命名API
    alert('重命名功能开发中')
  }

  const handleShare = async (
    fileId: string,
    expiresIn: number | null
  ): Promise<{ url: string } | null> => {
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, expiresIn }),
      })
      if (!res.ok) {
        console.error('Share error:', res.status)
        return null
      }

      const data = await res.json()
      // 由分享弹层展示服务端返回的真实链接
      return data.url ? { url: data.url as string } : null
    } catch (error) {
      console.error('Share error:', error)
      return null
    }
  }

  // 侧栏只列出根文件夹：进入时重置为单层路径
  const handleSidebarNavigateToFolder = (folderId: string | null, folderName?: string) => {
    setFolderTrail(folderId ? [{ id: folderId, name: folderName || '文件夹' }] : [])
    setCurrentFolderId(folderId)
    setSearchInput('')
    setSearchQuery('')
  }

  // 主区点击文件夹卡片：进入下一层
  const handleOpenSubfolder = (folder: FolderItem) => {
    setFolderTrail((prev) => [...prev, folder])
    setCurrentFolderId(folder.id)
    setSearchInput('')
    setSearchQuery('')
  }

  // 面包屑跳转：index = -1 表示根目录
  const handleBreadcrumbClick = (index: number) => {
    if (index < 0) {
      setFolderTrail([])
      setCurrentFolderId(null)
    } else {
      const target = folderTrail[index]
      if (!target) return
      setFolderTrail(folderTrail.slice(0, index + 1))
      setCurrentFolderId(target.id)
    }
    setSearchInput('')
    setSearchQuery('')
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

  return (
    <DashboardLayout currentFolderId={currentFolderId} onNavigateToFolder={handleSidebarNavigateToFolder}>
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">我的文件</h2>
          <p className="text-muted-foreground">管理您的文件资源</p>
        </div>

        {/* 面包屑：根目录 + 逐层进入路径，窄屏可横向换行 */}
        <nav aria-label="当前位置" className="flex flex-wrap items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => handleBreadcrumbClick(-1)}
            aria-current={folderTrail.length === 0 ? 'page' : undefined}
            className={
              folderTrail.length === 0
                ? 'font-medium text-foreground'
                : 'text-muted-foreground transition-colors hover:text-foreground'
            }
          >
            我的文件
          </button>
          {folderTrail.map((folder, index) => (
            <span key={folder.id} className="flex min-w-0 items-center gap-1">
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <button
                type="button"
                onClick={() => handleBreadcrumbClick(index)}
                aria-current={index === folderTrail.length - 1 ? 'page' : undefined}
                className={
                  index === folderTrail.length - 1
                    ? 'max-w-[16rem] truncate font-medium text-foreground'
                    : 'max-w-[12rem] truncate text-muted-foreground transition-colors hover:text-foreground'
                }
                title={folder.name}
              >
                {folder.name}
              </button>
            </span>
          ))}
        </nav>

        <FileList
          files={files}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          total={total}
          page={page}
          pageSize={pageSize}
          viewMode={viewMode}
          folderId={currentFolderId}
          folders={subfolders}
          searchQuery={searchInput}
          onSearchQueryChange={setSearchInput}
          onCreateFolder={handleCreateFolder}
          onRefresh={reload}
          onViewModeChange={setViewMode}
          onPageChange={(nextPage) => loadFiles(nextPage)}
          onPageSizeChange={(nextSize) => setPageSize(nextSize)}
          onLoadMore={handleLoadMore}
          onPreview={(file) => setPreviewFile(file)}
          onShare={(file) => {
            setShareFile({ id: file.id, name: file.name })
            setShowShareModal(true)
          }}
          onDelete={handleDeleteFile}
          onRename={handleRenameFile}
          onNavigateToFolder={handleOpenSubfolder}
        />
      </div>

      <PreviewModal
        open={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
        file={previewFile}
      />

      <ShareModal
        open={showShareModal}
        onOpenChange={setShowShareModal}
        file={shareFile}
        onShare={handleShare}
      />
    </DashboardLayout>
  )
}
