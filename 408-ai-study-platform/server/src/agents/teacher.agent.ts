import { llmService } from '../services/llm.service.js';
import { BaseAgent } from './base-agent.js';
import type { AgentContext } from './agent.types.js';

export class TeacherAgent extends BaseAgent {
  name = 'teacher' as const;

  async execute(context: AgentContext) {
    const question = String(context.payload.question ?? '');
    const answer = await llmService.chat([
      {
        role: 'system',
        content: [
          '你是 408 计算机考研 AI 讲题老师。',
          '如果用户粘贴的是完整选择题或真题，按结构输出：答案判断、逐项解析、考点、易错点、学习建议。',
          '如果用户问的是概念、原理或复习方法，直接按：核心结论、原理解释、408 常见考法、易错点、复习建议输出。',
          '不要编造题干中没有给出的选项、年份、来源或标准答案。',
          '回答要准确、简洁，优先帮助用户备考复盘。'
        ].join('\n')
      },
      { role: 'user', content: question }
    ]);

    return { agent: this.name, content: answer };
  }
}
