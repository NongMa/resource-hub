import nodemailer from 'nodemailer'

export type EmailCodePurpose = 'register' | 'reset'

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif"
const MONO_STACK = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,'Courier New',monospace"

/**
 * 兼容 "465" / '"465"' 这类带引号的写法；空值或非法值回退默认。
 */
function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  return trimmed.replace(/^['"]|['"]$/g, '')
}

const DEFAULT_PORT = 587

function resolvePort(): number {
  const parsed = Number.parseInt(clean(process.env.SMTP_PORT) ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 65535 ? parsed : DEFAULT_PORT
}

function resolveSecure(): boolean {
  const value = clean(process.env.SMTP_SECURE)?.toLowerCase()
  return value === 'true' || value === '1' || value === 'yes' || value === 'on'
}

/**
 * 仅依赖通用 SMTP 环境变量，不绑定某一家邮件服务商。
 * 必需：SMTP_HOST、SMTP_FROM；SMTP_USER / SMTP_PASS 可选（部分内网中继无需认证）。
 */
export function isSmtpConfigured(): boolean {
  return Boolean(clean(process.env.SMTP_HOST) && clean(process.env.SMTP_FROM))
}

function createTransport() {
  const user = clean(process.env.SMTP_USER)
  const pass = process.env.SMTP_PASS

  return nodemailer.createTransport({
    host: clean(process.env.SMTP_HOST),
    port: resolvePort(),
    secure: resolveSecure(),
    auth: user && pass ? { user, pass } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  })
}

/**
 * 邮件骨架：约 600px 居中卡片，全部内联样式，不引用外部图片与字体，
 * 窄屏靠 width:100% + max-width 自适应。
 */
function renderEmail(rows: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>资料管家</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;">
<tr>
<td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
<tr>
<td style="padding:28px 32px 6px;font-family:${FONT_STACK};font-size:20px;font-weight:700;color:#111827;">资料管家</td>
</tr>
${rows}
</table>
</td>
</tr>
</table>
</body>
</html>`
}

function introRow(text: string): string {
  return `<tr>
<td style="padding:0 32px 20px;font-family:${FONT_STACK};font-size:15px;line-height:1.7;color:#4b5563;">${text}</td>
</tr>`
}

function footerRow(): string {
  return `<tr>
<td style="padding:18px 32px 28px;border-top:1px solid #f1f2f4;font-family:${FONT_STACK};font-size:13px;line-height:1.7;color:#9ca3af;">如非本人操作，请忽略本邮件，无需回复。</td>
</tr>`
}

export async function sendEmailCode(
  email: string,
  code: string,
  purpose: EmailCodePurpose
): Promise<void> {
  const transporter = createTransport()
  const label = purpose === 'reset' ? '重置密码' : '注册'
  const intro =
    purpose === 'reset'
      ? '您正在重置资料管家账号密码，请在页面中输入以下验证码。'
      : '您正在注册资料管家账号，请在页面中输入以下验证码。'

  const rows = `${introRow(intro)}
<tr>
<td align="center" style="padding:0 32px 20px;">
<div style="display:inline-block;padding:16px 24px 16px 32px;background-color:#f3f4f6;border:1px solid #e5e7eb;border-radius:10px;font-family:${MONO_STACK};font-size:34px;font-weight:700;letter-spacing:8px;color:#111827;">${code}</div>
</td>
</tr>
<tr>
<td style="padding:0 32px 16px;font-family:${FONT_STACK};font-size:14px;line-height:1.7;color:#6b7280;">验证码 10 分钟内有效，且仅可使用一次。</td>
</tr>
${footerRow()}`

  await transporter.sendMail({
    from: clean(process.env.SMTP_FROM),
    to: email,
    subject: '【资料管家】邮箱验证码',
    text:
      `您的${label}验证码是：${code}\n\n` +
      `验证码 10 分钟内有效，且仅可使用一次。\n` +
      `如非本人操作，请忽略本邮件。`,
    html: renderEmail(rows),
  })
}

/**
 * 已注册邮箱在注册页请求验证码时发送的引导邮件：不含验证码，只提示登录或重置密码。
 */
export async function sendRegisteredNotice(email: string): Promise<void> {
  const transporter = createTransport()
  const origin = clean(process.env.NEXTAUTH_URL)?.replace(/\/+$/, '')

  const actions = origin
    ? `<tr>
<td align="center" style="padding:0 32px 24px;">
<a href="${origin}/login" style="display:inline-block;padding:12px 22px;background-color:#111827;border-radius:8px;font-family:${FONT_STACK};font-size:15px;color:#ffffff;text-decoration:none;">立即登录</a>
&nbsp;&nbsp;
<a href="${origin}/forgot-password" style="display:inline-block;padding:12px 22px;background-color:#ffffff;border:1px solid #d1d5db;border-radius:8px;font-family:${FONT_STACK};font-size:15px;color:#111827;text-decoration:none;">重置密码</a>
</td>
</tr>`
    : `<tr>
<td style="padding:0 32px 24px;font-family:${FONT_STACK};font-size:15px;line-height:1.7;color:#4b5563;">请前往资料管家登录页直接登录；如需重置密码，请使用登录页的「忘记密码」功能。</td>
</tr>`

  const rows = `${introRow('该邮箱已在资料管家注册，本次请求不会创建新账号。')}
<tr>
<td align="center" style="padding:0 32px 20px;">
<div style="display:inline-block;padding:14px 24px;background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;font-family:${FONT_STACK};font-size:18px;font-weight:700;color:#111827;">该邮箱已注册</div>
</td>
</tr>
<tr>
<td style="padding:0 32px 24px;font-family:${FONT_STACK};font-size:15px;line-height:1.7;color:#4b5563;">如为本人操作，请直接登录；如果忘记了密码，也可以重置后再登录。</td>
</tr>
${actions}
${footerRow()}`

  await transporter.sendMail({
    from: clean(process.env.SMTP_FROM),
    to: email,
    subject: '【资料管家】该邮箱已注册',
    text:
      '您的邮箱已在资料管家注册，本次请求不会创建新账号。\n\n' +
      (origin
        ? `请直接登录：${origin}/login\n如需重置密码，请访问：${origin}/forgot-password`
        : '请前往资料管家登录页直接登录；如需重置密码，请使用登录页的「忘记密码」功能') +
      '\n\n如非本人操作，请忽略本邮件，无需回复。',
    html: renderEmail(rows),
  })
}
