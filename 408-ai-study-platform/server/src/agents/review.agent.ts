import { ReviewTaskModel } from '../models/review-task.model.js';
import { BaseAgent } from './base-agent.js';
import type { AgentContext } from './agent.types.js';
import { Op } from 'sequelize';

export class ReviewAgent extends BaseAgent {
  name = 'review' as const;

  async execute(context: AgentContext) {
    const dueTasks = await ReviewTaskModel.findAll({
      where: {
        userId: context.userId,
        status: 'pending',
        dueAt: { [Op.lte]: new Date() }
      },
      limit: 20
    });
    return {
      agent: this.name,
      content: `今日待复习 ${dueTasks.length} 个知识点。`,
      metadata: { dueTasks }
    };
  }
}
