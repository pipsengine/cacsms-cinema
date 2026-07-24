import type { ReadinessItem, StrategyOverview } from '@/lib/strategy/contracts';
import { REQUIRED_SECTIONS } from '@/lib/strategy/contracts';

export type ValidationResultRow = {
  id: string;
  ruleCode: string;
  ruleVersion: number;
  severity: string;
  passed: boolean;
  blocking: boolean;
  sectionKey: string | null;
  explanation: string;
  recommendation: string | null;
  checkedAt: string;
};

export type ValidationFilter =
  | 'all'
  | 'failed'
  | 'passed'
  | 'warnings'
  | 'critical'
  | 'blocking'
  | 'handoff'
  | 'mandatory';

export const SECTION_LABELS: Record<string, string> = {
  objectives: 'Strategic Objectives',
  domains: 'Field & Domain Profiles',
  taxonomy: 'Subject & Subfield Taxonomy',
  geographies: 'Country & Regional Profiles',
  audiences: 'Audience Profiles',
  'editorial-policy': 'Editorial & Brand Policy',
  formats: 'Content Format Strategy',
  channels: 'Channel Strategy',
  localisation: 'Language & Localisation',
  'source-policy': 'Evidence & Source Policy',
  'risk-policy': 'Risk & Sensitivity Policy',
  'selection-thresholds': 'Autonomous Selection Thresholds',
  portfolio: 'Portfolio Allocation',
};

export function sectionLabel(key?: string | null): string {
  if (!key) return 'Package';
  return SECTION_LABELS[key] ?? key;
}

export function resultStatus(result: ValidationResultRow): 'PASSED' | 'FAILED' | 'WARNING' {
  if (result.passed) return 'PASSED';
  if (result.severity === 'WARNING') return 'WARNING';
  return 'FAILED';
}

/** Build observe checks from overview when no validation run is persisted yet. */
export function synthesizeChecksFromOverview(overview: StrategyOverview): ValidationResultRow[] {
  const sections = overview.sections ?? [];
  const byKey = new Map(sections.map((item) => [item.key, item]));
  const checkedAt = overview.lastValidatedAt ?? new Date(0).toISOString();

  return REQUIRED_SECTIONS.map((key) => {
    const item = byKey.get(key) as ReadinessItem | undefined;
    const passed = item?.status === 'READY';
    return {
      id: `synthetic-${key}`,
      ruleCode: `REQUIRED_${key.toUpperCase().replaceAll('-', '_')}`,
      ruleVersion: 1,
      severity: 'CRITICAL',
      passed,
      blocking: true,
      sectionKey: key,
      explanation: passed
        ? `Expected ≥1 record; actual ${item?.recordCount ?? 0} (derived from package readiness)`
        : `Expected ≥1 record; actual ${item?.recordCount ?? 0} (derived from package readiness — not yet validated)`,
      recommendation: passed
        ? 'Section presence satisfied'
        : 'Start Stage 01 autonomy so this section materialises, then re-run validation',
      checkedAt,
    };
  });
}

export function validationStats(results: ValidationResultRow[]) {
  const passed = results.filter((item) => item.passed).length;
  const failed = results.filter((item) => !item.passed && item.severity !== 'WARNING').length;
  const warnings = results.filter((item) => !item.passed && item.severity === 'WARNING').length;
  const blocking = results.filter((item) => !item.passed && item.blocking).length;
  const critical = results.filter(
    (item) => !item.passed && item.severity === 'CRITICAL',
  ).length;
  return { passed, failed, warnings, blocking, critical, total: results.length };
}

export function matchesValidationQuery(result: ValidationResultRow, needle: string): boolean {
  if (!needle) return true;
  const haystack = [
    result.ruleCode,
    result.severity,
    result.sectionKey,
    sectionLabel(result.sectionKey),
    result.explanation,
    result.recommendation,
    resultStatus(result),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function filterValidationResults(
  results: ValidationResultRow[],
  query: string,
  filter: ValidationFilter = 'all',
): ValidationResultRow[] {
  const needle = query.trim().toLowerCase();
  return results.filter((result) => {
    if (!matchesValidationQuery(result, needle)) return false;
    if (filter === 'all') return true;
    if (filter === 'failed') return !result.passed && result.severity !== 'WARNING';
    if (filter === 'passed') return result.passed;
    if (filter === 'warnings') return !result.passed && result.severity === 'WARNING';
    if (filter === 'critical') return result.severity === 'CRITICAL';
    if (filter === 'blocking') return result.blocking && !result.passed;
    if (filter === 'handoff') return result.ruleCode.includes('HANDOFF');
    if (filter === 'mandatory') return result.ruleCode.startsWith('REQUIRED_');
    return true;
  });
}

export function dependencyChain(sectionKey?: string | null): string[] {
  const base = [
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
  if (!sectionKey) return [...base, 'content-intelligence'];
  const index = base.indexOf(sectionKey);
  if (index < 0) return [sectionKey, 'content-intelligence'];
  return [...base.slice(0, index + 1), 'content-intelligence'];
}

export function handoffReady(
  overview: StrategyOverview,
  results: ValidationResultRow[],
): boolean {
  if (overview.handoffStatus === 'ACKNOWLEDGED' || overview.status === 'ACTIVE') return true;
  if (overview.status === 'READY') {
    const blockers = results.filter((item) => !item.passed && item.blocking);
    return blockers.length === 0;
  }
  return false;
}
