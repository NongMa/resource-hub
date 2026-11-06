'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Download,
  Eye,
  File,
  FileText,
  FolderPlus,
  Grid3X3,
  Image as ImageIcon,
  List as ListIcon,
  Music,
  Search,
  Trash2,
  Video,
} from 'lucide-react'
import { FileCard } from '@/components/FileCard'
import { FileUpload } from '@/components/FileUpload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn, formatFileSize, getFileType } from '@/lib/utils'

type FileItem = {
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

type ViewMode = 'grid' | 'list'

interface FileListProps {
  files: FileItem[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  total: number
  page: number
  pageSize: number
  viewMode: ViewMode
  folderId?: string | null
  onCreateFolder: (name: string, parentId?: string) => void
  onRefresh: () => void
  onViewModeChange: (mode: ViewMode) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onLoadMore: () => void
  onPreview: (file: FileItem) => void
  onShare: (file: FileItem) => void
  onDelete: (file: FileItem) => void
  onRename: (file: FileItem) => void
  onNavigateToFolder: (folderId: string) => void
}

const TYPE_LABELS: Record<string, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
  document: '文档',
  other: '其他',
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function RowThumb({ file }: { file: FileItem }) {
  const [error, setError] = useState(false)
  const type = getFileType(file.mimeType)

  if (type === 'image' && !error) {
    return (
      <img
        src={file.thumbnailUrl ?? file.url}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-8 w-8 shrink-0 rounded object-cover"
        onError={() => setError(true)}
      />
    )
  }

  const Icon =
    type === 'video'
      ? Video
      : type === 'audio'
        ? Music
        : type === 'document'
          ? FileText
          : type === 'image'
            ? ImageIcon
            : File

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
      <Icon className="h-4 w-4 text-muted-foreground" />
    </span>
  )
}

export function FileList({
  files,
  loading,
  loadingMore,
  hasMore,
  total,
  page,
  pageSize,
  viewMode,
  folderId,
  onCreateFolder,
  onRefresh,
  onViewModeChange,
  onPageChange,
  onPageSizeChange,
  onLoadMore,
  onPreview,
  onShare,
  onDelete,
  onRename,
  onNavigateToFolder,
}: FileListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // 网格视图：滚动到底部自动加载下一页
  useEffect(() => {
    if (viewMode !== 'grid' || !hasMore) return

    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [viewMode, hasMore, onLoadMore, files.length])

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), folderId || undefined)
      setNewFolderName('')
      setShowNewFolderDialog(false)
    }
  }

  const handleDownload = (file: FileItem) => {
    const link = document.createElement('a')
    link.href = file.url
    link.download = file.name
    link.click()
  }

  const renderTable = () => (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th scope="col" className="px-2 py-2 text-left font-medium sm:px-3">
                文件名
              </th>
              <th scope="col" className="hidden px-3 py-2 text-left font-medium sm:table-cell">
                类型
              </th>
              <th scope="col" className="px-2 py-2 text-left font-medium whitespace-nowrap sm:px-3">
                大小
              </th>
              <th scope="col" className="hidden px-3 py-2 text-left font-medium md:table-cell">
                时间
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium sm:px-3">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredFiles.map((file) => (
              <tr key={file.id} className="border-t transition-colors hover:bg-muted/40">
                <td className="px-2 py-1.5 sm:px-3">
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-2 text-left"
                    onClick={() => onPreview(file)}
                    title={file.name}
                  >
                    <RowThumb file={file} />
                    <span className="max-w-[120px] truncate sm:max-w-[320px] lg:max-w-[420px]">
                      {file.name}
                    </span>
                  </button>
                </td>
                <td className="hidden px-3 py-1.5 text-muted-foreground sm:table-cell">
                  {TYPE_LABELS[getFileType(file.mimeType)]}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground sm:px-3">
                  {formatFileSize(file.size)}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-1.5 text-muted-foreground md:table-cell">
                  {formatDateTime(file.createdAt)}
                </td>
                <td className="px-2 py-1.5 sm:px-3">
                  <div className="flex items-center justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 sm:h-8 sm:w-8"
                      onClick={() => onPreview(file)}
                      aria-label={`预览 ${file.name}`}
                      title="预览"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 sm:h-8 sm:w-8"
                      onClick={() => handleDownload(file)}
                      aria-label={`下载 ${file.name}`}
                      title="下载"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive sm:h-8 sm:w-8"
                      onClick={() => onDelete(file)}
                      aria-label={`删除 ${file.name}`}
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">共 {total} 个文件</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="每页条数"
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          >
            <option value={20}>20 / 页</option>
            <option value={50}>50 / 页</option>
            <option value={100}>100 / 页</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            第 {page} / {totalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasMore || loading}
            onClick={() => onPageChange(page + 1)}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  )

  const renderGrid = () => (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {filteredFiles.map((file) => (
          <FileCard
            key={file.id}
            file={file}
            onPreview={onPreview}
            onShare={onShare}
            onDelete={onDelete}
            onRename={onRename}
          />
        ))}
      </div>

      {/* 触底哨兵：加载更多 / 到底提示 */}
      <div
        ref={sentinelRef}
        className="py-4 text-center text-sm text-muted-foreground"
        aria-live="polite"
      >
        {loadingMore
          ? '加载中…'
          : hasMore
            ? `已加载 ${files.length} / ${total}，继续滚动加载`
            : files.length > 0
              ? '已经到底了'
              : null}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索文件..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowNewFolderDialog(true)}>
            <FolderPlus className="h-4 w-4 mr-1" />
            新建文件夹
          </Button>
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('grid')}
              aria-label="网格视图"
              title="网格视图"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('list')}
              aria-label="列表视图"
              title="列表视图"
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 上传区域 */}
      <FileUpload folderId={folderId} onUploadComplete={onRefresh} />

      {/* 文件列表 */}
      {loading && files.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">加载中...</div>
      ) : filteredFiles.length > 0 ? (
        viewMode === 'grid' ? (
          renderGrid()
        ) : (
          renderTable()
        )
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>{searchQuery ? '没有匹配的文件' : '暂无文件'}</p>
          <p className="text-sm">
            {searchQuery ? '试试其他关键词' : '上传文件或创建文件夹开始使用'}
          </p>
        </div>
      )}

      {/* 新建文件夹对话框 */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建文件夹</DialogTitle>
            <DialogDescription>输入文件夹名称</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="文件夹名称"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreateFolder}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
