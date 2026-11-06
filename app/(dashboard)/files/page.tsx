'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [files, setFiles] = useState<FileItem[]>([])
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
    [currentFolderId, pageSize]
  )

  // 目录 / 每页条数 / 视图切换时重置到第一页
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

  const handleShare = async (fileId: string, expiresIn: number | null) => {
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, expiresIn }),
      })
      if (res.ok) {
        const data = await res.json()
        // 显示分享链接
        alert(`分享链接: ${data.url}`)
      }
    } catch (error) {
      console.error('Share error:', error)
    }
  }

  const handleNavigateToFolder = (folderId: string | null) => {
    setCurrentFolderId(folderId)
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
    <DashboardLayout currentFolderId={currentFolderId} onNavigateToFolder={handleNavigateToFolder}>
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">我的文件</h2>
          <p className="text-muted-foreground">管理您的文件资源</p>
        </div>

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
          onNavigateToFolder={handleNavigateToFolder}
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
