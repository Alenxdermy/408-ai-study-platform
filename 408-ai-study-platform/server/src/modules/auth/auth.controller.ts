import type { Request, Response } from 'express';
import { ok } from '../../shared/http.js';
import { AuthService } from './auth.service.js';

export class AuthController {
  static async register(_req: Request, res: Response, body: { phone: string; password: string; nickname: string }) {
    ok(res, await AuthService.registerWithPassword(body), '注册成功');
  }

  static async login(_req: Request, res: Response, body: { phone: string; password: string }) {
    ok(res, await AuthService.loginWithPassword(body), '登录成功');
  }

  static async me(req: Request, res: Response) {
    const userId = (req as Request & { userId?: string }).userId;
    ok(res, await AuthService.getCurrentUser(String(userId)));
  }

  static async updateTarget(req: Request, res: Response, body: { targetScore: number; examDate: string | null }) {
    const userId = (req as Request & { userId?: string }).userId;
    ok(res, await AuthService.updateStudyTarget(String(userId), body), '设置已保存');
  }

  static async mockLogin(_req: Request, res: Response, body: { nickname?: string }) {
    ok(res, await AuthService.issueMockUser(body.nickname));
  }

  static async wechatLogin(_req: Request, res: Response, body: { code: string }) {
    ok(res, await AuthService.loginWithWechat(body.code));
  }
}
