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

export function matchesEditorialQuery(record: StrategyRecord, needle: string): boolean {
  if (!needle) return true;
  const config = record.configuration ?? {};
  const haystack = [
    record.name,
    record.status,
    record.description,
    ...CHARTER_RULE_FIELDS.map((key) => configDisplay(config, key)),
    configDisplay(config, 'chapter'),
    configDisplay(config, 'systemKey'),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function filterEditorialRecords(records: StrategyRecord[], query: string): StrategyRecord[] {
  const needle = query.trim().toLowerCase();
  return records
    .filter((record) => matchesEditorialQuery(record, needle))
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
}

export function filledRuleCount(record: StrategyRecord): number {
  const config = record.configuration ?? {};
  return CHARTER_RULE_FIELDS.reduce(
    (count, key) => count + (configDisplay(config, key).trim() ? 1 : 0),
    0,
  );
}
