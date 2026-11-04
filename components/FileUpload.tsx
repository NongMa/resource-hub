'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileWarning } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface FileUploadProps {
  folderId?: string | null
  onUploadComplete?: () => void
}

export function FileUpload({ folderId, onUploadComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setUploading(true)
      setError(null)
      setProgress(0)

      try {
        for (let i = 0; i < acceptedFiles.length; i++) {
          const file = acceptedFiles[i]
          
          // 获取上传凭证
          const key = folderId ? `${folderId}/${file.name}` : file.name
          const res = await fetch('/api/files/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, fileName: file.name }),
          })

          if (!res.ok) {
            throw new Error('获取上传凭证失败')
          }

          const { token } = await res.json()

          // 上传到七牛
          const formData = new FormData()
          formData.append('file', file)
          formData.append('token', token)
          formData.append('key', key)

          const uploadRes = await fetch('https://upload.qiniup.com', {
            method: 'POST',
            body: formData,
          })

          if (!uploadRes.ok) {
            throw new Error(`上传失败: ${file.name}`)
          }

          // 保存文件信息到数据库
          await fetch('/api/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: file.name,
              key,
              size: file.size,
              mimeType: file.type,
              folderId,
            }),
          })

          setProgress(Math.round(((i + 1) / acceptedFiles.length) * 100))
        }

        onUploadComplete?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : '上传失败')
      } finally {
        setUploading(false)
      }
    },
    [folderId, onUploadComplete]
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    disabled: uploading,
  })

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive && 'border-primary bg-primary/5',
          isDragReject && 'border-destructive bg-destructive/5',
          !isDragActive && 'border-border hover:border-primary/50'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          {uploading ? (
            <>
              <Upload className="h-10 w-10 text-primary animate-pulse" />
              <p className="text-sm text-muted-foreground">上传中... {progress}%</p>
            </>
          ) : (
            <>
              <Upload className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isDragActive ? '释放以上传文件' : '拖拽文件到此处，或点击选择'}
              </p>
              <p className="text-xs text-muted-foreground">支持任意类型的文件</p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <FileWarning className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
