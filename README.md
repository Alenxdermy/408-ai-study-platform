# 408 AI Study Platform

面向 408 计算机考研用户的 UniApp 微信小程序项目。当前主方案已切换为微信云开发：小程序通过云函数访问云数据库，不再依赖本地 HTTP 后端、局域网 IP、域名校验或 MySQL。

## 1. 项目位置

```text
E:\python chapter\408\408-ai-study-platform
```

云开发环境：

```text
环境名称：cloudbase
环境 ID：cloudbase-d8gk6gtnw00fe55a2
```

云函数目录：

```text
E:\python chapter\408\408-ai-study-platform\cloudfunctions\api
```

## 2. 云端数据结构

请在云开发控制台创建这些数据库集合：

```text
users
questions
study_records
favorites
wrong_books
checkins
resources
import_jobs
```

主要用途：

```text
questions      题库，只保存选择题
users          用户信息、目标分数、打卡统计
study_records  答题记录
favorites      用户收藏题目
wrong_books    用户个人错题本
checkins       打卡记录
resources      PDF 资料元数据，文件本体放云存储
import_jobs    后台 PDF 导入任务状态
```

## 3. 首次云开发部署

第一步，安装项目依赖：

```powershell
cd "E:\python chapter\408\408-ai-study-platform"
npm install --legacy-peer-deps
```

第二步，在微信开发者工具中导入项目根目录：

```text
E:\python chapter\408\408-ai-study-platform
```

注意：现在使用云函数，应该导入项目根目录，不要只导入 `dist\dev\mp-weixin`，否则开发者工具看不到 `cloudfunctions`。

第三步，运行小程序编译：

```powershell
npm run dev:mp-weixin
```

第四步，在微信开发者工具里找到：

```text
cloudfunctions/api
```

右键执行：

```text
上传并部署：云端安装依赖
```

云函数依赖包括：

```text
wx-server-sdk
pdf-parse
```

第五步，在云函数 `api` 的环境变量里配置 DeepSeek：

```text
DEEPSEEK_API_KEY=你的 DeepSeek Key
OPENAI_MODEL=deepseek-v4-pro
```

DeepSeek Key 只放云函数环境变量，不要写进小程序前端代码。

第六步，在云开发控制台的 `API Key` 设置里生成 `Publishable Key`，然后写入根目录 `.env`：

```env
VITE_CLOUD_PUBLISHABLE_KEY=你的 Publishable Key
```

后台 Web 依赖这个 key 在浏览器里通过 CloudBase Web SDK 访问云函数。

## 3.1 本地数据迁移到云端

如果你要把本机 MySQL 和 `docs` 里的 PDF 一次性搬到云端，直接运行：

```powershell
npm run migrate:cloudbase
```

它会迁移数据库，并把 `docs/papers-rebuild` 与 `docs/answers` 里的 PDF 自动上传到云存储，再回填 `resources` 和 `resource_documents` 里的 `fileID`。

它会迁移：

```text
chapters
users
questions
papers
favorites
wrong_books
study_records
review_tasks
chat_histories
agent_logs
knowledge_documents
knowledge_chunks
resource_documents
resources
```

前提是：

```text
本机 MySQL 可连接
VITE_CLOUD_ENV 正确
VITE_CLOUD_PUBLISHABLE_KEY 有效
```

## 4. 日常运行小程序

启动小程序编译：

```powershell
cd "E:\python chapter\408\408-ai-study-platform"
npm run dev:mp-weixin
```

微信开发者工具导入项目根目录：

```text
E:\python chapter\408\408-ai-study-platform
```

小程序端请求链路：

```text
微信小程序 -> wx.cloud.callFunction(api) -> 云数据库
```

因此真机调试不再需要本地后端地址：

```text
http://192.168.x.x:3000/api
```

也不再需要为了访问后端准备域名。

## 5. 后台 Web 管理系统

后台 Web 仍是单独网页，但数据接口已切换为云函数。

启动：

```powershell
cd "E:\python chapter\408\408-ai-study-platform"
npm run dev:admin-web
```

浏览器打开：

```text
http://127.0.0.1:5174
```

后台功能：

```text
题目列表
题目新增
题目编辑
题目删除
JSON 导入
PDF 上传到云存储后识别入库
```

后台 Web 会加载云开发 Web SDK。首次使用前，只要 `.env` 里配置了 `VITE_CLOUD_PUBLISHABLE_KEY`，浏览器就可以直接调用云函数。

## 6. PDF 题目导入

后台导入 PDF 的新流程：

