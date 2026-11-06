# ResourceHub - 资源管理平台

一个基于 Next.js 和七牛云存储的资源管理应用，可部署到 Vercel。

## 功能特性

- 文件上传与管理（拖拽、多文件、上传进度；浏览器直传七牛）
- 文件夹管理（支持父子层级）
- 文件列表分页、表格视图 / 网格视图、网格滚动加载
- 服务端搜索（按文件名匹配，支持中文，与分页组合生效）
- 文件分享（生成真实分享链接，有效期可选）
- 账号体系（邮箱密码登录、GitHub / Google OAuth 可选）
- 登录保护（图形验证码、失败计数与锁定、一次性登录票据）
- 注册授权码 + 邮箱验证码注册
- 忘记密码（邮箱验证码重置）
- 会话吊销（重置密码后旧会话失效）
- 七牛私有空间签名访问、图片处理（缩略图 / 预览瘦身）
- 强制下载（下载地址使用 `attname`，预览仍为内联）
- Vercel 部署 + Vercel Cron 数据库保活

## 技术栈

- **前端**: Next.js 14 (App Router), React, Tailwind CSS
- **UI 组件**: shadcn/ui, Radix UI
- **后端**: Next.js API Routes, NextAuth.js
- **数据库**: Supabase (PostgreSQL) + Prisma ORM
- **存储**: 七牛云 Kodo
- **邮件**: SMTP（注册验证码、找回密码验证码）
- **部署**: Vercel

## 快速开始

### 1. 克隆项目

```bash
git clone <your-repo>
cd resource-hub
```

### 2. 安装依赖

```bash
npm install
# 或
pnpm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env`，按下方表格填写。

#### 环境变量清单

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串（Supabase） |
| `NEXTAUTH_URL` | 是 | 站点地址；本地为 `http://localhost:3000`，生产填实际域名 |
| `NEXTAUTH_SECRET` | 是 | 会话签名密钥，`openssl rand -base64 32` 生成；同时用于派生邮箱验证码与图形验证码密钥，修改后已签发的验证码会失效 |
| `REGISTER_INVITE_CODES` | 否 | 注册授权码，逗号分隔，任一匹配即可；**未配置时注册接口关闭并返回 503** |
| `SMTP_HOST` | 否 | SMTP 服务器地址；与 `SMTP_FROM` 未配置时，邮箱验证码接口返回 503（注册 / 找回密码不可用） |
| `SMTP_PORT` | 否 | SMTP 端口，默认 `587`；使用 465 时请配合 `SMTP_SECURE=true` |
| `SMTP_SECURE` | 否 | 是否使用 TLS，默认 `false` |
| `SMTP_USER` | 否 | SMTP 认证用户名；与 `SMTP_PASS` 同时配置才启用认证 |
| `SMTP_PASS` | 否 | SMTP 认证密码 / 授权码 |
| `SMTP_FROM` | 否 | 发件人，建议格式 `名称 <no-reply@example.com>` |
| `QINIU_ACCESS_KEY` | 是 | 七牛 AccessKey |
| `QINIU_SECRET_KEY` | 是 | 七牛 SecretKey |
| `QINIU_BUCKET` | 是 | 存储空间名称 |
| `QINIU_ZONE` | 否 | 区域，默认 `z0`；可选 `z0`/`z1`/`z2`/`na0`/`as0` |
| `QINIU_DOMAIN` | 是 | CDN 加速域名，**不带协议**（如 `cdn.example.com`） |
| `CRON_SECRET` | 否 | 数据库保活接口的 Bearer 密钥；未配置时 `/api/health/db` 返回 503 |
| `GITHUB_ID` | 否 | GitHub OAuth App ID；与 `GITHUB_SECRET` 成对配置才启用 |
| `GITHUB_SECRET` | 否 | GitHub OAuth App Secret |
| `GOOGLE_ID` | 否 | Google OAuth Client ID；与 `GOOGLE_SECRET` 成对配置才启用 |
| `GOOGLE_SECRET` | 否 | Google OAuth Client Secret |

#### QQ 邮箱 SMTP 示例

```env
SMTP_HOST="smtp.qq.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="your-qq-mail@qq.com"
SMTP_PASS="你的邮箱授权码（不是登录密码）"
SMTP_FROM="ResourceHub <your-qq-mail@qq.com>"
```

