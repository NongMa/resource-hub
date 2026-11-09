import { copyFile, mkdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

/**
 * 把 pdfjs 的 worker 拷到 public/ 下：
 * worker 是 ESM 文件，交给 webpack 打包会被当成普通脚本压缩而构建失败（'import' cannot be used outside of module code），
 * 因此作为静态资源随应用发布，由 pdfjs 以绝对路径 /pdf.worker.min.mjs 加载。
 */
const source = resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs')
const target = resolve('public/pdf.worker.min.mjs')

async function main() {
  const info = await stat(source).catch(() => null)
  if (!info) {
    console.warn('[pdfjs] worker 不存在，跳过拷贝（请先安装依赖）')
    return
  }
  await mkdir(dirname(target), { recursive: true })
  await copyFile(source, target)
  console.log(`[pdfjs] worker 已拷贝到 public/pdf.worker.min.mjs（${info.size} 字节）`)
}

main().catch((error) => {
  console.error('[pdfjs] worker 拷贝失败:', error)
  process.exitCode = 1
})
