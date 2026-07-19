import { StudyRecordModel } from '../models/study-record.model.js';
import { BaseAgent } from './base-agent.js';
import type { AgentContext } from './agent.types.js';

export class ReportAgent extends BaseAgent {
  name = 'report' as const;

  async execute(context: AgentContext) {
    const records = await StudyRecordModel.findAll({
      where: { userId: context.userId },
      order: [['createdAt', 'DESC']],
      limit: 100
    });
    const answered = records.filter(record => record.action === 'answer');
    const correct = answered.filter(record => record.isCorrect).length;
    const accuracy = answered.length ? Math.round((correct / answered.length) * 100) : 0;
    return {
      agent: this.name,
      content: `最近 100 条学习记录正确率 ${accuracy}%。`,
      metadata: { accuracy, recordCount: records.length }
    };
  }
}
