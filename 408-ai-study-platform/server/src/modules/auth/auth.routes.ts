import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/async-handler.js';
import { AuthController } from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/mock-login', asyncHandler(async (req, res) => {
  const body = z.object({ nickname: z.string().optional() }).parse(req.body);
  await AuthController.mockLogin(req, res, body);
}));

authRouter.post('/wechat-login', asyncHandler(async (req, res) => {
  const body = z.object({ code: z.string().min(1) }).parse(req.body);
  await AuthController.wechatLogin(req, res, body);
}));
