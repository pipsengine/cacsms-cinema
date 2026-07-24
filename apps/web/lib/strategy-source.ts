import type { StrategyRecord } from '@/lib/strategy/contracts';
import { configDisplay, fieldLabel } from '@/apps/web/lib/strategy-taxonomy';

export type EvidenceClass =
  | 'primary_institutional'
  | 'scholarly'
  | 'journalism'
  | 'civil_society'
  | 'restricted_anonymous'
  | 'other';

export type SourceFilter =
  | 'all'
  | EvidenceClass
  | 'allowed'
  | 'conditional'
  | 'restricted'
  | 'validated'
  | 'stub_only'
  | 'thin_rung'
  | 'duplicate';

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

export const HIERARCHY_FIELDS = [
  'sourceCategory',
  'state',
  'minimumAuthorityScore',
  'primarySourcePreference',
  'geographicRelevance',
] as const;

export const EVIDENCE_RULE_FIELDS = [
  'minimumCorroboration',
  'maximumAge',
  'anonymousRestrictions',
  'conflictCheck',
  'correctionCheck',
  'authorRequired',
] as const;

export const CITATION_FIELDS = [
  'citationRequired',
  'rightsRequired',
  'publicationDateRequired',
  'retrievalDateRequired',
  'authorRequired',
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

export function filledFieldCount(record: StrategyRecord, fields: readonly string[]): number {
  const config = record.configuration ?? {};
  return fields.reduce(
    (count, key) => count + (configDisplay(config, key).trim() ? 1 : 0),
    0,
  );
}

export function sourceCoverage(record: StrategyRecord): number {
  const all = [
    ...HIERARCHY_FIELDS,
    ...EVIDENCE_RULE_FIELDS,
    ...CITATION_FIELDS,
    ...LADDER_GATE_ROWS.map((row) => row.key),
  ];
  const unique = [...new Set(all)];
  return Math.round((filledFieldCount(record, unique) / Math.max(1, unique.length)) * 100);
}

export function gateCompletion(record: StrategyRecord): number {
  const filled = LADDER_GATE_ROWS.filter((row) =>
    configDisplay(record.configuration, row.key).trim(),
  ).length;
  return Math.round((filled / Math.max(1, LADDER_GATE_ROWS.length)) * 100);
}

export function sourceIssues(records: StrategyRecord[]) {
  const stubs = records.filter(isSourceStub);
  const thinRungs = records.filter(
    (record) => isSourcePolicyClass(record) && sourceCoverage(record) < 40,
  );
  const nameBuckets = new Map<string, StrategyRecord[]>();
  for (const record of records) {
    const key = `${record.name.trim().toLowerCase()}::${evidenceClass(record)}`;
    const bucket = nameBuckets.get(key) ?? [];
    bucket.push(record);
    nameBuckets.set(key, bucket);
  }
  const duplicates = [...nameBuckets.values()].filter((list) => list.length > 1).flat();
  const restricted = records.filter(
    (record) => isSourcePolicyClass(record) && sourceState(record) === 'RESTRICTED',
  );
  const missingCitation = records.filter(
    (record) =>
      isSourcePolicyClass(record) && !configDisplay(record.configuration, 'citationRequired').trim(),
  );
  const missingAuthority = records.filter(
    (record) =>
      isSourcePolicyClass(record) &&
      !configDisplay(record.configuration, 'minimumAuthorityScore').trim(),
  );

  return {
    stubs,
    thinRungs,
    duplicates,
    restricted,
    missingCitation,
    missingAuthority,
    issueCount:
      stubs.length +
      thinRungs.length +
      duplicates.length +
      missingCitation.length +
      missingAuthority.length,
  };
}

export function matchesSourceQuery(record: StrategyRecord, needle: string): boolean {
  if (!needle) return true;
  const config = record.configuration ?? {};
  const haystack = [
    record.name,
    record.status,
    record.description,
    evidenceClassLabel(evidenceClass(record)),
    sourceState(record),
    ...LADDER_GATE_ROWS.map((row) => configDisplay(config, row.key)),
    configDisplay(config, 'sourceCategory'),
    configDisplay(config, 'state'),
    configDisplay(config, 'systemKey'),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function filterSourceRecords(
  records: StrategyRecord[],
  query: string,
  filter: SourceFilter = 'all',
): StrategyRecord[] {
  const needle = query.trim().toLowerCase();
  const issues = sourceIssues(records);
  return sortEvidenceLadder(
    records.filter((record) => {
      if (!matchesSourceQuery(record, needle)) return false;
      if (filter === 'all') return true;
      if (filter === 'allowed') return sourceState(record) === 'ALLOWED';
      if (filter === 'conditional') return sourceState(record) === 'CONDITIONAL';
      if (filter === 'restricted') return sourceState(record) === 'RESTRICTED';
      if (filter === 'validated') return record.status === 'ACTIVE' || record.status === 'READY';
      if (filter === 'stub_only') return isSourceStub(record);
      if (filter === 'thin_rung') return issues.thinRungs.some((item) => item.id === record.id);
      if (filter === 'duplicate') return issues.duplicates.some((item) => item.id === record.id);
      return evidenceClass(record) === filter;
    }),
  );
}

export function sourceSubtitle(record: StrategyRecord): string {
  const parts = [
    `Rung ${ladderRank(record)}`,
    evidenceClassLabel(evidenceClass(record)),
    sourceState(record),
  ].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  if (isSourceStub(record)) return 'Baseline source stub';
  return 'Evidence class';
}
