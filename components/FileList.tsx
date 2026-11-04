'use client'

import { useState } from 'react'
import { FolderPlus, Grid3X3, List, Search, SortAsc } from 'lucide-react'
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
import { cn } from '@/lib/utils'

interface FileListProps {
  files: Array<{
    id: string
    name: string
    key: string
    size: number
    mimeType: string
    createdAt: string
  }>
  folderId?: string | null
  onCreateFolder: (name: string, parentId?: string) => void
  onRefresh: () => void
  onPreview: (file: FileListProps['files'][0]) => void
  onShare: (file: FileListProps['files'][0]) => void
  onDelete: (file: FileListProps['files'][0]) => void
  onRename: (file: FileListProps['files'][0]) => void
  onNavigateToFolder: (folderId: string) => void
}

export function FileList({
  files,
  folderId,
  onCreateFolder,
  onRefresh,
  onPreview,
  onShare,
  onDelete,
  onRename,
  onNavigateToFolder,
}: FileListProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), folderId || undefined)
      setNewFolderName('')
      setShowNewFolderDialog(false)
    }
  }

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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowNewFolderDialog(true)}>
            <FolderPlus className="h-4 w-4 mr-1" />
            新建文件夹
          </Button>
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 上传区域 */}
      <FileUpload folderId={folderId} onUploadComplete={onRefresh} />

      {/* 文件列表 */}
      {filteredFiles.length > 0 ? (
        <div className={cn('grid gap-4', viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5' : '')}>
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
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>暂无文件</p>
          <p className="text-sm">上传文件或创建文件夹开始使用</p>
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
