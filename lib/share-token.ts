import { randomBytes } from 'node:crypto'

/**
 * 生成分享 token。
 * 分享链接是匿名访问文件的唯一凭证，必须使用密码学安全的随机源，
 * 不能用 Math.random（非 CSPRNG，内部状态可被推测）。
 * 24 字节 = 192 位熵；base64url 编码后 32 个字符，与既有的 token 长度一致。
 */
export function generateShareToken(): string {
  return randomBytes(24).toString('base64url')
}
