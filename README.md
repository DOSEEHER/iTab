# iTab — 极简私有与公开分享书签管理器

> 运行在 **Cloudflare 100% 免费层**（Workers + D1 + Static Assets）上的现代化个人书签导航管理面板。

[![Vue 3](https://img.shields.io/badge/Vue-3.5+-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6+-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Hono](https://img.shields.io/badge/Hono-v4-E36002?logo=hono&logoColor=white)](https://hono.dev/)
[![Cloudflare D1](https://img.shields.io/badge/Cloudflare-D1_SQLite-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/d1/)

---

## ✨ 核心特性

- 🤖 **三级 AI 提示词体系 (3-Tier Prompt Architecture)**：
  - **Tier 1 (全局提示词)**：定义 iTab 目录规范、分类逻辑与 Agent 行为守则。
  - **Tier 2 (分类提示词)**：指导 Agent 访问该类网站时的侧重目标与抓取策略。
  - **Tier 3 (书签提示词)**：为具体卡片设定独有的自动化 SOP、登录策略与执行步骤。
- 🔌 **原生轻量 MCP 服务端 (`/api/mcp`)**：
  - 零外部重量级依赖，直接在 Hono 中实现标准 **Model Context Protocol (JSON-RPC 2.0 over Stateless Streamable HTTP)**。
  - 100% 契合 Cloudflare Workers 免费层，彻底杜绝长时间 SSE 连接超时中断问题。
  - 导出 `get_itab_overview`、`search_bookmarks`、`get_bookmark_agent_playbook`、`manage_category`、`manage_bookmark` 等 5 大核心工具与 `itab_system_guide` 提示词。
  - 自动网页元数据抓取：当 Agent 通过 MCP 创建书签且未传标题/描述时，自动触发边缘 `HTMLRewriter` 爬虫补齐。
- 📄 **LLMs.txt 上下文支持**：
  - 私有全量上下文：`/api/llms.txt?token=<MCP_TOKEN>`。
  - 公开合集只读上下文：`/api/public/s/:slug/llms.txt`，供外部访客一键接入其专属 Agent。
- 🔒 **严格环境变量认证（无注册系统）**：无注册入口与额外用户表，账号密码直接通过 Cloudflare 环境变量注入 (`ADMIN_USERNAME` / `ADMIN_PASSWORD` / `JWT_SECRET`)。
- ⚡️ **双会话登录模式**：
  - **私人设备模式**：30 天持久会话，存储于 `localStorage`，常驻免登，可查看与复制 MCP Token。
  - **临时登录模式**：2 小时临时 Token，仅存入 `sessionStorage`，关闭标签页即销毁；具备 **20 分钟无操作自动退出锁定**，并自动隐藏 MCP Token 与敏感接入凭证。
- 🌐 **分类公开只读分享 (`/s/:slug`)**：
  - 单个分类可一键切换为公开只读，自动生成或自定义 8 位 Slug。
  - 访客免登访问，支持“复制 AI 读取链接 (llms.txt)”。
- 🎯 **全量拖拽排序 & 移动端保护**：
  - 桌面端平滑拖拽分类与书签卡片；移动端设置 220ms 触控延时保护，避免正常滚动误触。
  - 单次批量更新 D1 (`env.DB.batch`)，减少数据库写入次数。
- 🪄 **网页元数据自动解析 & 3 级 Favicon 降级机制**：
  - 输入网址自动调用 Cloudflare `HTMLRewriter` 抓取标题与图标（4 秒超时保护）。
  - `<BookmarkIcon />` 三级降级：自定义图标 ➔ DuckDuckGo/Google Favicon ➔ 确定性颜色首字母 SVG 字母头像，永远不会出现破损裂图。
- 💾 **一键 JSON 数据备份与迁移**：
  - 一键导出 `itab-backup-YYYY-MM-DD.json`（包含全局提示词与卡片级提示词）。
  - 随时导入恢复，批量写入 D1 SQLite。

---

## 🤖 AI Agent & 原生 MCP 服务接入指南

iTab 原生内置了开箱即用的 MCP 服务端，采用 **Stateless Streamable HTTP** 传输协议，任何支持 MCP 协议的智能体客户端（如 Claude Desktop、Cursor、Antigravity、OpenClaw 等）均可无缝直连。

### 1. 认证机制与 MCP Token
- MCP 端点位于：`https://<你的域名>/api/mcp`
- 客户端支持三种认证传入方式：
  1. HTTP Header: `Authorization: Bearer <MCP_TOKEN>`
  2. HTTP Header: `X-MCP-Token: <MCP_TOKEN>`
  3. URL Query: `?token=<MCP_TOKEN>`
- **密钥获取**：
  - 若配置了环境变量 `MCP_API_TOKEN`，系统将直接采用该密钥。
  - 若未配置，系统会自动利用 `JWT_SECRET` 基于 HMAC-SHA256 算法确定性生成全局专属 Token。
  - 登录 iTab 后，点击顶部导航栏的 **「AI / MCP」** 按钮，即可在弹出的控制台中一键查看、复制 Token 及预置的 JSON 配置。

### 2. 主流客户端连接配置

#### A. Claude Desktop / Antigravity 配置 (Streamable HTTP 原生直连)
在 `claude_desktop_config.json` 中添加：
```json
{
  "mcpServers": {
    "itab": {
      "url": "https://<你的域名>/api/mcp",
      "headers": {
        "Authorization": "Bearer <你的_MCP_TOKEN>"
      }
    }
  }
}
```

#### B. Cursor IDE 配置
在 Cursor Settings ➔ MCP Servers 中新增：
- **Name**: `itab`
- **Type**: `command` 或 `http`
- **URL**: `https://<你的域名>/api/mcp`
- **Headers**: `{"Authorization": "Bearer <你的_MCP_TOKEN>"}`

#### C. Stdio-Only 客户端 (通过 mcp-remote 桥接)
若你的客户端仅支持本地命令行 stdio 协议：
```json
{
  "mcpServers": {
    "itab": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://<你的域名>/api/mcp",
        "--header",
        "Authorization: Bearer <你的_MCP_TOKEN>"
      ]
    }
  }
}
```

### 3. MCP 工具与提示词清单

| 工具名称 | 功能描述 |
| :--- | :--- |
| `get_itab_overview` | 读取全局提示词及全站分类目录架构（含分类级 AI 提示词与书签数量） |
| `search_bookmarks` | 按分类 ID 或关键词模糊检索书签及对应的卡片级专属提示词 |
| `get_bookmark_agent_playbook` | 获取融合全局总纲、分类指南与网址 SOP 的复合操作指南 (Composite Playbook) |
| `manage_category` | 支持分类目录的 `create`、`update`、`delete` 及批量 `reorder` |
| `manage_bookmark` | 支持书签的 `create`、`update`、`delete` 及 `move`（创建时自动抓取网页标题和描述） |

- **预置提示词 (Prompt)**：
  - `itab_system_guide`：快速拉取整站系统架构与目录导引。

---

## 🚀 极速本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置本地环境变量

复制示例环境变量文件：
```bash
cp .dev.vars.example .dev.vars
```

`.dev.vars` 内容：
```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
JWT_SECRET=super_secret_jwt_key_please_change_in_production_min32chars
# MCP_API_TOKEN=可选的自定义_mcp_token
```

### 3. 初始化本地 D1 数据库

在本地 SQLite 中执行建表和种子数据：
```bash
npm run db:init:local
```

若已有数据库需要进行平滑增量升级，可执行迁移脚本：
```bash
npx wrangler d1 execute DB --local --file=./migrations/0002_add_ai_agent_mcp.sql
```

### 4. 启动开发服务器

```bash
npm run dev
```

该命令会通过 `concurrently` 同时启动：
- **Vite 前端服务器**：`http://localhost:5173`（带极速 HMR 热更新，自动代理 `/api/*`）
- **Cloudflare Wrangler 边缘服务**：`http://localhost:8787`（运行本地 D1 与 Hono API）

打开浏览器访问 `http://localhost:5173`，使用账号 `admin`，密码 `admin123` 即可登录！

---

## ☁️ 部署到 Cloudflare 免费层 ($0 费用)

### 步骤 1：创建 Cloudflare D1 数据库

在终端中登录并创建 D1 数据库：

```bash
npx wrangler login
npx wrangler d1 create itab-db
```

将生成的 `database_id` 填入项目根目录下的 `wrangler.jsonc` 中对应的 `database_id` 字段。

### 步骤 2：初始化远程生产数据库

首次部署将 `schema.sql` 执行到生产 D1：

```bash
npm run db:init:remote
```

如果是已有实例升级，执行增量迁移：
```bash
npx wrangler d1 execute DB --remote --file=./migrations/0002_add_ai_agent_mcp.sql
```

### 步骤 3：在 Cloudflare 设置生产环境变量

通过 Wrangler 命令行设置管理员账号、密码和 JWT 密钥（可选设置 `MCP_API_TOKEN`）：

```bash
npx wrangler secret put ADMIN_USERNAME
# 输入您的专属管理员用户名，如: myadmin

npx wrangler secret put ADMIN_PASSWORD
# 输入强密码，如: MySecureP@ssw0rd!

npx wrangler secret put JWT_SECRET
# 输入 32 位以上随机字符串

# 可选：自定义固定 MCP 令牌（不设置则自动基于 JWT_SECRET 计算）
npx wrangler secret put MCP_API_TOKEN
```

### 步骤 4：一键构建并部署

```bash
npm run deploy
```

部署完成后，Cloudflare 会输出访问域名（如 `https://itab.<your-subdomain>.workers.dev`），即可永久免费使用！

---

## 🛠 技术栈规范

- **前端**：Vue 3.5+ (`<script setup lang="ts">`, Vue 3.5 响应式解构, `useTemplateRef`)
- **构建工具**：Vite 6+、TypeScript 5.7+
- **状态与路由**：Pinia 3+、Vue Router 4.5+
- **样式**：Tailwind CSS v4 (`@tailwindcss/vite` 官方插件，CSS 优先配置)
- **图标**：`@lucide/vue`
- **拖拽**：`vue-draggable-plus`
- **后端**：Hono v4 (`hono/jwt`、Cloudflare `HTMLRewriter`)
- **AI 协议**：Model Context Protocol (MCP 2024-11-05, Stateless Streamable HTTP)
- **数据存储**：Cloudflare D1 (Edge SQLite)

---

## 📄 开源许可证

MIT License. Designed with high craft.
