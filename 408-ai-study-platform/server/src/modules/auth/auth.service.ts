import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { UserModel } from '../../models/user.model.js';
import { env } from '../../shared/env.js';
import { AppError } from '../../shared/http.js';

interface WechatSessionResponse {
  openid?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

const signToken = (userId: string) => {
  const signOptions: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign({ sub: userId }, env.JWT_SECRET, signOptions);
};

const sanitizeUser = (user: UserModel) => {
  const plain = user.get({ plain: true }) as Record<string, unknown>;
  delete plain.passwordHash;
  return plain;
};

export class AuthService {
  static async issueMockUser(nickname?: string) {
    const user = await UserModel.create({ nickname: nickname ?? '408 考生' });
    return { token: signToken(user.id), user: sanitizeUser(user) };
  }

  static async registerWithPassword(payload: { phone: string; password: string; nickname: string }) {
    const existingUser = await UserModel.findOne({ where: { phone: payload.phone } });
    if (existingUser) {
      throw new AppError(409, '该手机号已经注册', 'PHONE_EXISTS');
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = await UserModel.create({
      phone: payload.phone,
      passwordHash,
      nickname: payload.nickname
    });

    return { token: signToken(user.id), user: sanitizeUser(user) };
  }

  static async loginWithPassword(payload: { phone: string; password: string }) {
    const user = await UserModel.findOne({ where: { phone: payload.phone } });
    if (!user || !user.passwordHash) {
      throw new AppError(401, '账号或密码错误', 'INVALID_CREDENTIALS');
    }

    const matched = await bcrypt.compare(payload.password, user.passwordHash);
    if (!matched) {
      throw new AppError(401, '账号或密码错误', 'INVALID_CREDENTIALS');
    }

    return { token: signToken(user.id), user: sanitizeUser(user) };
  }

  static async getCurrentUser(userId: string) {
    const user = await UserModel.findByPk(userId);
    if (!user) {
      throw new AppError(401, '登录状态已失效，请重新登录', 'UNAUTHORIZED');
    }

    return sanitizeUser(user);
  }

  static async updateStudyTarget(userId: string, payload: { targetScore: number; examDate: string | null }) {
    const user = await UserModel.findByPk(userId);
    if (!user) {
      throw new AppError(401, '登录状态已失效，请重新登录', 'UNAUTHORIZED');
    }

    await user.update({
      targetScore: payload.targetScore,
      examDate: payload.examDate ? new Date(`${payload.examDate}T00:00:00`) : null
    });

    return sanitizeUser(user);
  }

  static async loginWithWechat(code: string) {
    if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET) {
      throw new AppError(500, '微信登录配置未完成', 'WECHAT_CONFIG_ERROR');
    }

    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    url.searchParams.set('appid', env.WECHAT_APP_ID);
    url.searchParams.set('secret', env.WECHAT_APP_SECRET);
    url.searchParams.set('js_code', code);
    url.searchParams.set('grant_type', 'authorization_code');

    const response = await fetch(url);
    const data = await response.json() as WechatSessionResponse;
    if (!response.ok || data.errcode || !data.openid) {
      throw new AppError(401, data.errmsg ?? '微信登录失败', 'WECHAT_LOGIN_FAILED');
    }

    const [user] = await UserModel.findOrCreate({
      where: { openId: data.openid },
      defaults: { openId: data.openid, unionId: data.unionid, nickname: '408 考生' }
    });

    return { token: signToken(user.id), user: sanitizeUser(user) };
  }
}
