import { WrongBookModel } from '../models/wrong-book.model.js';
import { llmService } from '../services/llm.service.js';
import { BaseAgent } from './base-agent.js';
import type { AgentContext } from './agent.types.js';

export class WrongBookAgent extends BaseAgent {
  name = 'wrong_book' as const;

  async execute(context: AgentContext) {
    const wrongItems = await WrongBookModel.findAll({
      where: { userId: context.userId, mastered: false },
      limit: 30
    });
    const content = await llmService.chat([
      {
        role: 'system',
        content: '你是 408 错题分析专家。请按知识点聚类错题，输出薄弱点、复习顺序和针对性练习建议。'
      },
      { role: 'user', content: JSON.stringify(wrongItems) }
    ]);
    return { agent: this.name, content };
  }
}
