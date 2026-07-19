export type AgentName =
  | 'learning_planner'
  | 'teacher'
  | 'question'
  | 'knowledge'
  | 'review'
  | 'wrong_book'
  | 'exam'
  | 'report';

export interface AgentContext {
  userId?: string;
  sessionId?: string;
  payload: Record<string, unknown>;
}

export interface AgentResult {
  agent: AgentName;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface StudyAgent {
  name: AgentName;
  run(context: AgentContext): Promise<AgentResult>;
}
