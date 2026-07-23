import type { StrategyRecord } from '@/lib/strategy/contracts';
import { configDisplay, fieldLabel } from '@/apps/web/lib/strategy-taxonomy';

export type EvidenceClass =
  | 'primary_institutional'
  | 'scholarly'
  | 'journalism'
  | 'civil_society'
  | 'restricted_anonymous'
  | 'other';

export { configDisplay, fieldLabel };

/** Compact gates shown on an expanded ladder rung. */
export const LADDER_GATE_ROWS = [
  { key: 'minimumAuthorityScore', label: 'Authority' },
  { key: 'minimumCorroboration', label: 'Corroboration' },
  { key: 'maximumAge', label: 'Recency' },
  { key: 'anonymousRestrictions', label: 'Anonymity' },
  { key: 'citationRequired', label: 'Citation' },
  { key: 'rightsRequired', label: 'Rights' },
  { key: 'correctionCheck', label: 'Corrections' },
] as const;

export function isSourceStub(record: StrategyRecord): boolean {
  const key = String(record.configuration?.systemKey ?? '');
  return (
    key === 'policy.source-policy' ||
    ((record.name === 'Source Policy' || record.name === 'Evidence & Source Policy') &&
      !key.startsWith('src.'))
  );
}

export function isSourcePolicyClass(record: StrategyRecord): boolean {
  return String(record.configuration?.systemKey ?? '').startsWith('src.');
}

export function evidenceClass(record: StrategyRecord): EvidenceClass {
  const value = String(record.configuration?.evidenceClass ?? '').toLowerCase();
  if (
    value === 'primary_institutional' ||
    value === 'scholarly' ||
    value === 'journalism' ||
    value === 'civil_society' ||
    value === 'restricted_anonymous'
  ) {
    return value;
  }
  return 'other';
}

export function evidenceClassLabel(value: EvidenceClass): string {
  switch (value) {
    case 'primary_institutional':
      return 'Institutional';
    case 'scholarly':
      return 'Scholarly';
    case 'journalism':
      return 'Journalism';
    case 'civil_society':
      return 'Civil society';
    case 'restricted_anonymous':
      return 'Restricted';
    default:
      return 'Other';
  }
}

export function sourceState(record: StrategyRecord): string {
  return configDisplay(record.configuration, 'state').trim().toUpperCase() || 'UNKNOWN';
}

export function ladderRank(record: StrategyRecord): number {
  const raw = Number(record.configuration?.ladderRank);
  if (Number.isFinite(raw) && raw > 0) return raw;
  switch (evidenceClass(record)) {
    case 'primary_institutional':
      return 1;
    case 'scholarly':
      return 2;
    case 'journalism':
      return 3;
    case 'civil_society':
      return 4;
    case 'restricted_anonymous':
      return 5;
    default:
      return 99;
  }
}

/** Strongest → weakest for the statute ladder. */
export function sortEvidenceLadder(records: StrategyRecord[]): StrategyRecord[] {
  return [...records].sort(
    (a, b) => ladderRank(a) - ladderRank(b) || b.priority - a.priority,
  );
}

export function matchesSourceQuery(record: StrategyRecord, needle: string): boolean {
  if (!needle) return true;
  const config = record.configuration ?? {};
  const haystack = [
    record.name,
    record.status,
    record.description,
    ...LADDER_GATE_ROWS.map((row) => configDisplay(config, row.key)),
    configDisplay(config, 'sourceCategory'),
    configDisplay(config, 'state'),
    configDisplay(config, 'systemKey'),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}
