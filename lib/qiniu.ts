import qiniu from 'qiniu'
import crypto from 'node:crypto'

const accessKey = process.env.QINIU_ACCESS_KEY || ''
const secretKey = process.env.QINIU_SECRET_KEY || ''
const bucket = process.env.QINIU_BUCKET || ''
const zone = process.env.QINIU_ZONE || 'z0'
const domain = process.env.QINIU_DOMAIN || ''

// 创建鉴权对象
const mac = new qiniu.auth.digest.Mac(accessKey, secretKey)

// 区域映射
const zones = {
  z0: qiniu.zone.Zone_z0,
  z1: qiniu.zone.Zone_z1,
  z2: qiniu.zone.Zone_z2,
  na0: qiniu.zone.Zone_na0,
  as0: qiniu.zone.Zone_as0,
} as const

// 上传域名映射
const uploadHosts = {
  z0: 'https://upload.qiniup.com',
  z1: 'https://up-z1.qiniup.com',
  z2: 'https://up-z2.qiniup.com',
  na0: 'https://up-na0.qiniup.com',
  as0: 'https://up-as0.qiniup.com',
} as const

// 配置项
const config = new qiniu.conf.Config()
config.zone = zones[zone as keyof typeof zones] || qiniu.zone.Zone_z0

// 存储空间
const bucketManager = new qiniu.rs.BucketManager(mac, config)

// 私有空间签名配置
const privateBucketManager = new qiniu.rs.BucketManager(mac, config)

/**
 * 生成七牛云上传凭证（私有空间）
 */
export function getUploadToken(key: string): string {
  const options = {
    scope: `${bucket}:${key}`,
    expires: 3600, // 1小时有效期
    returnBody: '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"mimeType":"$(mimeType)"}',
  }
  const putPolicy = new qiniu.rs.PutPolicy(options)
  return putPolicy.uploadToken(mac)
}

/**
 * 获取上传域名（按空间所在区域）
 */
export function getUploadUrl(): string {
  return uploadHosts[zone as keyof typeof uploadHosts] || uploadHosts.z0
}

/**
 * 生成七牛云文件访问URL（私有空间需要签名）
 * @param key 文件 key
 * @param expires 签名有效期（秒），默认 3600 秒
 */
export function getPrivateUrl(key: string, expires: number = 3600): string {
  const deadline = Math.ceil(Date.now() / 1000) + expires
  
  // 生成私有签名 URL
  return bucketManager.privateDownloadUrl(`https://${domain}`, key, deadline)
}

/**
 * 获取文件下载链接（兼容公开和私有空间）
 * 私有空间返回签名 URL，公开空间返回直接 URL
 */
export function getFileUrl(key: string): string {
  return getPrivateUrl(key)
}

/**
 * 图片处理参数（七牛图片处理，实时生效，不落库）
 * - 缩略图：限定长边 400，避免小图被放大
 * - 瘦身：保持原尺寸，仅降低质量
 * - 小尺寸：限定长边 1000，用于预览的“更小”档
 */
export const IMAGE_THUMBNAIL_PARAMS = 'imageView2/1/w/400/h/400'
export const IMAGE_SLIM_PARAMS = 'imageMogr2/quality/75'
export const IMAGE_SMALL_PARAMS = 'imageView2/1/w/1000/h/1000'

/**
 * 生成带图片处理参数的私有空间签名 URL
 *
 * 注意：处理参数必须参与签名（即对「路径?参数&e=deadline」整体做 HMAC），
 * 追加到已签名 URL 之后会被七牛忽略并返回原图。此处为纯本地计算，不发起网络请求。
 */
export function getPrivateUrlWithParams(
  key: string,
  params: string,
  expires: number = 3600
): string {
  const deadline = Math.ceil(Date.now() / 1000) + expires
  const baseUrl = bucketManager.publicDownloadUrl(`https://${domain}`, key)
  const signedUrl = `${baseUrl}?${params}&e=${deadline}`
  const signature = crypto
    .createHmac('sha1', secretKey)
    .update(signedUrl)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  return `${signedUrl}&token=${accessKey}:${signature}`
}

/**
 * 可作为七牛图片处理输入的格式（SVG 等矢量格式不支持，避免缩略图加载失败）
 */
const PROCESSABLE_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
])

export function isProcessableImage(mimeType: string): boolean {
  return PROCESSABLE_IMAGE_MIME_TYPES.has(mimeType.toLowerCase())
}

/**
 * 列表缩略图地址（仅图片使用）
 */
export function getThumbnailUrl(key: string): string {
  return getPrivateUrlWithParams(key, IMAGE_THUMBNAIL_PARAMS)
}

/**
 * 预览用图片地址
 * @param variant slim 瘦身（原尺寸降质量） | small 更小尺寸
 */
export function getPreviewImageUrl(key: string, variant: 'slim' | 'small'): string {
  return getPrivateUrlWithParams(
    key,
    variant === 'slim' ? IMAGE_SLIM_PARAMS : IMAGE_SMALL_PARAMS
  )
}

/**
 * 生成强制下载地址（私有空间）
 *
 * 七牛的 attname 参数会让响应带上 Content-Disposition: attachment，
 * 该参数必须和图片处理参数一样参与签名，追加在签名之后会被忽略并回退为 inline。
 * 文件名用 encodeURIComponent 编码：中文由七牛以 RFC 5987 的 filename* 下发，
 * 现代浏览器优先采用 filename*，因此保存下来的文件名不会是乱码。
 */
export function getDownloadUrl(key: string, name: string, expires: number = 3600): string {
  return getPrivateUrlWithParams(key, `attname=${encodeURIComponent(name)}`, expires)
}

/**
 * 删除七牛云文件
 * 612（对象不存在）视为成功：删除接口可安全重试，不会因为“已经删掉了”而失败。
 */
export function deleteFile(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    bucketManager.delete(bucket, key, (err, respBody, respInfo) => {
      if (err) {
        reject(err)
      } else if (respInfo.statusCode === 200 || respInfo.statusCode === 612) {
        resolve()
      } else {
        reject(new Error(`Delete failed: ${respInfo.statusCode}`))
      }
    })
  })
}

/**
 * 获取文件信息
 */
export function getFileInfo(key: string): Promise<{ size: number; mimeType: string }> {
  return new Promise((resolve, reject) => {
    bucketManager.stat(bucket, key, (err, respBody, respInfo) => {
      if (err) {
        reject(err)
      } else if (respInfo.statusCode !== 200) {
        reject(new Error(`Stat failed: ${respInfo.statusCode}`))
      } else {
        resolve({
          size: respBody.size,
          mimeType: respBody.mimeType,
        })
      }
    })
  })
}

export { domain }
