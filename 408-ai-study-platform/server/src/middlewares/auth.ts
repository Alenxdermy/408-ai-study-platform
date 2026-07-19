import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/user.model.js';
import { env } from '../shared/env.js';
import { AppError } from '../shared/http.js';

export interface AuthRequest extends Request {
  userId?: string;
}

const authenticate = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) throw new AppError(401, '请先登录', 'UNAUTHORIZED');

  let payload: { sub: string };
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
  } catch {
    throw new AppError(401, '登录状态已过期，请重新登录', 'TOKEN_INVALID');
  }

  const user = await UserModel.findByPk(payload.sub, { attributes: ['id', 'status'] });
  if (!user || user.status !== 'active') throw new AppError(401, '登录状态无效', 'UNAUTHORIZED');

  req.userId = user.id;
  next();
};

export const requireAuth: RequestHandler = (req, res, next) => {
  void authenticate(req, res, next).catch(next);
};
