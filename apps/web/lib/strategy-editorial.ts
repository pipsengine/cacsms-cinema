import type { StrategyRecord } from '@/lib/strategy/contracts';
import { configDisplay, fieldLabel } from '@/apps/web/lib/strategy-taxonomy';

/** Rule fields shown in the selected chapter body (ordered for reading). */
export const CHARTER_RULE_FIELDS = [
  'brandPurpose',
  'editorialMission',
  'voiceAndTone',
  'documentaryStyle',
  'narrativePrinciples',
  'factualityRules',
  'neutrality',
  'representationStandards',
  'culturalSensitivity',
  'prohibitedContent',
  'restrictedContent',
  'disclosures',
  'aiDisclosure',
  'quotationRules',
  'correctionPolicy',
  'citationStandards',
  'brandingRules',
  'reviewRequirements',
] as const;

export const STANDARDS_FIELDS = [
  'factualityRules',
  'neutrality',
  'citationStandards',
  'quotationRules',
  'correctionPolicy',
  'narrativePrinciples',
] as const;

export const BRAND_FIELDS = [
  'brandPurpose',
  'brandingRules',
  'editorialMission',
  'documentaryStyle',
] as const;

export const VOICE_FIELDS = ['voiceAndTone', 'documentaryStyle', 'narrativePrinciples'] as const;

export const SAFETY_FIELDS = [
  'prohibitedContent',
  'restrictedContent',
  'disclosures',
  'aiDisclosure',
  'culturalSensitivity',
  'representationStandards',
  'reviewRequirements',
] as const;

export type EditorialCategory =
  | 'mission'
  | 'voice'
  | 'safety'
  | 'brand'
  | 'standards'
  | 'other';

export type EditorialFilter =
  | 'all'
  | EditorialCategory
  | 'validated'
  | 'stub_only'
  | 'thin_chapter'
  | 'duplicate';

export { configDisplay, fieldLabel };

export function isEditorialStub(record: StrategyRecord): boolean {
  const key = String(record.configuration?.systemKey ?? '');
  return (
    key === 'policy.editorial-policy' ||
    ((record.name === 'Editorial Policy' || record.name === 'Editorial policy') &&
      !key.startsWith('ed.'))
  );
}

export function isEditorialPolicyChapter(record: StrategyRecord): boolean {
  return String(record.configuration?.systemKey ?? '').startsWith('ed.');
}

export function chapterKey(record: StrategyRecord): string {
  const chapter = configDisplay(record.configuration, 'chapter');
  if (chapter) return chapter;
  const key = String(record.configuration?.systemKey ?? '');
  return key.replace(/^ed\./, '') || 'chapter';
}

export function editorialCategory(record: StrategyRecord): EditorialCategory {
  const key = chapterKey(record).toLowerCase();
  if (key.includes('mission') || key.includes('purpose')) return 'mission';
  if (key.includes('voice') || key.includes('tone') || key.includes('style')) return 'voice';
  if (
    key.includes('safety') ||
    key.includes('prohib') ||
    key.includes('compliance') ||
    key.includes('disclosure') ||
    key.includes('fact')
  ) {
    return 'safety';
  }
  if (key.includes('brand')) return 'brand';
  if (key.includes('standard') || key.includes('citation') || key.includes('review')) return 'standards';
  return 'other';
}

export function categoryLabel(category: EditorialCategory): string {
  switch (category) {
    case 'mission':
      return 'Mission';
    case 'voice':
      return 'Voice & tone';
    case 'safety':
      return 'Safety & compliance';
    case 'brand':
      return 'Brand';
    case 'standards':
      return 'Standards';
    default:
      return 'Other';
  }
}

export function matchesEditorialQuery(record: StrategyRecord, needle: string): boolean {
  if (!needle) return true;
  const config = record.configuration ?? {};
  const haystack = [
    record.name,
    record.status,
    record.description,
    categoryLabel(editorialCategory(record)),
    ...CHARTER_RULE_FIELDS.map((key) => configDisplay(config, key)),
    configDisplay(config, 'chapter'),
    configDisplay(config, 'systemKey'),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function filledRuleCount(record: StrategyRecord): number {
  const config = record.configuration ?? {};
  return CHARTER_RULE_FIELDS.reduce(
    (count, key) => count + (configDisplay(config, key).trim() ? 1 : 0),
    0,
  );
}

export function chapterCoverage(record: StrategyRecord): number {
  return Math.round((filledRuleCount(record) / Math.max(1, CHARTER_RULE_FIELDS.length)) * 100);
}

export function editorialIssues(records: StrategyRecord[]) {
  const stubs = records.filter(isEditorialStub);
  const thinChapters = records.filter(
    (record) => isEditorialPolicyChapter(record) && chapterCoverage(record) < 40,
  );
  const nameBuckets = new Map<string, StrategyRecord[]>();
  for (const record of records) {
    const key = `${record.name.trim().toLowerCase()}::${chapterKey(record)}`;
    const bucket = nameBuckets.get(key) ?? [];
    bucket.push(record);
    nameBuckets.set(key, bucket);
  }
  const duplicates = [...nameBuckets.values()].filter((list) => list.length > 1).flat();

  const conflicts = records.filter((record) => {
    if (!isEditorialPolicyChapter(record)) return false;
    const prohibited = configDisplay(record.configuration, 'prohibitedContent').trim();
    const restricted = configDisplay(record.configuration, 'restrictedContent').trim();
    if (!prohibited || !restricted) return false;
    return prohibited.toLowerCase() === restricted.toLowerCase();
  });

  return {
    stubs,
    thinChapters,
    duplicates,
    conflicts,
    issueCount: stubs.length + thinChapters.length + duplicates.length + conflicts.length,
  };
}

export function filterEditorialRecords(
  records: StrategyRecord[],
  query: string,
  filter: EditorialFilter = 'all',
): StrategyRecord[] {
  const needle = query.trim().toLowerCase();
  const issues = editorialIssues(records);
  return records
    .filter((record) => {
      if (!matchesEditorialQuery(record, needle)) return false;
      if (filter === 'all') return true;
      if (filter === 'validated') return record.status === 'ACTIVE' || record.status === 'READY';
      if (filter === 'stub_only') return isEditorialStub(record);
      if (filter === 'thin_chapter') {
        return issues.thinChapters.some((item) => item.id === record.id);
      }
      if (filter === 'duplicate') return issues.duplicates.some((item) => item.id === record.id);
      return editorialCategory(record) === filter;
    })
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
}

export function chapterSubtitle(record: StrategyRecord): string {
  const parts = [
    categoryLabel(editorialCategory(record)),
    configDisplay(record.configuration, 'chapter'),
  ].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  if (isEditorialStub(record)) return 'Baseline editorial stub';
  return 'Policy chapter';
}
