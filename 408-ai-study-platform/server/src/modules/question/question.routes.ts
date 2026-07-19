import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { QuestionController } from './question.controller.js';

export const questionRouter = Router();

questionRouter.get('/', requireAuth, asyncHandler(QuestionController.list));
questionRouter.get('/daily', requireAuth, asyncHandler(QuestionController.daily));
questionRouter.get('/wrong-book', requireAuth, asyncHandler(QuestionController.wrongBook));
questionRouter.post('/:id/answer', requireAuth, asyncHandler(QuestionController.answer));
questionRouter.post('/:id/favorite', requireAuth, asyncHandler(QuestionController.toggleFavorite));
