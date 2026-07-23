import { z } from 'zod';

export const researchStatus = z.enum([
  'RECEIVED',
  'PLANNING',
  'RESEARCHING',
  'VERIFYING',
  'READY',
  'BLOCKED',
  'HANDED_OFF',
  'ARCHIVED',
]);
export type ResearchStatus = z.infer<typeof researchStatus>;

export const sectionKeys = [
  'intake',
  'research-brief',
  'questions',
  'source-discovery',
  'source-library',
  'source-evaluation',
  'claims',
  'evidence-map',
  'corroboration',
  'contradictions',
  'fact-checking',
  'citations',
  'rights',
  'regional-authenticity',
  'risk',
  'dossier',
  'handoffs',
  'failures',
  'audit',
] as const;
export type SectionKey = (typeof sectionKeys)[number];

export type ResearchOverview = {
  available: boolean;
  reason?: string;
  intake?: {
    packageId: string;
    projectId: string;
    checksum: string;
    status: string;
    receivedAt: string;
  };
  run?: {
    id: string;
    status: string;
    startedAt: string;
  };
  metrics?: Record<string, number>;
  pipeline?: Array<{ stage: string; status: string; count: number }>;
  blockers?: Array<{ id: string; severity: string; message: string }>;
  lastUpdated?: string;
};

export type ResearchRecord = {
  id: string;
  title: string;
  summary: string;
  recordType: string;
  status: ResearchStatus;
  authorityScore?: number;
  confidence?: number;
  claimCoverage?: number;
  rightsStatus?: string;
  createdAt: string;
};

export const intakePackage = z.object({
  projectId: z.string().uuid(),
  ideaQualificationHandoffId: z.string().uuid(),
  strategyVersionId: z.string().uuid(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/i),
  packageJson: z.string().min(2),
});
export type IntakePackage = z.infer<typeof intakePackage>;

export const evidenceAssessment = z.object({
  authority: z.number().min(0).max(100),
  corroboration: z.number().min(0).max(100),
  recency: z.number().min(0).max(100),
  relevance: z.number().min(0).max(100),
  provenance: z.number().min(0).max(100),
  rightsConfidence: z.number().min(0).max(100),
  contradictionRisk: z.number().min(0).max(100),
});
export type EvidenceAssessment = z.infer<typeof evidenceAssessment>;
