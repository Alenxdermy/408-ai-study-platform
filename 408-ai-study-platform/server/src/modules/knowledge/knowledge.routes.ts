import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middlewares/auth.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { env } from '../../shared/env.js';
import { KnowledgeController } from './knowledge.controller.js';

const upload = multer({ dest: env.UPLOAD_DIR });
export const knowledgeRouter = Router();

knowledgeRouter.post('/documents', requireAuth, upload.single('file'), asyncHandler(KnowledgeController.upload));
knowledgeRouter.post('/ask', requireAuth, asyncHandler(KnowledgeController.ask));
