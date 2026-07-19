# 系统架构

## 分层

- Client：UniApp 多端界面。
- API：Express RESTful 接口。
- Domain：用户、刷题、知识库、学习记录、Agent。
- AI：`LLMService`、RAG、Supervisor、Agent。
- Storage：MongoDB、Chroma、文件存储。

## AI 调用规范

业务模块不得直接实例化模型。所有聊天、Embedding、RAG 入口统一走：

- `server/src/services/llm.service.ts`
- `server/src/services/knowledge.service.ts`
- `server/src/agents/supervisor.agent.ts`

## RAG 流程

上传文件 -> 文档解析 -> Chunk -> Embedding -> Chroma -> Hybrid Search -> Rerank -> LLM 答案生成。

当前版本完成上传记录、文本分块、Chroma 入库和 Hybrid Search 基座；PDF、DOCX 解析器和 Rerank 模型在下一步补齐。

## 无题库阶段策略

没有正式题库时，平台先以 PDF 资料库建立内容资产：

- 上传教材章节、课程讲义、真题解析 PDF。
- 游客可以阅读和下载，先形成可展示的学习资源入口。
- 后台逐步解析 PDF，进入知识库与 RAG。
- 基于知识库生成题目草稿，经过人工审核后写入 `Question`。

这样能避免直接依赖外部题库版权，同时保留后续商业化和竞赛展示空间。
