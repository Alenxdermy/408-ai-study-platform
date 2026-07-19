# API 设计

统一响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

## 认证

- `POST /api/auth/mock-login` 开发期登录
- `POST /api/auth/wechat-login` 微信小程序登录

## 刷题

- `GET /api/questions?subject=os&mode=sequence`
- `GET /api/questions/daily`
- `GET /api/questions/wrong-book`
- `POST /api/questions/:id/answer`
- `POST /api/questions/:id/favorite`

## PDF 资料库

- `GET /api/resources` 游客查看公开资料
- `GET /api/resources/:id/read` 游客在线阅读 PDF
- `GET /api/resources/:id/download` 游客下载 PDF
- `POST /api/resources/pdf` 登录用户上传 PDF

## AI Agent

- `POST /api/ai/agent/:agent`

支持：

- `learning_planner`
- `teacher`
- `question`
- `knowledge`
- `review`
- `wrong_book`
- `exam`
- `report`

## 知识库

- `POST /api/knowledge/documents`
- `POST /api/knowledge/ask`

## 学习

- `GET /api/study/dashboard`
- `POST /api/study/checkin`
