# 408 AI Study Platform

面向 408 计算机考研用户的 UniApp 微信小程序项目。当前功能包括：首页学习看板、刷题训练、数据库驱动的 PDF 真题/答案资料库、AI 讲题、个人学习页，以及 Node.js + Express 后端服务。

## 1. 当前状态

项目代码目录：

```text
E:\python chapter\408\408-ai-study-platform
```

PDF 文件目录：

```text
E:\python chapter\408\docs
├─ papers-rebuild   # 2009-2025 年真题 PDF
└─ answers          # 2009-2025 年答案 PDF
```

数据库：

```text
本地 MySQL
数据库名：ai_408_study
PDF 资源表：resource_documents
```

当前 PDF 方案：

```text
PDF 文件本体：保存在 E:\python chapter\408\docs
PDF 元数据：保存在 MySQL 的 resource_documents 表
小程序资料页：从后端 /api/resources 读取数据库记录
```

## 2. 日常运行

日常开发只需要启动后端和小程序前端，不需要每次初始化数据库，也不需要每次同步 PDF。

第一步，启动 MySQL。

第二步，打开一个终端启动后端：

```powershell
cd "E:\python chapter\408\408-ai-study-platform"
npm run dev:server
```

看到类似输出即正常：

```text
mysql connected
mysql model synchronization skipped
server listening on http://localhost:3000
```

第三步，再打开一个新终端启动微信小程序编译：

```powershell
cd "E:\python chapter\408\408-ai-study-platform"
npm run dev:mp-weixin
```

第四步，打开微信开发者工具，导入这个目录：

```text
E:\python chapter\408\408-ai-study-platform\dist\dev\mp-weixin
```

注意：不要导入项目根目录，要导入 `dist\dev\mp-weixin`。

## 3. 首次环境准备

只在第一次使用项目，或换电脑、删除依赖后执行。

检查 Node.js 和 npm：

```powershell
node -v
npm -v
```

进入项目目录：

```powershell
cd "E:\python chapter\408\408-ai-study-platform"
```

安装前端依赖：

```powershell
npm install --legacy-peer-deps
```

安装后端依赖：

```powershell
npm --prefix server install --legacy-peer-deps
```

## 4. 环境变量

后端配置文件位置：

```text
E:\python chapter\408\408-ai-study-platform\server\.env
```

关键配置应类似：

```env
NODE_ENV=development
PORT=3000
CLIENT_ORIGIN=http://localhost:5173

DB_HOST=localhost
DB_PORT=3306
DB_NAME=ai_408_study
DB_USER=root
DB_PASSWORD=你的数据库密码
DB_SYNC_MODE=none

JWT_SECRET=dev-secret-key-for-408-study-platform-2026
JWT_EXPIRES_IN=7d

OPENAI_API_KEY=你的OpenAI兼容接口Key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

STATIC_DOCS_DIR=E:\python chapter\408\docs
UPLOAD_DIR=uploads
LOG_LEVEL=info
```

重点：

- `DB_SYNC_MODE` 日常必须保持 `none`。
- `STATIC_DOCS_DIR` 必须指向 `E:\python chapter\408\docs`。
- API Key 只写在后端 `.env`，不要写进前端代码。
- 正确变量名是 `OPENAI_API_KEY`，不是 `OPENEN_API_KEY`。

## 5. 数据库初始化

你现在已经初始化过数据库。一般不需要重复执行。

第一次初始化数据库时运行：

```powershell
cd "E:\python chapter\408\408-ai-study-platform"
npm run db:init
```

这个命令会创建：

```text
ai_408_study
```

并创建项目表。

如果开发阶段数据库坏了，可以重置本项目数据库：

```powershell
npm run db:reset
```

警告：`db:reset` 会删除并重建 `ai_408_study`，会清空该库里的数据。日常不要运行。

## 6. PDF 资源同步

你不需要每次运行 `npm run resources:sync`。

只有以下情况才需要运行：

- 第一次把 PDF 写入数据库
- 新增了 PDF 文件
- 替换了 PDF 文件
- 修改了 `E:\python chapter\408\docs` 目录里的文件
- 执行过 `npm run db:reset`

同步命令：

```powershell
cd "E:\python chapter\408\408-ai-study-platform"
npm run resources:sync
```

该命令会扫描：

```text
E:\python chapter\408\docs
```

并把 PDF 元数据写入：

```text
resource_documents
```

它不会删除 PDF 文件，也不会把 PDF 二进制塞进数据库。

## 7. 接口测试

后端启动后，浏览器测试健康接口：

```text
http://localhost:3000/health
```

测试 PDF 资源列表：

```text
http://localhost:3000/api/resources
```

如果返回资源列表，说明数据库和资料接口正常。

测试单个 PDF：

1. 先从 `/api/resources` 返回结果里复制一个 `id`
2. 再访问：

```text
http://localhost:3000/api/resources/资源ID/read
```

下载接口：

