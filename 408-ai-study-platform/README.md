# 408 AI 导师小程序

这是面向 408 计算机考研用户的 UniApp 微信小程序项目。当前目录已经重构为 HBuilderX 可直接识别的项目根目录。

## 目录说明

- `src/App.vue`、`src/main.ts`、`src/pages.json`、`src/manifest.json`：UniApp 小程序入口
- `src/pages/`：微信小程序页面
- `src/services/`：前端 API 请求封装
- `src/stores/`：Pinia 状态管理
- `server/`：Node.js + Express + MongoDB 后端
- `docs/`：架构与 API 文档

## HBuilderX 运行

1. 打开 HBuilderX。
2. 选择“导入项目”。
3. 项目目录选择 `E:\python chapter\408\exercises`。
4. 运行到“微信开发者工具”。

如果使用命令行构建：

```bash
pnpm install
pnpm run build:mp-weixin
```

构建产物在：

```text
dist/build/mp-weixin
```

## 后端运行

复制 `.env.example` 为 `.env`，至少配置：

```text
MONGODB_URI=mongodb://localhost:27017/ai_408_study
JWT_SECRET=replace-with-a-strong-secret
OPENAI_API_KEY=
```

启动后端：

```bash
pnpm run dev:server
```

默认 API 地址：

```text
http://127.0.0.1:3000/api
```

## PDF 资料功能

小程序端已提供：

- PDF 上传
- PDF 列表
- PDF 阅读
- PDF 保存

没有题库时，建议先上传教材章节、课程讲义、真题解析 PDF，后续再基于资料库生成结构化题库。

## 验证命令

```bash
pnpm run build:mp-weixin
pnpm run build:server
pnpm --dir server test
```
