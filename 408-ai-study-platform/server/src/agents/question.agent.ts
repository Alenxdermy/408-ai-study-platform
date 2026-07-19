import { QuestionModel } from '../models/question.model.js';
import { llmService } from '../services/llm.service.js';
import { BaseAgent } from './base-agent.js';
import type { AgentContext } from './agent.types.js';

export class QuestionAgent extends BaseAgent {
  name = 'question' as const;

  async execute(context: AgentContext) {
    const questionId = String(context.payload.questionId ?? '');
    const question = questionId ? await QuestionModel.findByPk(questionId) : null;
    const content = await llmService.chat([
      {
        role: 'system',
        content: '你是 408 刷题助手。请判断答题结果，指出知识点、失分原因和下一题训练建议。'
      },
      { role: 'user', content: JSON.stringify({ question, payload: context.payload }) }
    ]);
    return { agent: this.name, content };
  }
}
