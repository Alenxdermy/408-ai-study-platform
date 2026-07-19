import { AppError } from '../shared/http.js';
import { ExamAgent } from './exam.agent.js';
import { KnowledgeAgent } from './knowledge.agent.js';
import { LearningPlannerAgent } from './learning-planner.agent.js';
import { QuestionAgent } from './question.agent.js';
import { ReportAgent } from './report.agent.js';
import { ReviewAgent } from './review.agent.js';
import { TeacherAgent } from './teacher.agent.js';
import type { AgentContext, AgentName, StudyAgent } from './agent.types.js';
import { WrongBookAgent } from './wrong-book.agent.js';

export class SupervisorAgent {
  private agents: Map<AgentName, StudyAgent>;

  constructor() {
    const agentList: StudyAgent[] = [
      new LearningPlannerAgent(),
      new TeacherAgent(),
      new QuestionAgent(),
      new KnowledgeAgent(),
      new ReviewAgent(),
      new WrongBookAgent(),
      new ExamAgent(),
      new ReportAgent()
    ];
    this.agents = new Map(agentList.map(agent => [agent.name, agent]));
  }

  async dispatch(name: AgentName, context: AgentContext) {
    const agent = this.agents.get(name);
    if (!agent) throw new AppError(400, `未知 Agent: ${name}`, 'UNKNOWN_AGENT');
    return agent.run(context);
  }
}

export const supervisorAgent = new SupervisorAgent();
