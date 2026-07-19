import { AgentLogModel } from '../models/agent-log.model.js';
import type { AgentContext, AgentName, AgentResult, StudyAgent } from './agent.types.js';

export abstract class BaseAgent implements StudyAgent {
  abstract name: AgentName;
  abstract execute(context: AgentContext): Promise<AgentResult>;

  async run(context: AgentContext) {
    const startedAt = Date.now();
    try {
      const result = await this.execute(context);
      await AgentLogModel.create({
        userId: context.userId,
        agent: this.name,
        input: context.payload,
        output: result,
        status: 'success',
        latencyMs: Date.now() - startedAt
      });
      return result;
    } catch (error) {
      await AgentLogModel.create({
        userId: context.userId,
        agent: this.name,
        input: context.payload,
        status: 'failed',
        latencyMs: Date.now() - startedAt,
        errorMessage: error instanceof Error ? error.message : 'unknown error'
      });
      throw error;
    }
  }
}
