import type { Response } from 'express';
import { Op } from 'sequelize';
import type { AuthRequest } from '../../middlewares/auth.js';
import { FavoriteModel } from '../../models/favorite.model.js';
import { QuestionModel } from '../../models/question.model.js';
import { StudyRecordModel } from '../../models/study-record.model.js';
import { WrongBookModel } from '../../models/wrong-book.model.js';
import { AppError, ok } from '../../shared/http.js';
import { serializeQuestions } from './question.serializer.js';
import { isAnswerCorrect } from './question.utils.js';

const hasStandardAnswer = (answer: unknown) => {
  if (Array.isArray(answer)) return answer.length > 0;
  const text = String(answer ?? '').trim();
  return Boolean(text) && !text.includes('需要人工标注') && text !== '暂无';
};

const loadQuestionsByIds = async (questionIds: string[]) => {
  if (!questionIds.length) return [];

  const questions = await QuestionModel.findAll({
    where: { id: { [Op.in]: questionIds }, status: 'published' }
  });
  const questionMap = new Map(questions.map(question => [question.id, question]));
  return questionIds.map(id => questionMap.get(id)).filter(Boolean);
};

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
    ok(res, serializeQuestions(questions));
  }

  static async daily(_req: AuthRequest, res: Response) {
    const questions = await QuestionModel.findAll({
      where: { status: 'published' },
      order: [QuestionModel.sequelize!.literal('RAND()')],
      limit: 10
    });
    ok(res, serializeQuestions(questions));
  }

  static async answer(req: AuthRequest, res: Response) {
    const questionId = String(req.params.id);
    const question = await QuestionModel.findByPk(questionId);
    if (!question) throw new AppError(404, '题目不存在', 'QUESTION_NOT_FOUND');

    const userAnswer = req.body.answer;
    if (!hasStandardAnswer(question.answer)) {
      await StudyRecordModel.create({
        userId: req.userId,
        questionId,
        action: 'answer',
        isCorrect: null,
        metadata: { userAnswer, skippedBecause: 'missing-standard-answer' }
      });
      ok(res, {
        isCorrect: null,
        answer: question.answer,
        explanation: question.explanation || '该题暂无标准答案，请先在后台补充答案',
        source: question.source,
        tags: question.tags
      }, '该题暂无标准答案');
      return;
    }

    const isCorrect = isAnswerCorrect(question.answer, userAnswer);
    await StudyRecordModel.create({
      userId: req.userId,
      questionId,
      action: 'answer',
      isCorrect,
      metadata: { userAnswer }
    });
    if (!isCorrect) {
      const [wrongBook, created] = await WrongBookModel.findOrCreate({
        where: { userId: req.userId, questionId },
        defaults: {
          userId: req.userId,
          questionId,
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
    const questionId = String(req.params.id);
    const existed = await FavoriteModel.findOne({ where: { userId: req.userId, questionId } });
    if (existed) {
      await existed.destroy();
      ok(res, { favorited: false }, '已取消收藏');
      return;
    }

    await FavoriteModel.create({ userId: req.userId, questionId });
    ok(res, { favorited: true }, '已收藏');
  }

  static async favorites(req: AuthRequest, res: Response) {
    const items = await FavoriteModel.findAll({
      where: { userId: req.userId },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    const questions = await loadQuestionsByIds(items.map(item => item.questionId));
    ok(res, serializeQuestions(questions));
  }

  static async wrongBook(req: AuthRequest, res: Response) {
    const items = await WrongBookModel.findAll({
      where: { userId: req.userId, mastered: false },
      order: [['lastWrongAt', 'DESC']],
      limit: 50
    });
    const questions = await loadQuestionsByIds(items.map(item => item.questionId));
    ok(res, serializeQuestions(questions));
  }
}
