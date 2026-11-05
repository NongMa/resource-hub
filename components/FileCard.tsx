'use client'

import { File, Image, Video, Music, FileText, MoreVertical, Download, Share2, Trash2, Eye, Edit } from 'lucide-react'
import { formatFileSize, getFileType } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useState } from 'react'

interface FileCardFile {
  id: string
  name: string
  key: string
  size: number
  mimeType: string
  createdAt: string
  url: string
}

interface FileCardProps {
  file: FileCardFile
  onPreview: (file: FileCardFile) => void
  onShare: (file: FileCardFile) => void
  onDelete: (file: FileCardFile) => void
  onRename: (file: FileCardFile) => void
}

export function FileCard({ file, onPreview, onShare, onDelete, onRename }: FileCardProps) {
  const [imageError, setImageError] = useState(false)
  const fileType = getFileType(file.mimeType)

  const getIcon = () => {
    switch (fileType) {
      case 'image':
        return <Image className="h-12 w-12 text-green-500" />
      case 'video':
        return <Video className="h-12 w-12 text-purple-500" />
      case 'audio':
        return <Music className="h-12 w-12 text-orange-500" />
      case 'document':
        return <FileText className="h-12 w-12 text-blue-500" />
      default:
        return <File className="h-12 w-12 text-gray-500" />
    }
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = file.url
    link.download = file.name
    link.click()
  }

  return (
    <Card className="group relative overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-square flex items-center justify-center bg-muted/50 p-4">
        {fileType === 'image' && !imageError ? (
          <img
            src={file.url}
            alt={file.name}
            className="max-h-full max-w-full object-contain"
            onError={() => setImageError(true)}
          />
        ) : (
          getIcon()
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" title={file.name}>
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onPreview(file)}>
                <Eye className="mr-2 h-4 w-4" />
                预览
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                下载
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onShare(file)}>
                <Share2 className="mr-2 h-4 w-4" />
                分享
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRename(file)}>
                <Edit className="mr-2 h-4 w-4" />
                重命名
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(file)} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  )
}
