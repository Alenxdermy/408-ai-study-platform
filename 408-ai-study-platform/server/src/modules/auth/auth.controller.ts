import type { Request, Response } from 'express';
import { ok } from '../../shared/http.js';
import { AuthService } from './auth.service.js';

export class AuthController {
  static async mockLogin(_req: Request, res: Response, body: { nickname?: string }) {
    ok(res, await AuthService.issueMockUser(body.nickname));
  }

  static async wechatLogin(_req: Request, res: Response, body: { code: string }) {
    ok(res, await AuthService.loginWithWechat(body.code));
  }
}
