import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middlewares/auth.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { AuthController } from './auth.controller.js';

export const authRouter = Router();

const phoneSchema = z.string().trim().regex(/^1\d{10}$/, '请输入 11 位手机号');
const passwordSchema = z.string().min(6, '密码至少 6 位');
const nicknameSchema = z.string().trim().min(2, '昵称至少 2 个字').max(32, '昵称过长');
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '请选择有效考试日期').nullable();

authRouter.post('/register', asyncHandler(async (req, res) => {
  const body = z.object({
    phone: phoneSchema,
    password: passwordSchema,
    nickname: nicknameSchema
  }).parse(req.body);
  await AuthController.register(req, res, body);
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const body = z.object({
    phone: phoneSchema,
    password: passwordSchema
  }).parse(req.body);
  await AuthController.login(req, res, body);
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  await AuthController.me(req, res);
}));

authRouter.post('/target', requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({
    targetScore: z.coerce.number().int().min(1, '目标分数至少 1 分').max(150, '408 满分为 150 分'),
    examDate: dateSchema
  }).parse(req.body);
  await AuthController.updateTarget(req, res, body);
}));

authRouter.post('/mock-login', asyncHandler(async (req, res) => {
  const body = z.object({ nickname: z.string().optional() }).parse(req.body);
  await AuthController.mockLogin(req, res, body);
}));

authRouter.post('/wechat-login', asyncHandler(async (req, res) => {
  const body = z.object({ code: z.string().min(1) }).parse(req.body);
  await AuthController.wechatLogin(req, res, body);
}));
