'use client'

import { useState } from 'react'
import { Link2, Check, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ShareModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: {
    id: string
    name: string
  } | null
  onShare: (fileId: string, expiresIn: number | null) => void
}

export function ShareModal({ open, onOpenChange, file, onShare }: ShareModalProps) {
  const [shareLink, setShareLink] = useState('')
  const [expiresIn, setExpiresIn] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const handleShare = () => {
    if (!file) return

    onShare(file.id, expiresIn)

    // 生成模拟的分享链接（实际应从API获取）
    const link = `${window.location.origin}/share/${Date.now().toString(36)}`
    setShareLink(link)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const expiryOptions = [
    { value: null, label: '永久有效' },
    { value: 1 * 60 * 60, label: '1小时' },
    { value: 24 * 60 * 60, label: '1天' },
    { value: 7 * 24 * 60 * 60, label: '7天' },
    { value: 30 * 24 * 60 * 60, label: '30天' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>分享文件</DialogTitle>
          <DialogDescription>分享 &quot;{file?.name}&quot; 给其他人</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!shareLink ? (
            <>
              <div className="space-y-2">
                <Label>有效期</Label>
                <div className="flex flex-wrap gap-2">
                  {expiryOptions.map((option) => (
                    <Button
                      key={option.label}
                      variant={expiresIn === option.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setExpiresIn(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label>分享链接</Label>
              <div className="flex gap-2">
                <Input value={shareLink} readOnly className="font-mono text-sm" />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Link2 className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                链接有效期: {expiresIn ? `${Math.floor(expiresIn / 3600)}小时` : '永久'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {!shareLink ? (
            <Button onClick={handleShare} disabled={!file}>
              生成分享链接
            </Button>
          ) : (
            <Button variant="outline" onClick={() => { setShareLink(''); onOpenChange(false); }}>
              完成
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
