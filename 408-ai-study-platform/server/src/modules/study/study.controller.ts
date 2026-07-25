import type { Response } from 'express';
import { StudyRecordModel } from '../../models/study-record.model.js';
import { UserModel } from '../../models/user.model.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { ok } from '../../shared/http.js';

const isSameLocalDay = (left: Date | string | null | undefined, right: Date) => {
  if (!left) return false;
  const date = left instanceof Date ? left : new Date(left);
  return date.getFullYear() === right.getFullYear()
    && date.getMonth() === right.getMonth()
    && date.getDate() === right.getDate();
};

const isYesterdayLocal = (left: Date | string | null | undefined, right: Date) => {
  if (!left) return false;
  const date = left instanceof Date ? left : new Date(left);
  const yesterday = new Date(right);
  yesterday.setDate(right.getDate() - 1);
  return isSameLocalDay(date, yesterday);
};

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
    const now = new Date();

    const stats = user.stats || {
      totalQuestions: 0,
      correctQuestions: 0,
      studyMinutes: 0,
      streakDays: 0,
      lastCheckInAt: null
    };

    const alreadyCheckedToday = isSameLocalDay(stats.lastCheckInAt, now);
    const nextStreakDays = alreadyCheckedToday
      ? stats.streakDays
      : isYesterdayLocal(stats.lastCheckInAt, now)
        ? stats.streakDays + 1
        : 1;

    await user.update({
      stats: {
        ...stats,
        lastCheckInAt: now,
        streakDays: nextStreakDays
      }
    });

    ok(res, { user, checkedToday: true, alreadyCheckedToday }, alreadyCheckedToday ? '今日已打卡' : '签到成功');
  }
}
