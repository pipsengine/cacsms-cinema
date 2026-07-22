/** Live Image Generator workspace types mapped from dashboard/jobs APIs. */

export type WorkspaceTabId =
  | 'queue'
  | 'active'
  | 'candidates'
  | 'lifecycle'
  | 'quality'
  | 'activity';

export interface DashboardPayload {
  generatedAt: string;
  system: {
    api: string;
    database: string;
    isHealthy: boolean;
    controlState: string;
    controlVersion: number;
    controlUpdatedAt: string | null;
  };
  metrics: {
    projects: number;
    activeJobs: number;
    queuedJobs: number;
    completedJobs: number;
    exceptionJobs: number;
    approvedAssets: number;
    candidates: number;
    totalAttempts: number;
    successRate: number;
    averageLatencyMs: number;
    totalCost: number;
    blankImageRate: number | null;
    averageQuality: number | null;
  };
  quality: {
    criticalFailures: number;
    repairsInProgress: number;
    rejectedCandidates: number;
    continuityViolations: number;
    geographicFailures: number;
  };
  queue: Record<string, number>;
  recentJobs: Array<{
    id: string;
    sceneId: string | null;
    projectName: string;
    status: string;
    priority: number;
    updatedAt: string;
    attemptCount: number;
    candidateCount: number;
    provider: string | null;
    latestAttemptStatus: string | null;
    failureCode: string | null;
    evidence: string;
  }>;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string | null;
}

export interface CandidateRecord {
  id: string;
  jobId: string;
  imageUrl: string;
  storageKey: string | null;
  sha256: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  status: string;
  score: number;
  providerId: string | null;
  modelId: string | null;
}

export interface JobRecord {
  id: string;
  projectId: string;
  sceneId: string | null;
  status: string;
  priority: number;
  budget: number | null;
  failureCode: string | null;
  createdAt: string;
  updatedAt: string;
  project?: ProjectRecord;
  attempts?: Array<{
    id: string;
    stage: string;
    status: string;
    providerUsed: string | null;
    modelUsed: string | null;
    durationMs: number | null;
    errorMessage: string | null;
    createdAt: string;
  }>;
  candidates?: CandidateRecord[];
}

export const LIFECYCLE_GROUPS = [
  { label: 'Discover & Interpret', stages: ['DISCOVER', 'INTERPRET', 'DECOMPOSE'] },
  { label: 'Research & Requirements', stages: ['RESEARCH', 'VERIFY_CONTEXT', 'BUILD_REQUIREMENTS'] },
  { label: 'Scene & Cinematography', stages: ['BUILD_SCENE_GRAPH', 'RESOLVE_CONFLICTS', 'PLAN_CINEMATOGRAPHY', 'RETRIEVE_REFERENCES', 'VALIDATE_REFERENCES'] },
  { label: 'Prompt & Model Plan', stages: ['PLAN_WORKFLOW', 'COMPILE_PROMPT', 'SELECT_MODEL', 'RUN_PREFLIGHT', 'QUEUE'] },
  { label: 'Generate & Validate', stages: ['GENERATE_CANDIDATES', 'VALIDATE_FILES', 'REMOVE_DUPLICATES'] },
  { label: 'Evaluate & Repair', stages: ['SCORE_CANDIDATES', 'DIAGNOSE_DEFECTS', 'REPAIR_OR_REGENERATE', 'VERIFY_IDENTITY', 'VERIFY_CONTINUITY', 'VERIFY_GEOGRAPHY', 'VERIFY_HISTORY', 'UPSCALE', 'POST_PROCESS', 'FINAL_QA'] },
  { label: 'Approve & Deliver', stages: ['APPROVE', 'VERSION', 'DELIVER'] },
  { label: 'Learn', stages: ['LEARN'] },
] as const;

export const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'HUMAN_EXCEPTION_REQUIRED']);

export function displayStage(value: string): string {
  return value
    .replace('PROCESSING:', '')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function titleCase(value: string): string {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function relativeTime(value: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds} sec ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} hr ago`;
}
