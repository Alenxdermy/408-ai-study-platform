import type { Response } from 'express';
import type { AuthRequest } from '../../middlewares/auth.js';
import { knowledgeService } from '../../services/knowledge.service.js';
import { AppError, ok } from '../../shared/http.js';

export class KnowledgeController {
  static async upload(req: AuthRequest, res: Response) {
    if (!req.file) throw new AppError(400, '请上传知识库文件', 'FILE_REQUIRED');
    const document = await knowledgeService.ingestUploadedFile(req.userId ?? '', req.file);
    ok(res, document, '上传并入库成功');
  }

  static async ask(req: AuthRequest, res: Response) {
    const answer = await knowledgeService.answerWithRag(req.userId ?? '', String(req.body.query ?? ''));
    ok(res, { answer });
  }
}
