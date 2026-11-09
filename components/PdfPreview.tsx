'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Minus, Plus, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PdfPreviewProps {
  /** 七牛签名后的内联地址（1 小时有效） */
  url: string
  /** 文件名，用于无障碍标签 */
  fileName?: string
}

type PdfDocument = {
  numPages: number
  getPage: (pageNumber: number) => Promise<{
    getViewport: (params: { scale: number }) => { width: number; height: number }
    render: (params: {
      canvasContext: CanvasRenderingContext2D
      viewport: { width: number; height: number }
      transform?: number[]
    }) => { promise: Promise<void>; cancel: () => void }
  }>
  destroy: () => Promise<void>
}

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const SCALE_STEP = 0.2
/** 首屏按容器宽度自适应时的最大初始缩放，避免小页面被拉得过大 */
const MAX_FIT_SCALE = 1.6

/**
 * 用 pdfjs-dist 渲染 PDF：
 * - pdfjs 只在打开 PDF 时动态加载，不进入列表页首屏包
 * - 逐页渲染到 canvas，自带翻页 / 缩放，样式与主题一致
 * - 支持 iOS Safari 等没有内置 PDF 阅读器的环境
 */
export function PdfPreview({ url, fileName }: PdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const docRef = useRef<PdfDocument | null>(null)
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null)

  const [numPages, setNumPages] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [scale, setScale] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const destroyDoc = useCallback(() => {
    renderTaskRef.current?.cancel()
    renderTaskRef.current = null
    docRef.current?.destroy().catch(() => {})
    docRef.current = null
  }, [])

  // 加载文档：pdfjs 按需 import，worker 同源打包
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setNumPages(0)
    setPageNum(1)

    // 七牛偶发慢或签名失效时会一直挂起，超时后给出可重试的错误态
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setLoading(false)
        setError('PDF 加载超时，请重试')
      }
    }, 20000)

    async function load() {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
        // worker 由 postinstall 拷到 public/，以绝对路径加载（见 scripts/copy-pdfjs-worker.mjs）
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

        const task = pdfjs.getDocument({ url })
        const doc = (await task.promise) as unknown as PdfDocument
        if (cancelled) {
          doc.destroy().catch(() => {})
          return
        }

        docRef.current = doc
        setNumPages(doc.numPages)

        // 首屏按容器宽度铺满，并限制上下限
        const firstPage = await doc.getPage(1)
        if (cancelled) return
        const base = firstPage.getViewport({ scale: 1 })
        const containerWidth = containerRef.current?.clientWidth ?? 0
        const fit = containerWidth > 0 ? (containerWidth - 24) / base.width : 1
        setScale(Math.min(Math.max(fit, MIN_SCALE), MAX_FIT_SCALE))
        clearTimeout(timeout)
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        console.error('Load pdf error:', e)
        clearTimeout(timeout)
        setLoading(false)
        setError('PDF 加载失败，可能是链接已过期或网络异常')
      }
    }

    load()

    return () => {
      cancelled = true
      clearTimeout(timeout)
      destroyDoc()
    }
  }, [url, reloadKey, destroyDoc])

  // 渲染当前页：按 devicePixelRatio 放大画布，避免模糊
  useEffect(() => {
    const doc = docRef.current
    const canvas = canvasRef.current
    if (loading || error || !doc || !canvas || numPages === 0) return

    let cancelled = false

    async function renderPage() {
      try {
        const page = await doc!.getPage(pageNum)
        if (cancelled) return

        const viewport = page.getViewport({ scale })
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        canvas!.width = Math.floor(viewport.width * dpr)
        canvas!.height = Math.floor(viewport.height * dpr)
        canvas!.style.width = `${Math.floor(viewport.width)}px`
        canvas!.style.height = `${Math.floor(viewport.height)}px`

        const context = canvas!.getContext('2d')
        if (!context) return

        renderTaskRef.current?.cancel()
        const task = page.render({
          canvasContext: context,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        })
        renderTaskRef.current = task
        await task.promise
      } catch (e) {
        // 翻页/缩放会取消上一次渲染，属正常中断
        const name = (e as { name?: string })?.name
        if (name !== 'RenderingCancelledException' && !cancelled) {
          console.error('Render pdf page error:', e)
        }
      }
    }

    renderPage()

    return () => {
      cancelled = true
    }
  }, [pageNum, scale, loading, error, numPages])

  const zoom = (delta: number) => {
    setScale((current) =>
      Math.min(Math.max(Number((current + delta).toFixed(2)), MIN_SCALE), MAX_SCALE)
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border bg-muted/40 py-16">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setReloadKey((key) => key + 1)}
        >
          <RotateCcw className="mr-1 h-4 w-4" />
          重新加载
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-2 py-1.5">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="上一页"
            disabled={loading || pageNum <= 1}
            onClick={() => setPageNum((page) => Math.max(1, page - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[68px] text-center text-xs text-muted-foreground">
            {loading ? '加载中' : `${pageNum} / ${numPages}`}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="下一页"
            disabled={loading || pageNum >= numPages}
            onClick={() => setPageNum((page) => Math.min(numPages, page + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="缩小"
            disabled={loading || scale <= MIN_SCALE}
            onClick={() => zoom(-SCALE_STEP)}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="min-w-[48px] text-center text-xs text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="放大"
            disabled={loading || scale >= MAX_SCALE}
            onClick={() => zoom(SCALE_STEP)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 画布区 */}
      <div
        ref={containerRef}
        className="relative flex h-[70vh] w-full justify-center overflow-auto rounded-lg border bg-muted/40 p-3"
      >
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground">正在加载 PDF…</p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={fileName ? `${fileName} 第 ${pageNum} 页` : `PDF 第 ${pageNum} 页`}
          className={loading ? 'invisible' : 'shadow-sm'}
        />
      </div>
    </div>
  )
}
