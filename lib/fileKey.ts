import { randomUUID } from 'node:crypto'

const MAX_FILENAME_LENGTH = 100

/**
 * 生成安全的文件名：去掉目录部分、去掉路径穿越字符、限制长度并保留扩展名
 */
export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? ''
  const cleaned = base
    .replace(/[\u0000-\u001f"*:<>?|]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return 'unnamed'

  const dot = cleaned.lastIndexOf('.')
  const ext = dot > 0 ? cleaned.slice(dot) : ''
  const stem = dot > 0 ? cleaned.slice(0, dot) : cleaned
  const maxStemLength = Math.max(MAX_FILENAME_LENGTH - ext.length, 1)

  return stem.slice(0, maxStemLength) + ext
}

/**
 * 服务端生成文件存储 key，客户端无权指定
 */
export function buildFileKey(userId: string, fileName: string): string {
  return `users/${userId}/${randomUUID()}-${sanitizeFileName(fileName)}`
}

/**
 * 校验 key 是否属于该用户的目录，防止跨用户写入
 */
export function isKeyOwnedByUser(userId: string, key: string): boolean {
  const prefix = `users/${userId}/`

  if (typeof key !== 'string' || !key.startsWith(prefix)) {
    return false
  }

  const rest = key.slice(prefix.length)

  return rest.length > 0 && !rest.includes('/') && !rest.includes('\\')
}
