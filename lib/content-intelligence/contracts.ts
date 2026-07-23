import { z } from 'zod';

export const opportunityStatus = z.enum([
  'DISCOVERED',
  'ENRICHING',
  'VERIFIED',
  'QUALIFIED',
  'REJECTED',
  'BLOCKED',
  'HANDED_OFF',
  'ARCHIVED',
]);
export type OpportunityStatus = z.infer<typeof opportunityStatus>;

export const signalType = z.enum([
  'TREND',
  'AUDIENCE_DEMAND',
  'SEARCH_GAP',
  'KNOWLEDGE_GAP',
  'COMPETITOR',
  'SEASONAL',
  'EDITORIAL',
]);
export type SignalType = z.infer<typeof signalType>;

export const sectionKeys = [
  'sources',
  'discovery',
  'trends',
  'audience-demand',
  'knowledge-gaps',
  'topic-opportunities',
  'competitors',
  'candidates',
  'verification',
  'duplicates',
  'scoring',
  'ranking',
  'portfolio',
  'handoffs',
  'failures',
  'audit',
] as const;
export type SectionKey = (typeof sectionKeys)[number];

export type IntelligenceOverview = {
  available: boolean;
  reason?: string;
  strategy?: {
    versionId: string;
    versionNumber: number;
    checksum: string;
    status: string;
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

export type Opportunity = {
  id: string;
  title: string;
  summary: string;
  status: OpportunityStatus;
  domain: string;
  geography?: string;
  audience?: string;
  score: number;
  confidence: number;
  createdAt: string;
};

export const candidateInput = z.object({
  title: z.string().min(5).max(300),
  summary: z.string().min(20).max(4000),
  domain: z.string().min(1),
  geography: z.string().optional(),
  audience: z.string().optional(),
  sourceSignalIds: z.array(z.string().uuid()).min(1),
});
export type CandidateInput = z.infer<typeof candidateInput>;

export const scoreWeights = z.object({
  strategicFit: z.number().min(0).max(1),
  evidence: z.number().min(0).max(1),
  audienceDemand: z.number().min(0).max(1),
  originality: z.number().min(0).max(1),
  timeliness: z.number().min(0).max(1),
  visualPotential: z.number().min(0).max(1),
  feasibility: z.number().min(0).max(1),
  regionalRelevance: z.number().min(0).max(1),
});

export const consumeStrategyInput = z.object({
  strategyVersionId: z.string().uuid().optional(),
  versionNumber: z.number().int().positive().optional(),
  checksum: z.string().length(64).optional(),
  packageJson: z.string().min(2).optional(),
});
export type ConsumeStrategyInput = z.infer<typeof consumeStrategyInput>;
