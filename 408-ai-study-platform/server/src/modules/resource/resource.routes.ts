import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middlewares/auth.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { env } from '../../shared/env.js';
import { ResourceController } from './resource.controller.js';

const MAX_PDF_SIZE_BYTES = 30 * 1024 * 1024;

const upload = multer({
  dest: env.UPLOAD_DIR,
  limits: { fileSize: MAX_PDF_SIZE_BYTES }
});

export const resourceRouter = Router();

resourceRouter.get('/', asyncHandler(ResourceController.list));
resourceRouter.get('/:id/read', asyncHandler(ResourceController.read));
resourceRouter.get('/:id/download', asyncHandler(ResourceController.download));
resourceRouter.get('/:id', asyncHandler(ResourceController.detail));
resourceRouter.post('/:id/summary', requireAuth, asyncHandler(ResourceController.summarize));
resourceRouter.post('/pdf', requireAuth, upload.single('file'), asyncHandler(ResourceController.upload));