注册授权码示例（占位符，请替换为随机长字符串）：

```env
REGISTER_INVITE_CODES="invite-code-a,invite-code-b"
```

### 4. 初始化数据库

方式一（Prisma，推荐）：

```bash
npx prisma generate
npx prisma db push
```

方式二（SQL 脚本）：在 Supabase SQL Editor 中执行 [`prisma/init.sql`](prisma/init.sql)，一次性创建所有表、索引与外键。

### 5. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

## 账号与登录安全

### 注册

- **授权码**：校验 `REGISTER_INVITE_CODES`，逗号分隔、任一匹配即可；未配置时接口返回 503，等于关闭注册；授权码错误返回 403。
- **邮箱验证码**：注册前需先获取验证码（`POST /api/auth/email-code`，`purpose=register`）。验证码为 6 位数字、10 分钟有效、**一次性消费**；同一邮箱 60 秒内只能重发一次；单邮箱每小时最多 5 封、单 IP 每小时最多 10 封，超限返回 429 并携带 `Retry-After`。
- 邮箱已被注册时不会下发验证码，只发送「已有账号」提醒，避免暴露注册状态。
- 注册成功后服务端按登录同源流程签发一次性票据，前端据此自动登录；若该邮箱此前有失败记录/锁定，则提示用户前往登录页。

### 登录

- **图形验证码**：同一邮箱 15 分钟窗口内，从第 2 次尝试（已有 1 次失败）起必须携带图形验证码；验证码 5 位数字、5 分钟有效、一次性消费，状态存数据库（多实例共享）。
- **失败计数与锁定**：15 分钟内累计 5 次失败将锁定该邮箱 15 分钟；成功登录后清零。
- **登录票据**：NextAuth Credentials 登录需要服务端签发的一次性票据（约 90 秒有效），防止绕过验证码 / 限流直接调用登录回调。
- 图形验证码、失败计数、锁定与票据状态均落库，多实例部署行为一致。

### 忘记密码

- 页面：`/forgot-password`。
- 先调用 `/api/auth/email-code`（`purpose=reset`）获取 6 位验证码，再调用 `/api/auth/reset-password` 提交邮箱、验证码与新密码。
- 新密码长度至少 6 位；验证码消费与密码更新在同一事务内完成。
- 邮箱不存在时不会产生差异响应（统一按「验证码失效」处理），避免枚举账号。
- 重置成功后 `sessionVersion` 自增，该账号此前签发的会话全部失效；同时清除旧的登录失败计数与锁定。

### 会话吊销

JWT 中的 `sessionVersion` 与数据库中的用户版本定期核对（最长 5 分钟一次）。重置密码后，旧会话最迟约 5 分钟后被判定为未登录。

### 已登录访问认证页

已登录状态下访问 `/login`、`/register`、`/forgot-password`，服务端检测到会话后会重定向到首页（`/`），不会出现表单闪烁。

## 文件功能

### 上传

- 浏览器先请求 `POST /api/files/upload` 获取上传凭证（`key` 由服务端生成，客户端不可指定），再直接上传到七牛。
- 文件不经过应用服务器中转，因此不受 Vercel 请求体大小限制，适合大文件。

### 列表、分页与视图

- 接口：`GET /api/files?page=1&pageSize=20[&folderId=<id>][&q=<关键词>]`。
- `page` 默认 1，`pageSize` 默认 20、最大 100；返回 `files`、`total`、`page`、`pageSize`、`hasMore`。
- 排序固定为 `createdAt desc` + `id desc`，保证翻页稳定、不重不漏。
- 不传 `folderId` 时只列出根目录文件。
- 表格视图提供上一页 / 下一页、每页条数（20/50/100）与总条数；网格视图滚动到哨兵位置自动加载下一页。

### 服务端搜索

- 参数：`q`。按文件名包含匹配，大小写不敏感（Prisma `mode: 'insensitive'`，PostgreSQL 下按不区分大小写的方式比较；中文没有大小写差异，可直接命中）。
- 搜索与分页组合生效：`total` 是命中总数，`hasMore` 按命中总数计算；`q` 为空或空白时行为与不传一致。
- `folderId` 与 `q` 组合的语义是**只在当前文件夹内搜索**（不传 `folderId` 即只在根目录），与页面当前所处的目录上下文一致。
- 前端：输入 300ms 防抖；搜索条件变化后回到第 1 页；网格视图在搜索状态下仍可滚动加载；无结果时展示「没有找到匹配的文件」。

