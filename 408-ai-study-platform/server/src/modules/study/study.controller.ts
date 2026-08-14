import type { Response } from 'express';
import { FavoriteModel } from '../../models/favorite.model.js';
import { StudyRecordModel } from '../../models/study-record.model.js';
import { UserModel } from '../../models/user.model.js';
import { WrongBookModel } from '../../models/wrong-book.model.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { ok } from '../../shared/http.js';
import { sequelize } from '../../shared/database.js';

const SUBJECT_LABELS: Record<string, string> = {
  data_structure: '数据结构',
  computer_organization: '计算机组成原理',
  os: '操作系统',
  computer_network: '计算机网络'
};

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
    const [
      user,
      recentRecords,
      wrongBookCount,
      favoriteCount,
      totalAnswered,
      correctAnswered,
      weakSubjectRows,
      favoriteSubjectRows
    ] = await Promise.all([
      UserModel.findByPk(req.userId),
      StudyRecordModel.findAll({
        where: { userId: req.userId },
        order: [['createdAt', 'DESC']],
        limit: 30
      }),
      WrongBookModel.count({ where: { userId: req.userId, mastered: false } }),
      FavoriteModel.count({ where: { userId: req.userId } }),
      StudyRecordModel.count({ where: { userId: req.userId, action: 'answer' } }),
      StudyRecordModel.count({ where: { userId: req.userId, action: 'answer', isCorrect: true } }),
      sequelize.query(
        `SELECT q.subject, COUNT(*) AS count
         FROM wrong_books wb
         JOIN questions q ON q.id = wb.question_id
         WHERE wb.user_id = ? AND wb.mastered = false
         GROUP BY q.subject
         ORDER BY count DESC`,
        { replacements: [req.userId], type: 'SELECT' }
      ),
      sequelize.query(
        `SELECT q.subject, COUNT(*) AS count
         FROM favorites f
         JOIN questions q ON q.id = f.question_id
         WHERE f.user_id = ?
         GROUP BY q.subject
         ORDER BY count DESC`,
        { replacements: [req.userId], type: 'SELECT' }
      )
    ]);

    const weakSubjects = (weakSubjectRows as Array<{ subject: string; count: number }>).map(item => ({
      subject: item.subject,
      label: SUBJECT_LABELS[item.subject] ?? item.subject,
      count: Number(item.count)
    }));
    const favoriteSubjects = (favoriteSubjectRows as Array<{ subject: string; count: number }>).map(item => ({
      subject: item.subject,
      label: SUBJECT_LABELS[item.subject] ?? item.subject,
      count: Number(item.count)
    }));
    const accuracy = totalAnswered ? Math.round((correctAnswered / totalAnswered) * 100) : 0;
    const weakestSubject = weakSubjects[0]?.label ?? '暂无明显薄弱科目';
    const report = totalAnswered
      ? `已完成 ${totalAnswered} 次作答，正确率 ${accuracy}%。当前薄弱重点是${weakestSubject}，建议优先回收错题并复盘收藏题。`
      : '还没有作答记录。建议先完成每日一练，系统会自动生成薄弱科目和学习报告。';

    ok(res, {
      user,
      recentRecords,
      studyStats: {
        wrongBookCount,
        favoriteCount,
        totalAnswered,
        correctAnswered,
        accuracy,
        weakSubjects,
        favoriteSubjects,
        report
      }
    });
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
