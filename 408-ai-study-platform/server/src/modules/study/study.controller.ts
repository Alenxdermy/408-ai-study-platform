import type { Response } from 'express';
import { StudyRecordModel } from '../../models/study-record.model.js';
import { UserModel } from '../../models/user.model.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { ok } from '../../shared/http.js';

export class StudyController {
  static async dashboard(req: AuthRequest, res: Response) {
    const [user, recentRecords] = await Promise.all([
      UserModel.findByPk(req.userId),
      StudyRecordModel.findAll({
        where: { userId: req.userId },
        order: [['createdAt', 'DESC']],
        limit: 30
      })
    ]);
    ok(res, { user, recentRecords });
  }

  static async checkin(req: AuthRequest, res: Response) {
    const user = await UserModel.findByPk(req.userId);
    if (!user) throw new Error('用户不存在');

    const stats = user.stats || {
      totalQuestions: 0,
      correctQuestions: 0,
      studyMinutes: 0,
      streakDays: 0,
      lastCheckInAt: null
    };

    await user.update({
      stats: {
        ...stats,
        lastCheckInAt: new Date(),
        streakDays: stats.streakDays + 1
      }
    });

    await StudyRecordModel.create({ userId: req.userId, action: 'checkin' });
    ok(res, { user }, '签到成功');
  }
}
