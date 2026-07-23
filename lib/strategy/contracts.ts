import { z } from 'zod';

export const StrategyStatus = z.enum([
  'DRAFT',
  'IN_REVIEW',
  'INVALID',
  'READY',
  'ACTIVE',
  'SUPERSEDED',
  'ARCHIVED',
  'BLOCKED',
]);
export type StrategyStatus = z.infer<typeof StrategyStatus>;

export const SectionKey = z.enum([
  'objectives',
  'domains',
  'taxonomy',
  'geographies',
  'audiences',
  'editorial-policy',
  'formats',
  'channels',
  'localisation',
  'source-policy',
  'risk-policy',
  'selection-thresholds',
  'portfolio',
]);
export type SectionKey = z.infer<typeof SectionKey>;

export const REQUIRED_SECTIONS: SectionKey[] = [
  'objectives',
  'domains',
  'taxonomy',
  'geographies',
  'audiences',
  'editorial-policy',
  'formats',
  'channels',
  'localisation',
  'source-policy',
  'risk-policy',
  'selection-thresholds',
  'portfolio',
];

export const StrategyRecord = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2),
  description: z.string().default(''),
  status: z.string().default('ACTIVE'),
  priority: z.number().int().min(0).max(100).default(50),
  configuration: z.record(z.unknown()).default({}),
  effectiveFrom: z.string().datetime().nullable().default(null),
  effectiveTo: z.string().datetime().nullable().default(null),
  rowVersion: z.string().optional(),
});
export type StrategyRecord = z.infer<typeof StrategyRecord>;

export type ReadinessItem = {
  key: SectionKey;
  label: string;
  status: 'READY' | 'WARNING' | 'BLOCKED';
  progress: number;
  blockers: number;
  warnings: number;
  missing: string[];
};

export type StrategyOverview = {
  available: boolean;
  reason?: string;
  strategyId?: string;
  versionId?: string;
  name?: string;
  versionNumber?: number;
  status?: StrategyStatus;
  readiness?: number;
  effectiveDate?: string | null;
  lastValidatedAt?: string | null;
  handoffStatus?: string;
  checksum?: string | null;
  metrics?: Record<string, number>;
  sections?: ReadinessItem[];
  issues?: Array<{
    id: string;
    severity: string;
    section: string;
    message: string;
    recommendation: string;
  }>;
};
