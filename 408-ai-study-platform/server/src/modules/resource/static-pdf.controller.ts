import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { Request, Response } from 'express';
import { AppError } from '../../shared/http.js';
import { env } from '../../shared/env.js';

const PDF_MIME_TYPE = 'application/pdf';
const ALLOWED_GROUPS = new Set(['papers-rebuild', 'answers']);

const resolveStaticPdfPath = async (group: string, file: string) => {
  if (!ALLOWED_GROUPS.has(group)) {
    throw new AppError(400, '资料分类不合法', 'INVALID_STATIC_PDF_GROUP');
  }

  const isPaper = group === 'papers-rebuild' && /^20\d{2}\.pdf$/.test(file);
  const isAnswer = group === 'answers' && /^20\d{2}-answer\.pdf$/.test(file);
  if (!isPaper && !isAnswer) {
    throw new AppError(400, '资料文件名不合法', 'INVALID_STATIC_PDF_FILE');
  }

  const docsRoot = path.resolve(env.STATIC_DOCS_DIR);
  const absolutePath = path.resolve(docsRoot, group, file);
  if (!absolutePath.startsWith(path.resolve(docsRoot))) {
    throw new AppError(400, '资料路径不合法', 'INVALID_STATIC_PDF_PATH');
  }

  await stat(absolutePath);
  return absolutePath;
};

export class StaticPdfController {
  static async preview(req: Request, res: Response) {
    await StaticPdfController.stream(req, res, 'inline');
  }

  static async download(req: Request, res: Response) {
    await StaticPdfController.stream(req, res, 'attachment');
  }

  private static async stream(req: Request, res: Response, disposition: 'inline' | 'attachment') {
    const group = String(req.params.group);
    const file = String(req.params.file);
    const absolutePath = await resolveStaticPdfPath(group, file);
    const encodedName = encodeURIComponent(file);

    res.setHeader('Content-Type', PDF_MIME_TYPE);
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
    createReadStream(absolutePath).pipe(res);
  }
}

