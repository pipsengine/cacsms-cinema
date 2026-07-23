import type { StrategyRecord } from '@/lib/strategy/contracts';
import { getSection } from '@/apps/web/lib/strategy-config';
import { configDisplay, fieldLabel } from '@/apps/web/lib/strategy-taxonomy';

export type AudienceSegment = 'primary' | 'secondary' | 'excluded' | 'unclassified';

export type AudienceFilter = 'all' | AudienceSegment;

export type AudienceFieldGroup = {
  id: 'who' | 'needs' | 'reach' | 'success';
  label: string;
  fields: string[];
};

const AUDIENCE_FIELDS = getSection('audiences')?.fields ?? [];

export const WHO_FIELDS = [
  'ageRange',
  'knowledgeLevel',
  'interestGroup',
  'countryRegion',
  'languages',
  'accessibilityNeeds',
] as const;

export const NEEDS_FIELDS = [
  'informationNeeds',
  'questions',
  'learningOutcomes',
] as const;

export const REACH_FIELDS = [
  'preferredTone',
  'formats',
  'duration',
  'channels',
  'deviceBandwidth',
  'viewingBehaviour',
] as const;

export const SUCCESS_FIELDS = [
  'engagementObjectives',
  'sensitivityTolerance',
  'successMetrics',
] as const;

export { configDisplay, fieldLabel };

export function audienceFieldKeys(): string[] {
  return AUDIENCE_FIELDS;
}

export function audienceFieldGroups(): AudienceFieldGroup[] {
  return [
    { id: 'who', label: 'Who they are', fields: [...WHO_FIELDS] },
    { id: 'needs', label: 'What they need', fields: [...NEEDS_FIELDS] },
    { id: 'reach', label: 'How to reach them', fields: [...REACH_FIELDS] },
    { id: 'success', label: 'Success signals', fields: [...SUCCESS_FIELDS] },
  ];
}

export function isAudienceStub(record: StrategyRecord): boolean {
  const key = String(record.configuration?.systemKey ?? '');
  return key === 'policy.audiences' || (record.name === 'Audiences' && !key.startsWith('aud.'));
}

export function isAudiencePolicyProfile(record: StrategyRecord): boolean {
  return String(record.configuration?.systemKey ?? '').startsWith('aud.');
}

/** Resolve segment from persisted config only — never invent audience tiers. */
export function audienceSegment(record: StrategyRecord): AudienceSegment {
  const config = record.configuration ?? {};
  const raw = [
    config.audienceTier,
    config.audienceType,
    config.segment,
    config.tier,
    config.role,
  ]
    .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
    .find(Boolean);

  if (!raw) return 'unclassified';
  if (raw.includes('primary') || raw === 'core' || raw === 'main') return 'primary';
  if (raw.includes('secondary') || raw === 'adjacent') return 'secondary';
  if (raw.includes('exclud') || raw === 'blocked' || raw === 'ban') return 'excluded';
  return 'unclassified';
}

export function segmentLabel(segment: AudienceSegment): string {
  switch (segment) {
    case 'primary':
      return 'Primary';
    case 'secondary':
      return 'Secondary';
    case 'excluded':
      return 'Excluded';
    default:
      return 'Unclassified';
  }
}

export function matchesAudienceQuery(record: StrategyRecord, needle: string): boolean {
  if (!needle) return true;
  const config = record.configuration ?? {};
  const haystack = [
    record.name,
    record.status,
    record.description,
    segmentLabel(audienceSegment(record)),
    ...AUDIENCE_FIELDS.map((key) => configDisplay(config, key)),
    configDisplay(config, 'origin'),
    configDisplay(config, 'systemKey'),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function filterAudienceRecords(
  records: StrategyRecord[],
  query: string,
  filter: AudienceFilter,
): StrategyRecord[] {
  const needle = query.trim().toLowerCase();
  return records.filter((record) => {
    if (!matchesAudienceQuery(record, needle)) return false;
    if (filter === 'all') return true;
    return audienceSegment(record) === filter;
  });
}

export function groupAudiencesBySegment(
  records: StrategyRecord[],
): Record<AudienceSegment, StrategyRecord[]> {
  const groups: Record<AudienceSegment, StrategyRecord[]> = {
    primary: [],
    secondary: [],
    excluded: [],
    unclassified: [],
  };
  for (const record of records) {
    groups[audienceSegment(record)].push(record);
  }
  for (const key of Object.keys(groups) as AudienceSegment[]) {
    groups[key].sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
  }
  return groups;
}

export function filledFieldCount(record: StrategyRecord, fields: readonly string[]): number {
  const config = record.configuration ?? {};
  return fields.reduce(
    (count, key) => count + (configDisplay(config, key).trim() ? 1 : 0),
    0,
  );
}
