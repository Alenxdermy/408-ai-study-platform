# 408 AI Study Platform

面向 408 计算机考研用户的 UniApp 微信小程序项目。当前项目重点支持：首页学习看板、刷题训练、AI 讲题入口、固定 PDF 真题/答案资料库、个人学习页，以及 Node.js + Express 后端服务。

当前正式项目目录：

```text
E:\python chapter\408\408-ai-study-platform
```

固定 PDF 资料目录：

```text
E:\python chapter\408\docs
├─ papers-rebuild   # 2009-2025 年真题 PDF，例如 2025.pdf
└─ answers          # 2009-2025 年答案 PDF，例如 2025-answer.pdf
```

## 1. 项目结构

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
├─ package.json         # 前端和根脚本
├─ pages.json           # UniApp 页面配置
├─ manifest.json        # 小程序基础配置
└─ .env.example         # 环境变量示例
```

说明：当前项目同时保留了根目录页面和 `src` 页面，是为了兼容 HBuilderX 和命令行构建。改页面时建议两处保持同步，后续可以再做一次结构收敛。

## 2. 环境要求

建议使用以下环境：

```text
Node.js >= 20
npm >= 10
VS Code
微信开发者工具
MySQL 8.x 或兼容版本
```

当前项目统一使用 `npm`，不要再使用 `pnpm`。

检查本机环境：

```powershell
node -v
npm -v
```

如果 `npm -v` 报 `Cannot find module ... npm-cli.js`，说明系统 npm 入口损坏，需要先修复 Node.js/npm 后再继续。

## 3. 安装依赖

打开 PowerShell 或 CMD，进入项目根目录：

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

使用 `--legacy-peer-deps` 是为了兼容当前 UniApp、Vue3、uView Plus 的依赖版本组合。

## 4. 配置环境变量

项目根目录已有示例文件：

```text
E:\python chapter\408\408-ai-study-platform\.env.example
```

后端实际读取的文件是：

```text
E:\python chapter\408\408-ai-study-platform\server\.env
```

如果 `server\.env` 不存在，先复制一份：

```powershell
copy .env.example server\.env
```

推荐的 `server\.env` 内容如下，按你的本机环境修改数据库密码和 API Key：

```env
NODE_ENV=development
PORT=3000
CLIENT_ORIGIN=http://localhost:5173
VITE_API_BASE_URL=http://localhost:3000/api

DB_HOST=localhost
DB_PORT=3306
DB_NAME=ai_408_study
DB_USER=root
DB_PASSWORD=你的数据库密码

JWT_SECRET=dev-secret-key-for-408-study-platform
JWT_EXPIRES_IN=7d

OPENAI_API_KEY=你的OpenAI兼容接口Key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

WECHAT_APP_ID=
WECHAT_APP_SECRET=
CHROMA_URL=http://localhost:8000
CHROMA_COLLECTION=ai_408_knowledge

STATIC_DOCS_DIR=E:\python chapter\408\docs
UPLOAD_DIR=uploads
LOG_LEVEL=info
```

注意：

- 正确变量名是 `OPENAI_API_KEY`，不是 `OPENEN_API_KEY`。
- 不要把真实 API Key 写进前端代码。
- 不要把真实 `.env` 提交到代码仓库。
- `STATIC_DOCS_DIR` 必须指向真实存在的 `E:\python chapter\408\docs`。

## 5. 初始化数据库

当前后端启动时会连接数据库，所以需要先保证 MySQL 可用。

在 MySQL 中创建数据库：

```sql
CREATE DATABASE ai_408_study DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

