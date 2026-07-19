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
          '必须按结构输出：正确答案、每个选项解析、考点、易错点、真题来源或相似来源、扩展知识、学习建议。',
          '回答要准确、简洁、适合备考复盘。'
        ].join('\n')
      },
      { role: 'user', content: question }
    ]);

    return { agent: this.name, content: answer };
  }
}
