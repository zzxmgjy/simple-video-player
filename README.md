# 简单视频播放器

一个基于 Vue 3 + TypeScript + Tailwind CSS + ... 的视频播放器项目，支持在线播放视频、搜索、过滤广告等功能。

毫无技术含量，只是简单的组合，cursor搭建~

## 本工具仅供学习使用，请勿用于非法用途！


## 功能特点

- 支持响应式设计，适配电脑、手机和平板
- 支持日间/夜间模式切换
- 支持剧集搜索（注意：频繁搜索会报错）
- 支持切片广告过滤（内置）
- 支持标签系统（标签数据保存在浏览器localStorage）（快速添加：剧集按钮的右键菜单）
- 支持自定义背景
- 支持用户登录（密码的配置是在管理后台）
- 支持管理后台（密码的配置是在环境变量）

## 技术栈

- Vue 3
- TypeScript
- Tailwind CSS
- Vite
- DPlayer
- Vue Router
- Pinia
- VueUse
- Sweetalert2
- Jina
- ...

## 部署

### 本地部署

1. 安装依赖：
```bash
npm install
```

2. 配置环境变量：
复制 `.env.example` 到 `.env` 并填写相应的配置（云部署的时候不需要.env文件）：
```bash
# 数据库连接字符串
SQL_DSN='your_mysql_connection_string'
```

3. 启动开发服务器：
```bash
npm run dev:local
```

### Cloudflare Pages 部署

1. fork项目

2. 部署到cloudflare pages
```bash
# 构建命令
npm run build
# 构建目录
dist
```

3. 配置环境变量
#### 基础变量
ADMIN_PASSWORD

LOGIN_JWT_SECRET_KEY

#### 数据库-pgsql url（比如 supabase的）
PG_CONNECTION_STRING

#### 数据库-KV
支持KV，命名空间为VIDEO_CONFIG，但试过了，只能在wrangler.toml配置绑定，为了避免泄漏隐私，可以将github本项目设置为private，再在wrangler.toml配置cloudflare的KV命名空间ID即可

#### 数据库-SQL-DSN
不支持，cloudflare不支持没办法

小结-部署cf需要配置基础变量和数据库变量，比较推荐使用的数据库是：pgsql url（比如：supabase）

### Vercel 部署

1. fork项目

2. 部署到vercel（部署后，用deno反代一下就行，或者使用自定义域名）
```bash
# 直接使用默认命令就行
# 构建命令
npm run build
# 构建目录
dist
# 安装依赖
npm install
```

3. 配置环境变量
#### 基础变量
ADMIN_PASSWORD

LOGIN_JWT_SECRET_KEY

#### 数据库-pgsql url（比如 supabase的、neon的）
PG_CONNECTION_STRING

#### 数据库-SQL-DSN（比如 aiven的）
##### 格式：`username:password@tcp(hostname:port)/database`  
SQL_DSN

小结-部署vercel需要配置基础变量和数据库变量

## 管理后台配置

在管理页面 (`/admin`) 中可以配置以下内容：

- 资源站点（包含导入/导出、添加/删除/修改）
- 广告过滤 API
- 背景图片
- 首页登录密码
- 首页名称
- 公告

注意-修改配置后的保存：点击页面底部的保存设置按钮才能够真的保存

## 许可证

MIT 