确认 `server\.env` 中的数据库配置与本机一致：

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=ai_408_study
DB_USER=root
DB_PASSWORD=你的数据库密码
```

如果数据库没有启动，后端也会启动失败，PDF 预览接口也无法访问。

## 6. 启动后端服务

在项目根目录运行：

```powershell
cd "E:\python chapter\408\408-ai-study-platform"
npm run dev:server
```

启动成功后，终端会看到类似输出：

```text
server listening on http://localhost:3000
```

浏览器访问健康检查：

```text
http://localhost:3000/health
```

如果返回 `code: 0` 或健康状态数据，说明后端服务正常。

## 7. 测试 PDF 接口

后端启动后，先在浏览器测试真题 PDF：

```text
http://localhost:3000/api/resources/static-pdfs/papers-rebuild/2025.pdf/preview
```

再测试答案 PDF：

```text
http://localhost:3000/api/resources/static-pdfs/answers/2025-answer.pdf/preview
```

下载接口示例：

```text
http://localhost:3000/api/resources/static-pdfs/papers-rebuild/2025.pdf/download
```

如果浏览器能打开 PDF，说明后端固定资料接口正常。小程序中预览失败时，优先检查后端是否启动、微信开发者工具是否合法域名校验、以及接口地址是否是手机能访问的地址。

## 8. 启动微信小程序前端

另开一个 PowerShell 或 CMD，不要关闭后端终端。

```powershell
cd "E:\python chapter\408\408-ai-study-platform"
npm run dev:mp-weixin
```

编译成功后会生成：

```text
E:\python chapter\408\408-ai-study-platform\dist\dev\mp-weixin
```

然后打开微信开发者工具，导入这个目录：

```text
E:\python chapter\408\408-ai-study-platform\dist\dev\mp-weixin
```

如果微信开发者工具要求填写 AppID，开发阶段可以使用测试号或自己的小程序 AppID。

## 9. 微信开发者工具设置

本地开发阶段建议勾选：

```text
详情 -> 本地设置 -> 不校验合法域名、web-view、TLS 版本以及 HTTPS 证书
```

否则本地 `localhost:3000` 接口、PDF 预览和下载可能失败。

如果看到日志通道 WebSocket 报错，但页面和接口能正常使用，通常是开发工具本地调试通道问题，不一定是项目业务错误。

## 10. 真机调试

真机调试时不能使用 `localhost`，因为手机上的 `localhost` 指向手机自己，不是电脑。

先查询电脑局域网 IP，例如：

```powershell
ipconfig
```

假设电脑 IP 是 `192.168.1.8`，在项目根目录创建或修改 `.env`：

```env
VITE_API_BASE_URL=http://192.168.1.8:3000/api
```

然后重新编译小程序：

```powershell
npm run dev:mp-weixin
```

真机调试还需要确认：

- 手机和电脑连接同一个 WiFi。
- 后端服务正在运行。
- Windows 防火墙允许 Node.js 访问网络。
- 微信小程序后台生产环境需要配置合法域名，开发阶段可先使用“不校验合法域名”。

## 11. H5 运行方式

如果要在浏览器里调试 H5：

```powershell
cd "E:\python chapter\408\408-ai-study-platform"
npm run dev:h5
```

H5 默认会使用本机后端接口。请同时保持后端运行：

```powershell
npm run dev:server
```

## 12. 构建命令

构建微信小程序：

```powershell
npm run build:mp-weixin
```

构建 H5：

```powershell
npm run build:h5
```

构建后端：

```powershell
npm run build:server
```

运行后端构建产物：

```powershell
npm --prefix server run start
```

## 13. 测试命令

运行后端测试：

```powershell
npm run test
```

运行代码检查：

```powershell
npm run lint
```

构建检查推荐顺序：

```powershell
npm run build:mp-weixin
npm run build:server
```

## 14. 当前固定 PDF 资料逻辑

PDF 上传功能已经取消。资料页现在固定展示本地资料：

```text
papers-rebuild: 2009.pdf 到 2025.pdf
answers: 2009-answer.pdf 到 2025-answer.pdf
```

小程序资料页支持：

- 按年份展示真题和答案。
- 搜索年份、真题、答案。
- 按全部、真题、答案筛选。
- 预览 PDF。
- 下载 PDF。

资料文件不需要上传到小程序包内，由后端从 `STATIC_DOCS_DIR` 读取并返回。

## 15. OPENAI_API_KEY 配置

后端统一读取：

```text
OPENAI_API_KEY
```

推荐方式是在 `server\.env` 中配置：

```env
OPENAI_API_KEY=你的真实Key
```

也可以设置 Windows 用户变量：

```powershell
[Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "你的真实Key", "User")
```

设置用户变量后，需要关闭并重新打开 VS Code、CMD、PowerShell 和后端服务，否则旧终端读不到新变量。

检查用户变量：

```powershell
[Environment]::GetEnvironmentVariable("OPENAI_API_KEY", "User")
```

为了安全，前端小程序不应该直接读取或保存 `OPENAI_API_KEY`。所有 AI 调用都应该走后端统一封装服务。

## 16. 常见问题

### 16.1 npm 报 npm-cli.js 找不到

现象：

```text
Cannot find module 'C:\Users\...\AppData\Roaming\npm\node_modules\npm\bin\npm-cli.js'
```

处理：

```powershell
where npm
npm -v
```

正常情况下，`npm` 应该指向 Node.js 安装目录下的 `npm.cmd`，例如：

```text
E:\nodejs\npm.cmd
```

如果仍然指向用户目录下损坏的 npm，需要清理错误的用户 npm 入口或重新安装 Node.js。

### 16.2 HBuilderX 提示 node_modules 缺少编译器模块

优先使用 VS Code + 命令行运行：

```powershell
npm run dev:mp-weixin
```

如果必须使用 HBuilderX，确认 HBuilderX 内置 npm 目录完整，并且项目根目录已经执行过：

```powershell
npm install --legacy-peer-deps
```

### 16.3 小程序打开后还是 Hello 页面

检查微信开发者工具导入的目录是否正确。应该导入编译输出目录：

```text
E:\python chapter\408\408-ai-study-platform\dist\dev\mp-weixin
```

不是项目源码根目录，也不是旧的 `exercises` 目录。

### 16.4 PDF 预览打开失败

按顺序检查：

1. 后端是否正在运行：`npm run dev:server`
2. 浏览器是否能打开 PDF 预览接口。
3. `server\.env` 中 `STATIC_DOCS_DIR` 是否正确。
4. 微信开发者工具是否勾选“不校验合法域名”。
5. 真机调试时 `VITE_API_BASE_URL` 是否改成电脑局域网 IP。
6. Windows 防火墙是否允许 Node.js。

### 16.5 后端启动失败

优先检查：

- `server\.env` 是否存在。
- `DB_PASSWORD` 是否正确。
- MySQL 是否启动。
- `JWT_SECRET` 长度是否至少 16 位。
- `STATIC_DOCS_DIR` 是否指向真实 docs 目录。

### 16.6 PowerShell 中文乱码

先执行：

```powershell
chcp 65001
```

再运行项目命令。

## 17. 推荐开发顺序

每次开发建议按这个顺序启动：

1. 启动 MySQL。
2. 启动后端：`npm run dev:server`
3. 浏览器测试：`http://localhost:3000/health`
4. 浏览器测试 PDF 预览接口。
5. 启动小程序：`npm run dev:mp-weixin`
6. 微信开发者工具导入：`dist\dev\mp-weixin`
7. 测试首页、资料页、PDF 预览和下载。
8. 再测试 AI 讲题等需要 `OPENAI_API_KEY` 的功能。

## 18. 后续开发建议

下一阶段建议优先做以下工作：

- 把根目录页面和 `src` 页面合并为单一源码结构，降低维护成本。
- 增加 PDF 年份详情页，支持真题、答案、AI 解析联动。
- 增加题库导入脚本，从 PDF 或结构化文件生成题目数据。
- 后端增加静态 PDF 接口的数据库解耦，避免数据库异常影响资料预览。
- 完善 AI 调用统一封装，所有 AI 功能只通过后端服务调用。
- 增加微信登录、学习记录、错题本和收藏的完整闭环。
