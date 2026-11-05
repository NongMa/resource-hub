import qiniu from 'qiniu'

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
  as0: 'https://upload-as0.qiniup.com',
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
 * 删除七牛云文件
 */
export function deleteFile(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    bucketManager.delete(bucket, key, (err, respBody, respInfo) => {
      if (err) {
        reject(err)
      } else if (respInfo.statusCode !== 200) {
        reject(new Error(`Delete failed: ${respInfo.statusCode}`))
      } else {
        resolve()
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
