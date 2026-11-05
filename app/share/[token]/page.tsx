'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Download, File, Image, Video, Music, FileText, ArrowLeft, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getFileType, formatFileSize } from '@/lib/utils'

interface ShareData {
  id: string
  token: string
  expiresAt: string | null
  file: {
    id: string
    name: string
    key: string
    size: number
    mimeType: string
    url: string
  }
}

export default function SharePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [shareData, setShareData] = useState<ShareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    const fetchShareData = async () => {
      try {
        const res = await fetch(`/api/share?token=${token}`)
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || '获取分享信息失败')
        }
        const data = await res.json()
        setShareData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      fetchShareData()
    }
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">加载中...</div>
      </div>
    )
  }

  if (error || !shareData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive mb-4">{error || '分享不存在或已过期'}</p>
            <Button onClick={() => router.push('/login')}>返回登录</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { file } = shareData
  const fileType = getFileType(file.mimeType)
  const fileUrl = file.url

  const getIcon = () => {
    switch (fileType) {
      case 'image':
        return <Image className="h-16 w-16 text-green-500" />
      case 'video':
        return <Video className="h-16 w-16 text-purple-500" />
      case 'audio':
        return <Music className="h-16 w-16 text-orange-500" />
      case 'document':
        return <FileText className="h-16 w-16 text-blue-500" />
      default:
        return <File className="h-16 w-16 text-gray-500" />
    }
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = file.name
    link.click()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" className="mb-4" onClick={() => router.push('/login')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          登录后管理我的文件
        </Button>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {/* 文件预览 */}
              <div className="flex items-center justify-center bg-muted/50 rounded-lg p-8 min-h-[200px]">
                {fileType === 'image' && !imageError ? (
                  <img
                    src={fileUrl}
                    alt={file.name}
                    className="max-w-full max-h-[400px] object-contain"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  getIcon()
                )}
              </div>

              {/* 文件信息 */}
              <div className="space-y-2">
                <h2 className="text-xl font-semibold break-all">{file.name}</h2>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <File className="h-4 w-4" />
                    {formatFileSize(file.size)}
                  </span>
                  {shareData.expiresAt && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      有效期至: {new Date(shareData.expiresAt).toLocaleString('zh-CN')}
                    </span>
                  )}
                </div>
              </div>

              {/* 下载按钮 */}
              <Button className="w-full" size="lg" onClick={handleDownload}>
                <Download className="h-5 w-5 mr-2" />
                下载文件
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
