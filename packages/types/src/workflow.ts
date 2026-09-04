export type WorkflowStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'AWAITING_APPROVAL'
  | 'PAUSED'
  | 'BLOCKED'
  | 'FAILED'
  | 'AI_PROCESSING';

export interface StageHandoff<TInput = unknown, TOutput = unknown> {
  projectId: string;
  stageKey: string;
  version: number;
  input: TInput;
  output?: TOutput;
  status: WorkflowStatus;
  createdAt: string;
  completedAt?: string;
}