### 图片处理

私有空间带处理参数的 URL 由服务端签名生成（处理参数必须参与签名，追加在已签名 URL 之后会被七牛忽略）：

| 用途 | 参数 |
|------|------|
| 列表缩略图 | `imageView2/1/w/400/h/400` |
| 预览瘦身（原尺寸降质量） | `imageMogr2/quality/75` |
| 预览更小尺寸 | `imageView2/1/w/1000/h/1000` |

仅对可处理的位图格式（JPEG/PNG/GIF/WebP/BMP/TIFF）生成图片处理地址，SVG 等矢量格式使用原图地址。

### 下载与预览

- 列表与分享接口同时返回两个地址：
  - `url`：预览地址（不带下载参数，七牛返回 `Content-Disposition: inline`）。
  - `downloadUrl`：下载地址，带 `attname=<URL 编码后的文件名>`，该参数参与签名。
- `downloadUrl` 的响应头为 `Content-Disposition: attachment; filename="..."; filename*=UTF-8''...`。中文文件名通过 RFC 5987 的 `filename*` 下发，现代浏览器落盘为原始中文名；含空格的文件名同样保留空格（不会变成下划线）。
- 下载地址直连七牛 CDN，不经过应用服务器中转，因此不受 Vercel 响应体大小限制（预览同理）。
- 如果自行拼接 URL，请确保 `attname`（以及图片处理参数）在签名前加入，否则七牛会忽略并回退为 `inline`。

### 分享

- `POST /api/share`，请求体 `{ fileId, expiresIn }`（`expiresIn` 为秒，传 `null` 表示永久），返回 `{ url, token }`。
- 分享页路径 `/share/<token>`；`GET /api/share?token=...` 在分享不存在时返回 404，过期时返回 410。
- UI 提供永久、1 小时、1 天、7 天、30 天五档有效期。

## 部署到 Vercel

### 方式一：通过 GitHub 部署（推荐）

1. **推送代码到 GitHub**

   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git remote add origin https://github.com/yourusername/resource-hub.git
   git push -u origin main
   ```

2. **在 Vercel 导入项目**
   - 访问 [Vercel](https://vercel.com) 并登录
   - 点击 **Add New...** → **Project**
   - 选择刚才推送的 GitHub 仓库
   - 点击 **Import**

3. **配置环境变量**：按上文「环境变量清单」在 Vercel 项目设置中逐项添加（至少包含 `DATABASE_URL`、`NEXTAUTH_URL`、`NEXTAUTH_SECRET` 与七牛相关配置）。

4. **部署**：点击 **Deploy**，等待构建完成。

### 方式二：通过 Vercel CLI 部署

```bash
npm i -g vercel
vercel login
vercel          # 预览环境
vercel --prod   # 生产环境
```

### 部署后配置

1. **初始化数据库**：在本地执行 `npx prisma db push`，或在 Supabase SQL Editor 执行 `prisma/init.sql`。
2. **Cron 保活**：仓库内 `vercel.json` 已配置每日 `0 3 * * *`（UTC）调用 `/api/health/db`，用于保持数据库活跃。需在 Vercel 环境变量中配置 `CRON_SECRET`；接口会校验 `Authorization: Bearer <CRON_SECRET>`，未配置密钥时返回 503。
3. **配置域名**（可选）：项目设置 → **Domains** 添加自定义域名并按提示配置 DNS。

### 常见问题

- **注册接口返回 503**：未配置 `REGISTER_INVITE_CODES`，注册被关闭。
- **邮箱验证码接口返回 503**：未配置 `SMTP_HOST` / `SMTP_FROM`，或 SMTP 配置不可用。
- **数据库连接失败**：检查 `DATABASE_URL`；Serverless 环境建议使用 Supabase 连接池端口 `6543`（`?pgbouncer=true`）。
- **七牛文件无法访问**：检查 `QINIU_DOMAIN`（不要带 `https://`）、`QINIU_BUCKET` 是否为私有空间、密钥是否有效。
- **点击下载却在浏览器里打开文件**：确认使用的是带 `attname` 的 `downloadUrl`，而不是预览 `url`。
- **OAuth 登录失败**：在 GitHub/Google 开发者平台配置回调 URL：`https://你的域名/api/auth/callback/github`（或 `google`）。

