import { knowledgeService } from '../services/knowledge.service.js';
import { BaseAgent } from './base-agent.js';
import type { AgentContext } from './agent.types.js';

export class KnowledgeAgent extends BaseAgent {
  name = 'knowledge' as const;

  async execute(context: AgentContext) {
    const query = String(context.payload.query ?? '');
    const content = await knowledgeService.answerWithRag(context.userId ?? '', query);
    return { agent: this.name, content };
  }
}
