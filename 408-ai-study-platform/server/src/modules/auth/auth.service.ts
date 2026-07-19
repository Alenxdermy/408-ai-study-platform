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

export class AuthService {
  static async issueMockUser(nickname?: string) {
    const user = await UserModel.create({ nickname: nickname ?? '408 考生' });
    return { token: signToken(user.id), user };
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

    const [user, created] = await UserModel.findOrCreate({
      where: { openId: data.openid },
      defaults: { openId: data.openid, unionId: data.unionid, nickname: '408 考生' }
    });

    return { token: signToken(user.id), user };
  }
}
