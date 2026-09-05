export type ProjectStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'AWAITING_APPROVAL'
  | 'PAUSED'
  | 'BLOCKED'
  | 'FAILED';

export type DemoProject = {
  id: string;
  code: string;
  title: string;
  status: ProjectStatus;
  mode: string;
  progress: number;
  completed: number;
  total: number;
  stage: string;
  updated: string;
  owner: string;
  platform: string;
  deadline: string;
};

/** Fixed 22-stage catalog labels (definitions live in MSSQL WorkflowStageDefinitions). */
export const stages = [
  'Strategy & Brief', 'Opportunity Discovery', 'Research', 'Idea Scoring', 'Concept Approval', 'Script', 'Fact Check',
  'Character Bible', 'Scene Matrix', 'Image Generation', 'Video Generation', 'Voice & Dialogue', 'Music & SFX',
  'Edit & Assembly', 'Quality Assurance', 'Thumbnail', 'SEO & Metadata', 'Final Approval', 'Publishing',
  'Performance Monitoring', 'AI Learning', 'Content Recycling'
];
