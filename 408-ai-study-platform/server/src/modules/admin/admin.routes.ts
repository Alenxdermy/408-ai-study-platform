import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../shared/async-handler.js';
import { AdminQuestionController } from './admin.controller.js';

export const adminRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
      return;
    }
    cb(new Error('只支持上传 PDF 文件'));
  }
});

adminRouter.get('/questions', asyncHandler(AdminQuestionController.list));
adminRouter.get('/questions/stats', asyncHandler(AdminQuestionController.stats));
adminRouter.get('/questions/:id', asyncHandler(AdminQuestionController.detail));
adminRouter.post('/questions', asyncHandler(AdminQuestionController.create));
adminRouter.put('/questions/:id', asyncHandler(AdminQuestionController.update));
adminRouter.delete('/questions/:id', asyncHandler(AdminQuestionController.remove));
adminRouter.post('/questions/import', asyncHandler(AdminQuestionController.importQuestions));
adminRouter.post('/questions/import-2025', asyncHandler(AdminQuestionController.import2025));
adminRouter.post('/questions/import-pdf', upload.single('file'), asyncHandler(AdminQuestionController.importPdf));
