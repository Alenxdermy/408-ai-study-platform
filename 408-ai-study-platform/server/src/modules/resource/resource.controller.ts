import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Op } from 'sequelize';
import type { Response } from 'express';
import type { AuthRequest } from '../../middlewares/auth.js';
import { ResourceDocumentModel } from '../../models/resource-document.model.js';
import { AppError, ok } from '../../shared/http.js';
import { resourceService } from './resource.service.js';

const PDF_MIME_TYPE = 'application/pdf';

export class ResourceController {
  static async upload(req: AuthRequest, res: Response) {
    if (!req.file) throw new AppError(400, '请上传 PDF 文件', 'FILE_REQUIRED');
    const document = await resourceService.createPdfResource(req.userId, req.file, req.body);
    ok(res, document, 'PDF 上传成功');
  }

  static async list(req: AuthRequest, res: Response) {
    const { category, keyword } = req.query;
    const where: any = { status: 'published' };
    if (category && category !== 'all') where.category = category;
    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } },
        { originalName: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const documents = await ResourceDocumentModel.findAll({
      where,
      attributes: { exclude: ['storagePath'] },
      order: [['updatedAt', 'DESC']],
      limit: 100
    });
    ok(res, documents);
  }

  static async detail(req: AuthRequest, res: Response) {
    const document = await ResourceDocumentModel.findOne({
      where: { id: req.params.id, status: 'published' },
      attributes: { exclude: ['storagePath'] }
    });
    if (!document) throw new AppError(404, '资料不存在', 'RESOURCE_NOT_FOUND');
    ok(res, document);
  }

  static async summarize(req: AuthRequest, res: Response) {
    const document = await resourceService.regenerateSummary(String(req.params.id));
    ok(res, document, 'AI 摘要生成成功');
  }

  static async read(req: AuthRequest, res: Response) {
    await ResourceController.streamPdf(req, res, 'inline');
  }

  static async download(req: AuthRequest, res: Response) {
    await ResourceController.streamPdf(req, res, 'attachment');
  }

  private static async streamPdf(req: AuthRequest, res: Response, disposition: 'inline' | 'attachment') {
    const document = await ResourceDocumentModel.findByPk(String(req.params.id));
    if (!document || document.status !== 'published') {
      throw new AppError(404, '资料不存在', 'RESOURCE_NOT_FOUND');
    }
    if (document.mimeType !== PDF_MIME_TYPE) {
      throw new AppError(400, '当前资料不是 PDF 文件', 'NOT_PDF_RESOURCE');
    }

    const absolutePath = path.resolve(document.storagePath);
    await stat(absolutePath);
    
    const updateData = disposition === 'inline' 
      ? { viewCount: document.viewCount + 1 }
      : { downloadCount: document.downloadCount + 1 };
    await document.update(updateData);

    const encodedName = encodeURIComponent(document.originalName);
    res.setHeader('Content-Type', PDF_MIME_TYPE);
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
    createReadStream(absolutePath).pipe(res);
  }
}

