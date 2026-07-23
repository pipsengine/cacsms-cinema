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

export type QualificationOverview = {
  available: boolean;
  reason?: string;
  intake?: {
    packageId: string;
    runId: string;
    checksum: string;
    status: string;
    receivedAt: string;
  };
  cycle?: {
    id: string;
    status: string;
    startedAt: string;
  };
  metrics?: Record<string, number>;
  pipeline?: Array<{ stage: string; status: string; count: number }>;
  blockers?: Array<{ id: string; severity: string; message: string }>;
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
