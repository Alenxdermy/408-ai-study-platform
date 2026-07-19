import { llmService } from '../services/llm.service.js';
import { BaseAgent } from './base-agent.js';
import type { AgentContext } from './agent.types.js';

export class LearningPlannerAgent extends BaseAgent {
  name = 'learning_planner' as const;

  async execute(context: AgentContext) {
    const content = await llmService.chat([
      {
        role: 'system',
        content: '你是 408 考研学习规划师。请基于目标分数、剩余天数、薄弱科目和每日可学习时间，输出可执行学习计划。'
      },
      { role: 'user', content: JSON.stringify(context.payload) }
    ]);
    return { agent: this.name, content };
  }
}