## 项目结构

```
resource-hub/
├── app/                        # Next.js App Router
│   ├── (dashboard)/           # 仪表板页面组
│   ├── api/                   # API 路由
│   │   ├── auth/              # 登录、注册、验证码、找回密码等
│   │   ├── files/             # 文件列表 / 上传 / 删除
│   │   ├── folders/           # 文件夹管理
│   │   ├── health/db/         # 数据库保活（Vercel Cron）
│   │   └── share/             # 分享创建与查询
│   ├── login/                 # 登录页
│   ├── register/              # 注册页
│   ├── forgot-password/       # 忘记密码页
│   ├── share/[token]/         # 分享页
│   └── globals.css            # 全局样式
├── components/                # React 组件
│   ├── ui/                   # UI 基础组件
│   ├── FileUpload.tsx        # 文件上传组件
│   ├── FileList.tsx          # 文件列表（表格 / 网格 / 搜索 / 分页）
│   ├── FileCard.tsx          # 文件卡片
│   └── ...
├── lib/                       # 工具与业务逻辑
│   ├── auth.ts               # NextAuth 配置与会话版本核对
│   ├── login-guard.ts        # 图形验证码、失败计数、登录票据
│   ├── email-verification.ts # 邮箱验证码签发 / 校验 / 限流
│   ├── mailer.ts             # SMTP 发信
│   ├── qiniu.ts              # 七牛签名、图片处理、强制下载
│   └── utils.ts              # 通用工具函数
├── prisma/
│   ├── schema.prisma         # 数据库模型
│   └── init.sql              # 建表 SQL（可选初始化方式）
├── vercel.json               # Vercel Cron 配置
└── public/                   # 静态资源
```

## Supabase 配置

1. 登录 [Supabase](https://supabase.com) 并创建项目
2. 在 **Settings** → **Database** 中找到连接信息
3. 复制 **URI** 并替换密码部分，格式如下：
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres
   ```
4. 在 `.env` 中设置 `DATABASE_URL`

## 七牛云配置

### 步骤 1：注册并登录

访问 [七牛云控制台](https://console.qiniu.com) 注册账号并登录。

### 步骤 2：创建存储空间（私有空间）

1. 进入 **控制台** → **对象存储 Kodo**
2. 点击 **新建存储空间**
3. 配置：
   - **名称**：自定义（如 `resource-hub`）
   - **区域**：根据用户群体选择（华东 `z0` / 华北 `z1` / 华南 `z2` / 北美 `na0` / 东南亚 `as0`）
   - **访问控制**：选择 **私有**（本项目使用私有空间，文件访问需要签名）

### 步骤 3：获取 API 密钥

1. 点击右上角 **个人头像** → **密钥管理**
2. 查看或创建 **AccessKey** 和 **SecretKey**

### 步骤 4：配置 CDN 加速域名（可选但推荐）

1. 在存储空间详情页，点击 **域名管理**
2. 添加自有域名（或使用七牛提供的测试域名）
3. 配置完成后，将域名填入 `QINIU_DOMAIN`（不要带协议）

### 步骤 5：配置环境变量

```env
QINIU_ACCESS_KEY="your-access-key"
QINIU_SECRET_KEY="your-secret-key"
QINIU_BUCKET="resource-hub"
QINIU_ZONE="z0"
QINIU_DOMAIN="your-domain.e.gcdn.example.com"
```

### 区域对应关系

| 区域 | Zone 值 |
|------|---------|
| 华东 | `z0` |
| 华北 | `z1` |
| 华南 | `z2` |
| 北美 | `na0` |
| 东南亚 | `as0` |

### 注意事项

- **私有空间**：所有访问地址都需要签名，默认有效期 1 小时。
- 图片处理参数、`attname` 下载参数都必须在签名前加入 URL，否则七牛会忽略并返回原图或 `inline`。
- 上传由浏览器直传七牛，下载直连 CDN，均不经过应用服务器，因此不受 Vercel 4.5MB 请求/响应体限制。

## 许可证

MIT
