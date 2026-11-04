# ResourceHub - 资源管理平台

一个基于 Next.js 和七牛云存储的资源管理应用，可部署到 Vercel。

## 功能特性

- 📁 文件上传与管理（支持拖拽上传）
- 📂 文件夹管理
- 🔗 文件分享（支持链接分享和有效期设置）
- 🔐 用户认证（邮箱/密码、GitHub、Google OAuth）
- 🎨 美观的 UI 界面（响应式设计）
- ☁️ 七牛云存储
- 🚀 支持 Vercel 部署

## 技术栈

- **前端**: Next.js 14 (App Router), React, Tailwind CSS
- **UI 组件**: shadcn/ui, Radix UI
- **后端**: Next.js API Routes, NextAuth.js
- **数据库**: Supabase (PostgreSQL) + Prisma ORM
- **存储**: 七牛云 Kodo
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

复制 `.env.example` 为 `.env` 并填写配置：

```env
# Supabase Database
# 在 Supabase 控制台 → Settings → Database 获取连接字符串
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-generate-with-openssl-rand-base64-32"

# OAuth (可选)
GITHUB_ID="your-github-oauth-app-id"
GITHUB_SECRET="your-github-oauth-app-secret"
GOOGLE_ID="your-google-oauth-app-id"
GOOGLE_SECRET="your-google-oauth-app-secret"

# 七牛云存储
QINIU_ACCESS_KEY="your-qiniu-access-key"
QINIU_SECRET_KEY="your-qiniu-secret-key"
QINIU_BUCKET="your-bucket-name"
QINIU_ZONE="z0"  # 华东: z0, 华北: z1, 华南: z2, 北美: na0
QINIU_DOMAIN="your-cdn-domain.e.gcdn.example.com"
```

### 4. 初始化数据库

```bash
npx prisma generate
npx prisma db push
```

### 5. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

## 部署到 Vercel

### 方式一：通过 GitHub 部署（推荐）

1. **推送代码到 GitHub**
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   # 创建 GitHub 仓库并推送
   git remote add origin https://github.com/yourusername/resource-hub.git
   git push -u origin main
   ```

2. **在 Vercel 导入项目**
   - 访问 [Vercel](https://vercel.com) 并登录
   - 点击 **Add New...** → **Project**
   - 选择刚才推送的 GitHub 仓库
   - 点击 **Import**

3. **配置环境变量**
   在 Vercel 项目设置中添加以下环境变量：

   | 变量名 | 值 | 说明 |
   |--------|-----|------|
   | `DATABASE_URL` | Supabase 连接字符串 | postgresql://postgres:[密码]@db.xxx.supabase.co:5432/postgres |
   | `NEXTAUTH_URL` | 你的 Vercel 域名 | 如 https://xxx.vercel.app |
   | `NEXTAUTH_SECRET` | 随机字符串 | 用 `openssl rand -base64 32` 生成 |
   | `QINIU_ACCESS_KEY` | 七牛 AccessKey | |
   | `QINIU_SECRET_KEY` | 七牛 SecretKey | |
   | `QINIU_BUCKET` | 存储空间名称 | |
   | `QINIU_ZONE` | 区域代码 | z0/z1/z2/na0 |
   | `QINIU_DOMAIN` | CDN 域名 | |

   可选 OAuth：
   | 变量名 | 值 |
   |--------|-----|
   | `GITHUB_ID` | GitHub OAuth App ID |
   | `GITHUB_SECRET` | GitHub OAuth App Secret |
   | `GOOGLE_ID` | Google OAuth Client ID |
   | `GOOGLE_SECRET` | Google OAuth Client Secret |

4. **部署**
   - 点击 **Deploy**
   - 等待构建完成（约 2-3 分钟）
   - 访问分配的域名

### 方式二：通过 Vercel CLI 部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录 Vercel
vercel login

# 部署（按提示操作）
vercel

# 生产环境部署
vercel --prod
```

### 部署后配置

1. **初始化数据库**
   - 在本地运行 `npx prisma db push` 同步数据库结构
   - 或者在 Vercel 的 PostgreSQL 插件中执行 Prisma migrations

2. **配置域名**（可选）
   - 项目设置 → **Domains** 添加自定义域名
   - 按提示配置 DNS 记录

### 常见问题

- **数据库连接失败**：检查 `DATABASE_URL` 格式，确保 Supabase 的连接池器已启用（端口 6543）
- **七牛文件无法访问**：检查 `QINIU_DOMAIN` 是否配置正确，密钥是否有效
- **OAuth 登录失败**：在 GitHub/Google 开发者平台配置回调 URL：`https://你的域名/api/auth/callback/xxx`

## 项目结构

```
resource-hub/
├── app/                    # Next.js App Router
│   ├── (dashboard)/       # 仪表板页面组
│   ├── api/               # API 路由
│   │   ├── auth/          # 认证相关 API
│   │   ├── files/         # 文件管理 API
│   │   ├── folders/       # 文件夹管理 API
│   │   └── share/         # 分享 API
│   ├── login/             # 登录页
│   ├── register/          # 注册页
│   ├── share/[token]/     # 分享页面
│   └── globals.css        # 全局样式
├── components/            # React 组件
│   ├── ui/               # UI 基础组件
│   ├── FileUpload.tsx    # 文件上传组件
│   ├── FileList.tsx      # 文件列表组件
│   ├── FileCard.tsx      # 文件卡片组件
│   └── ...
├── lib/                   # 工具函数
│   ├── auth.ts           # NextAuth 配置
│   ├── qiniu.ts          # 七牛云 SDK 封装
│   └── utils.ts          # 通用工具函数
├── prisma/                # Prisma Schema
│   └── schema.prisma     # 数据库模型
└── public/                # 静态资源
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
   - **区域**：根据用户群体选择（华东 `z0` / 华北 `z1` / 华南 `z2` / 北美 `na0`）
   - **访问控制**：选择 **私有**（本项目使用私有空间，文件访问需要签名）

### 步骤 3：获取 API 密钥
1. 点击右上角 **个人头像** → **密钥管理**
2. 查看或创建 **AccessKey** 和 **SecretKey**
   - 如果没有，点击 **创建密钥**

### 步骤 4：配置 CDN 加速域名（可选但推荐）
1. 在存储空间详情页，点击 **域名管理**
2. 添加自有域名（或使用七牛提供的测试域名）
3. 配置完成后，域名会显示为如：`your-domain.e.gcdn.example.com`

### 步骤 5：配置环境变量

在 `.env` 中填入：

```env
QINIU_ACCESS_KEY="your-access-key"      # 从步骤 3 获取
QINIU_SECRET_KEY="your-secret-key"      # 从步骤 3 获取
QINIU_BUCKET="resource-hub"              # 步骤 2 创建的存储空间名称
QINIU_ZONE="z0"                          # 存储区域：z0=华东, z1=华北, z2=华南, na0=北美
QINIU_DOMAIN="your-domain.e.gcdn.example.com"  # CDN 域名（步骤 4）
```

### 区域对应关系

| 区域 | Zone 值 |
|------|---------|
| 华东 | `z0` |
| 华北 | `z1` |
| 华南 | `z2` |
| 北美 | `na0` |

### 注意事项

- **私有空间**：文件访问需要生成签名 URL（默认配置），适合需要授权的资源
- 代码已内置签名逻辑，访问文件时自动生成带签名的 URL，有效期 1 小时

## 许可证

MIT