```text
选择 PDF
-> 上传到云存储
-> api 云函数下载云文件
-> 提取选择题
-> 写入 questions 集合
```

注意：

- 云函数不能直接读取你电脑上的 `E:\python chapter\408\docs` 本地文件。
- 原来的“一键导入 2025 真题”在云端不能直接读本地路径。
- 现在应在后台选择对应 PDF 文件上传识别。
- 当前云端 PDF 识别只筛选带 A/B/C/D 选项的选择题。

## 7. PDF 资料库

小程序资料页已支持云存储文件：

```text
resources 集合保存 PDF 元数据和 fileID
云存储保存 PDF 文件本体
小程序使用 wx.cloud.downloadFile 打开 PDF
```

`resources` 记录建议字段：

```json
{
  "title": "2025 年 408 真题",
  "description": "408 统考真题",
  "category": "paper",
  "originalName": "2025.pdf",
  "mimeType": "application/pdf",
  "size": 123456,
  "fileID": "cloud://...",
  "status": "published",
  "viewCount": 0,
  "downloadCount": 0
}
```

答案 PDF 的 `category` 使用：

```text
answer
```

## 8. 常用命令

小程序开发：

```powershell
npm run dev:mp-weixin
```

小程序构建：

```powershell
npm run build:mp-weixin
```

后台 Web 开发：

```powershell
npm run dev:admin-web
```

后台 Web 构建：

```powershell
npm run build:admin-web
```

旧本地后端仍保留，作为本地兜底或数据迁移参考：

```powershell
npm run dev:server
```

## 9. 环境变量

项目根目录 `.env` 当前使用：

```env
VITE_CLOUD_ENV=cloudbase-d8gk6gtnw00fe55a2
VITE_CLOUD_FUNCTION_NAME=api
VITE_CLOUD_PUBLISHABLE_KEY=你的 Publishable Key
VITE_USE_CLOUD=true
VITE_API_BASE_URL=http://127.0.0.1:3000/api
```

说明：

- 微信小程序端默认走云函数。
- 后台 Web 端需要 `VITE_CLOUD_PUBLISHABLE_KEY`。
- `VITE_API_BASE_URL` 只作为 H5 或关闭云函数时的本地兜底地址。
- 如果要临时切回本地后端，可设置 `VITE_USE_CLOUD=false` 并启动 `npm run dev:server`。

## 10. 功能状态

已迁移到云开发：

```text
登录 / 游客登录
微信云环境用户识别
刷题
提交答案
错题本
收藏
用户看板
学习报告
打卡
AI 讲题
题库后台增删改查
JSON 导入
PDF 上传识别入库
PDF 云存储下载/预览
```

保留但不再作为主链路：

```text
Node.js + Express 后端
MySQL ai_408_study 数据库
本地 docs PDF 资源目录
本地 few-shot Python 脚本
```

## 11. 常见问题

### 小程序不开调试仍然访问不了本地后端

现在主链路已经不需要访问本地后端。请确认小程序请求走的是云函数：

```text
VITE_USE_CLOUD=true
```

并且已部署：

```text
cloudfunctions/api
```

### 云函数调用失败

按顺序检查：

1. 是否创建了云开发环境 `cloudbase-d8gk6gtnw00fe55a2`
2. 是否创建了数据库集合
3. 是否上传并部署了 `api` 云函数
4. 是否选择了“云端安装依赖”
5. 云函数环境变量是否配置 `DEEPSEEK_API_KEY`

### 后台 Web 打不开云函数

先检查 `.env` 里的 `VITE_CLOUD_PUBLISHABLE_KEY` 是否正确，再确认云开发控制台里生成的 key 还有效。

### PDF 识别效果不稳定

云端当前使用文本提取方式识别 PDF，适合文字型 PDF。如果 PDF 是扫描图片，必须接入 OCR，否则准确率会比较差。

### 题库数量为 0

说明 `questions` 集合里还没有已发布选择题。可以通过后台 Web 粘贴 JSON 导入，或上传 PDF 识别导入。

## 12. 项目结构

```text
408-ai-study-platform
├─ cloudfunctions
│  └─ api              # 微信云函数统一接口
├─ src                 # UniApp 主源码
├─ pages               # 兼容 HBuilderX 的页面副本
├─ services            # 兼容 HBuilderX 的服务副本
├─ stores              # 状态管理
├─ styles              # 全局样式
├─ admin-web           # 独立题库后台网页
├─ server              # 旧本地 Node 后端，保留兜底
└─ dist                # 构建输出
```
