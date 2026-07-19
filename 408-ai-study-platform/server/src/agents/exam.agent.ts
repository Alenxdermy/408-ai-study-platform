import { PaperModel } from '../models/paper.model.js';
import { BaseAgent } from './base-agent.js';
import type { AgentContext } from './agent.types.js';

export class ExamAgent extends BaseAgent {
  name = 'exam' as const;

  async execute(_context: AgentContext) {
    const paper = await PaperModel.findOne({
      where: { type: 'mock', status: 'published' }
    });
    return {
      agent: this.name,
      content: paper ? '已生成一套模拟考试。' : '暂无可用模拟试卷。',
      metadata: { paper }
    };
  }
}
