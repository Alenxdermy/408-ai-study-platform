import type { Response } from 'express';
import { FavoriteModel } from '../../models/favorite.model.js';
import { QuestionModel } from '../../models/question.model.js';
import { StudyRecordModel } from '../../models/study-record.model.js';
import { WrongBookModel } from '../../models/wrong-book.model.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { AppError, ok } from '../../shared/http.js';
import { isAnswerCorrect } from './question.utils.js';

export class QuestionController {
  static async list(req: AuthRequest, res: Response) {
    const { subject, mode = 'sequence' } = req.query;
    const where: any = { status: 'published' };
    if (subject) where.subject = subject;

    let questions;
    if (mode === 'random') {
      questions = await QuestionModel.findAll({
        where,
        order: [QuestionModel.sequelize!.literal('RAND()')],
        limit: 20
      });
    } else {
      questions = await QuestionModel.findAll({
        where,
        order: [['createdAt', 'ASC']],
        limit: 20
      });
    }
    ok(res, questions);
  }

  static async daily(_req: AuthRequest, res: Response) {
    const questions = await QuestionModel.findAll({
      where: { status: 'published' },
      order: [QuestionModel.sequelize!.literal('RAND()')],
      limit: 10
    });
    ok(res, questions);
  }

  static async answer(req: AuthRequest, res: Response) {
    const question = await QuestionModel.findByPk(req.params.id);
    if (!question) throw new AppError(404, '题目不存在', 'QUESTION_NOT_FOUND');

    const userAnswer = req.body.answer;
    const isCorrect = isAnswerCorrect(question.answer, userAnswer);
    await StudyRecordModel.create({ userId: req.userId, questionId: req.params.id, action: 'answer', isCorrect });
    if (!isCorrect) {
      const [wrongBook, created] = await WrongBookModel.findOrCreate({
        where: { userId: req.userId, questionId: req.params.id },
        defaults: {
          userId: req.userId,
          questionId: req.params.id,
          wrongAnswer: userAnswer,
          lastWrongAt: new Date(),
          wrongCount: 1
        }
      });
      if (!created) {
        await wrongBook.update({
          wrongAnswer: userAnswer,
          lastWrongAt: new Date(),
          wrongCount: wrongBook.wrongCount + 1
        });
      }
    }
    ok(res, {
      isCorrect,
      answer: question.answer,
      explanation: question.explanation,
      source: question.source,
      tags: question.tags
    });
  }

  static async toggleFavorite(req: AuthRequest, res: Response) {
    const existed = await FavoriteModel.findOne({ where: { userId: req.userId, questionId: req.params.id } });
    if (existed) {
      await existed.destroy();
      ok(res, { favorited: false }, '已取消收藏');
      return;
    }

    await FavoriteModel.create({ userId: req.userId, questionId: req.params.id });
    ok(res, { favorited: true }, '已收藏');
  }

  static async wrongBook(req: AuthRequest, res: Response) {
    const items = await WrongBookModel.findAll({
      where: { userId: req.userId, mastered: false },
      order: [['lastWrongAt', 'DESC']],
      limit: 50
    });
    ok(res, items);
  }
}
