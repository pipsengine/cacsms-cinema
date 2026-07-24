import { z } from 'zod';

export const qualificationStatus = z.enum([
  'RECEIVED',
  'NORMALISING',
  'EVALUATING',
  'QUALIFIED',
  'REJECTED',
  'BLOCKED',
  'SELECTED',
  'HANDED_OFF',
  'ARCHIVED',
]);
export type QualificationStatus = z.infer<typeof qualificationStatus>;

export const decisionType = z.enum(['QUALIFY', 'REJECT', 'BLOCK', 'REASSESS']);
export type DecisionType = z.infer<typeof decisionType>;

export const sectionKeys = [
  'intake',
  'candidate-pool',
  'evidence',
  'strategic-fit',
  'audience-value',
  'originality',
  'duplicates',
  'feasibility',
  'visual-potential',
  'risk',
  'scoring',
  'gates',
  'ranking',
  'decisions',
  'selected-ideas',
  'handoffs',
  'failures',
  'audit',
] as const;
export type SectionKey = (typeof sectionKeys)[number];

export type FunnelStage = {
  key: string;
  label: string;
  records: number;
  durationMs: number | null;
  confidence: number | null;
  failures: number;
  successRate: number | null;
  state: 'pending' | 'active' | 'done' | 'failed';
};

export type QualificationCandidateCard = {
  id: string;
  title: string;
  summary: string;
  domain: string;
  geography: string | null;
  audience: string | null;
  status: QualificationStatus;
  score: number;
  measuredScore: boolean;
  confidence: number;
  measuredConfidence: boolean;
  gateStatus: string;
  decision: string | null;
  decisionReason: string | null;
  rankPosition: number | null;
  evidencePassed: number;
  evidenceFailed: number;
  maxDuplicateSimilarity: number | null;
  riskScore: number | null;
  factors: Partial<FactorScores> | null;
  explanation: string | null;
  modelVersion: string | null;
  nextAction: string;
  createdAt: string;
  updatedAt: string;
};

export type RadarDimension = {
  key: string;
  label: string;
  value: number | null;
};

export type RiskCategorySummary = {
  category: string;
  count: number;
  avgScore: number | null;
  maxSeverity: string | null;
};

export type QualificationOverview = {
  available: boolean;
  reason?: string;
  intake?: {
    packageId: string;
    runId: string;
    checksum: string;
    status: string;
    receivedAt: string;
    strategyVersionId?: string;
  };
  cycle?: {
    id: string;
    status: string;
    startedAt: string;
    completedAt?: string | null;
    failureReason?: string | null;
  };
  /** @deprecated prefer `kpi` — retained for section shells */
  metrics?: Record<string, number>;
  pipeline?: Array<{ stage: string; status: string; count: number }>;
  blockers?: Array<{
    id: string;
    severity: string;
    message: string;
    recommendation?: string | null;
  }>;
  kpi: {
    ideasReceived: number;
    ideasPassed: number;
    ideasRejected: number;
    underReview: number;
    aiConfidence: number | null;
    evidenceSufficiency: number | null;
    strategyAlignment: number | null;
    originalityScore: number | null;
    commercialPotential: number | null;
    productionCost: number | null;
    estimatedRoi: number | null;
    audienceDemand: number | null;
    riskScore: number | null;
    feasibilityScore: number | null;
    approvalRate: number | null;
    averageQualificationTimeMs: number | null;
  };
  engine: {
    status: string;
    currentModel: string | null;
    reasoningEngine: string;
    confidence: number | null;
    knowledgeSources: number;
    policyVersion: string | null;
    strategyVersion: string | null;
    promptVersion: string | null;
    learningVersion: string | null;
  };
  funnel: FunnelStage[];
  candidates: QualificationCandidateCard[];
  radar: RadarDimension[];
  risks: RiskCategorySummary[];
  evidenceCoverage: {
    totalChecks: number;
    passed: number;
    failed: number;
    blocking: number;
    coveragePct: number | null;
  };
  duplicates: {
    checks: number;
    blocking: number;
    avgSimilarity: number | null;
    maxSimilarity: number | null;
  };
  recommendations: Array<{
    id: string;
    action: string;
    reason: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    candidateId?: string;
  }>;
  timeline: Array<{
    key: string;
    label: string;
    at: string | null;
    count: number;
    done: boolean;
  }>;
  decisions: Array<{
    id: string;
    candidateId: string;
    title: string;
    decision: string;
    reason: string;
    source: string;
    createdAt: string;
  }>;
  audit: Array<{
    id: string;
    action: string;
    actorType: string;
    createdAt: string;
    reason: string | null;
  }>;
  governance: {
    auditEvents: number;
    decisions: number;
    digitalSignatures: number;
    immutableRecords: number;
    policyVersion: string | null;
  };
  lastUpdated?: string;
};

export type Candidate = {
  id: string;
  title: string;
  summary: string;
  status: QualificationStatus;
  domain: string;
  geography?: string;
  audience?: string;
  score: number;
  confidence: number;
  gateStatus: string;
  decision?: string;
  createdAt: string;
};

export const intakePackage = z.object({
  sourceRunId: z.string().uuid(),
  strategyVersionId: z.string().uuid(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/i),
  packageJson: z.string().min(2),
});
export type IntakePackage = z.infer<typeof intakePackage>;

export const optionalIntakePackage = intakePackage.partial();

export const decisionInput = z.object({
  decision: decisionType,
  reason: z.string().min(10).max(2000),
  expectedRowVersion: z.string().min(1),
  idempotencyKey: z.string().min(8).max(100),
});

export const factorScores = z.object({
  strategicFit: z.number().min(0).max(100),
  evidence: z.number().min(0).max(100),
  audienceValue: z.number().min(0).max(100),
  originality: z.number().min(0).max(100),
  timeliness: z.number().min(0).max(100),
  educationalValue: z.number().min(0).max(100),
  regionalRelevance: z.number().min(0).max(100),
  visualPotential: z.number().min(0).max(100),
  feasibility: z.number().min(0).max(100),
  sourceAvailability: z.number().min(0).max(100),
  risk: z.number().min(0).max(100),
  duplicateSimilarity: z.number().min(0).max(100),
});
export type FactorScores = z.infer<typeof factorScores>;
