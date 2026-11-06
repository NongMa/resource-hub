'use client'

import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getFileType, formatFileSize } from '@/lib/utils'

interface PreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: {
    id: string
    name: string
    key: string
    size: number
    mimeType: string
    url: string
    downloadUrl?: string
    thumbnailUrl?: string
    previewUrl?: string
    smallUrl?: string
  } | null
}

type ImageVersion = 'original' | 'slim' | 'small'

export function PreviewModal({ open, onOpenChange, file }: PreviewModalProps) {
  const [imageError, setImageError] = useState(false)
  const [imageVersion, setImageVersion] = useState<ImageVersion>('slim')

  // 切换文件时回到默认的瘦身版
  useEffect(() => {
    setImageVersion('slim')
  }, [file?.id])

  // 切换版本或文件时重置加载失败状态
  useEffect(() => {
    setImageError(false)
  }, [file?.id, imageVersion])

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
  const fileUrl = file.url

  // 图片预览默认走瘦身版，可切换原图 / 更小尺寸；非图片始终用原图地址
  const versionUrls: Record<ImageVersion, string> = {
    original: file.url,
    slim: file.previewUrl ?? file.url,
    small: file.smallUrl ?? file.url,
  }
  const imageUrl = versionUrls[imageVersion]
  const hasImageVariants = fileType === 'image' && !!file.previewUrl

  const versionOptions: Array<{ key: ImageVersion; label: string }> = [
    { key: 'original', label: '原图' },
    ...(file.previewUrl ? [{ key: 'slim' as const, label: '瘦身' }] : []),
    ...(file.smallUrl ? [{ key: 'small' as const, label: '更小' }] : []),
  ]

  const handleDownload = () => {
    // 预览用 url（可内联展示），下载必须用带 attname 的 downloadUrl
    const link = document.createElement('a')
    link.href = file.downloadUrl ?? fileUrl
    link.download = file.name
    link.click()
  }

  const renderPreview = () => {
    switch (fileType) {
      case 'image':
        return (
          <div className="flex items-center justify-center rounded-lg bg-muted/40 min-h-[300px]">
            {imageError ? (
              <p className="text-muted-foreground">无法加载图片</p>
            ) : (
              <img
                src={imageUrl}
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-0 sm:p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="relative flex max-h-[100dvh] w-full max-w-4xl flex-col overflow-y-auto rounded-none bg-background shadow-xl animate-fade-in sm:max-h-[90dvh] sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b">
          <div className="min-w-0 flex-1 mr-4">
            <h2 className="text-lg font-semibold truncate">{file.name}</h2>
            <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasImageVariants && (
              <div
                className="flex items-center rounded-md border p-0.5"
                role="group"
                aria-label="图片版本"
              >
                {versionOptions.map((option) => (
                  <Button
                    key={option.key}
                    variant={imageVersion === option.key ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    aria-pressed={imageVersion === option.key}
                    onClick={() => setImageVersion(option.key)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            )}
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