```text
http://localhost:3000/api/resources/资源ID/download
```

## 8. 微信开发者工具设置

开发阶段建议勾选：

```text
详情 -> 本地设置 -> 不校验合法域名、web-view、TLS 版本以及 HTTPS 证书
```

否则本地接口、PDF 预览、PDF 下载可能失败。

## 9. 真机调试

如果只在电脑微信开发者工具中运行，可以使用：

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

如果要手机真机预览，不能使用 `localhost`。需要改成电脑局域网 IP。

查看电脑 IP：

```powershell
ipconfig
```

假设电脑 IP 是 `192.168.1.8`，项目根目录 `.env` 写：

```env
VITE_API_BASE_URL=http://192.168.1.8:3000/api
```

然后重新运行：

```powershell
npm run dev:mp-weixin
```

真机调试还要保证：

- 手机和电脑在同一个 WiFi
- 后端正在运行
- Windows 防火墙允许 Node.js
- 微信开发者工具已勾选不校验合法域名

## 10. 常用命令

日常启动后端：

```powershell
npm run dev:server
```

日常启动微信小程序：

```powershell
npm run dev:mp-weixin
```

构建微信小程序：

```powershell
npm run build:mp-weixin
```

构建后端：

```powershell
npm run build:server
```

初始化数据库：

```powershell
npm run db:init
```

重置数据库：

```powershell
npm run db:reset
```

同步 PDF 资源：

```powershell
npm run resources:sync
```

运行测试：

```powershell
npm run test
```

## 11. 项目结构

```text
408-ai-study-platform
├─ src                  # UniApp 主源码目录
│  ├─ pages             # 小程序页面
│  ├─ services          # 前端请求封装
│  ├─ stores            # Pinia 状态管理
│  └─ styles            # 全局样式
├─ pages                # 兼容 HBuilderX 的页面副本
├─ services             # 兼容 HBuilderX 的服务副本
├─ stores               # 兼容 HBuilderX 的状态副本
├─ styles               # 兼容 HBuilderX 的样式副本
├─ server               # Node.js + Express 后端
├─ dist                 # 编译输出目录
├─ package.json         # 根脚本
├─ pages.json           # UniApp 页面配置
├─ manifest.json        # 小程序基础配置
└─ .env.example         # 环境变量示例
```

当前项目同时保留了根目录页面和 `src` 页面，是为了兼容 HBuilderX 和命令行构建。修改页面时两处要保持同步，后续可以再统一收敛。

## 12. 常见问题

### 小程序打开后还是 Hello 页面

原因通常是导入目录错了。

正确导入：

```text
E:\python chapter\408\408-ai-study-platform\dist\dev\mp-weixin
```

不要导入：

```text
E:\python chapter\408\408-ai-study-platform
```

### 资料页没有 PDF

按顺序检查：

1. 后端是否启动：`npm run dev:server`
2. 数据库是否有 `ai_408_study`
3. 浏览器是否能打开：`http://localhost:3000/api/resources`
4. 是否执行过：`npm run resources:sync`
5. `STATIC_DOCS_DIR` 是否指向 `E:\python chapter\408\docs`

### PDF 预览失败

按顺序检查：

1. 后端是否启动
2. 微信开发者工具是否勾选“不校验合法域名”
3. 真机调试时是否使用电脑局域网 IP
4. 手机和电脑是否同一 WiFi
5. Windows 防火墙是否允许 Node.js

### 后端启动失败

优先检查：

- MySQL 是否启动
- `server\.env` 是否存在
- `DB_PASSWORD` 是否正确
- `DB_SYNC_MODE` 是否为 `none`
- `JWT_SECRET` 是否至少 16 位
- `STATIC_DOCS_DIR` 是否正确

### npm 报 npm-cli.js 找不到

说明系统 npm 入口损坏。先检查：

```powershell
where npm
npm -v
```

正常应该指向 Node.js 安装目录，例如：

```text
E:\nodejs\npm.cmd
```

### PowerShell 中文乱码

先执行：

```powershell
chcp 65001
```

再运行项目命令。

## 13. 推荐开发顺序

每次开发建议按这个顺序：

1. 启动 MySQL
2. 启动后端：`npm run dev:server`
3. 浏览器测试：`http://localhost:3000/health`
4. 浏览器测试：`http://localhost:3000/api/resources`
5. 启动小程序：`npm run dev:mp-weixin`
6. 微信开发者工具导入：`dist\dev\mp-weixin`
7. 测试首页、资料页、PDF 预览和下载
8. 再测试 AI 讲题等需要 `OPENAI_API_KEY` 的功能

## 14. 后续开发建议

优先级建议：

1. 增加 PDF 年份详情页，支持真题、答案、AI 解析联动
2. 从 PDF 或结构化文件生成题库
3. 完善错题本、收藏夹、学习记录闭环
4. 增加微信登录正式配置
5. 后续上线时迁移到云服务器和对象存储
