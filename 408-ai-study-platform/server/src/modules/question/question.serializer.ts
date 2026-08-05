import type { QuestionModel } from '../../models/question.model.js';

export const serializeQuestion = (question: QuestionModel | any) => {
  const item = typeof question?.toJSON === 'function' ? question.toJSON() : question;
  if (!item) return item;

  return {
    ...item,
    _id: item.id,
    id: item.id
  };
};

export const serializeQuestions = (questions: Array<QuestionModel | any>) => questions.map(serializeQuestion);
