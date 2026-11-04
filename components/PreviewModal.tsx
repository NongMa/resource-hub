'use client'

import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getFileType, formatFileSize } from '@/lib/utils'
import { getFileUrl } from '@/lib/qiniu'

interface PreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: {
    id: string
    name: string
    key: string
    size: number
    mimeType: string
  } | null
}

export function PreviewModal({ open, onOpenChange, file }: PreviewModalProps) {
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false)
      }
    }

    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onOpenChange])

  if (!file) return null

  const fileType = getFileType(file.mimeType)
  const fileUrl = getFileUrl(file.key)

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = file.name
    link.click()
  }

  const renderPreview = () => {
    switch (fileType) {
      case 'image':
        return (
          <div className="flex items-center justify-center bg-black/5 rounded-lg min-h-[300px]">
            {imageError ? (
              <p className="text-muted-foreground">无法加载图片</p>
            ) : (
              <img
                src={fileUrl}
                alt={file.name}
                className="max-w-full max-h-[70vh] object-contain"
                onError={() => setImageError(true)}
              />
            )}
          </div>
        )
      case 'video':
        return (
          <video
            src={fileUrl}
            controls
            className="max-w-full max-h-[70vh] rounded-lg"
          />
        )
      case 'audio':
        return (
          <div className="py-8">
            <audio src={fileUrl} controls className="w-full" />
          </div>
        )
      case 'document':
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">预览不支持此文件类型</p>
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              下载文件
            </Button>
          </div>
        )
      default:
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">预览不支持此文件类型</p>
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              下载文件
            </Button>
          </div>
        )
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="relative w-full max-w-4xl mx-4 bg-background rounded-lg shadow-xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="min-w-0 flex-1 mr-4">
            <h2 className="text-lg font-semibold truncate">{file.name}</h2>
            <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" />
              下载
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* 预览内容 */}
        <div className="p-4">{renderPreview()}</div>
      </div>
    </div>
  )
}
