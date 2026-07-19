import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { StudyController } from './study.controller.js';

export const studyRouter = Router();

studyRouter.get('/dashboard', requireAuth, asyncHandler(StudyController.dashboard));
studyRouter.post('/checkin', requireAuth, asyncHandler(StudyController.checkin));
