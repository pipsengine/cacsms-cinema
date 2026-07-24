import type { StrategyRecord } from '@/lib/strategy/contracts';
import { configDisplay, fieldLabel } from '@/apps/web/lib/strategy-taxonomy';

export type LocaleFamily = 'english' | 'hausa' | 'yoruba' | 'igbo' | 'pidgin' | 'other';

export type LocalisationFilter =
  | 'all'
  | LocaleFamily
  | 'hub'
  | 'satellite'
  | 'validated'
  | 'review_required'
  | 'stub_only'
  | 'thin_pack'
  | 'duplicate';

export type AdaptationStep = {
  id: string;
  label: string;
  field: string;
};

export { configDisplay, fieldLabel };

/** Vertical adaptation ladder shown under the constellation. */
export const ADAPTATION_LADDER: AdaptationStep[] = [
  { id: 'translate', label: 'Translate', field: 'translationRules' },
  { id: 'voice', label: 'Voice & orthography', field: 'transliterationRules' },
  { id: 'accent', label: 'Accent / VO', field: 'accentPreferences' },
  { id: 'captions', label: 'Captions', field: 'captions' },
  { id: 'culture', label: 'Cultural adaptation', field: 'culturalAdaptation' },
  { id: 'review', label: 'Human review', field: 'humanReview' },
];

export const LANGUAGE_PACK_FIELDS = [
  'primaryLanguage',
  'secondaryLanguages',
  'subtitleLanguages',
  'readingLevel',
  'pronunciationDictionary',
  'localTerminology',
] as const;

export const REGIONAL_FIELDS = [
  'countryMappings',
  'regionalVariants',
  'dateNumberFormats',
  'measurementUnits',
  'culturalAdaptation',
] as const;

export const TRANSLATION_FIELDS = [
  'translationRules',
  'transliterationRules',
  'machineTranslationThreshold',
  'accentPreferences',
  'captions',
] as const;

export const CULTURE_FIELDS = [
  'culturalAdaptation',
  'humanReview',
  'regionalVariants',
  'localTerminology',
  'readingLevel',
] as const;

export function isLocalisationStub(record: StrategyRecord): boolean {
  const key = String(record.configuration?.systemKey ?? '');
  return (
    key === 'policy.localisation' ||
    ((record.name === 'Localisation' || record.name === 'Language & Localisation') &&
      !key.startsWith('loc.'))
  );
}

export function isLocalisationPolicyKit(record: StrategyRecord): boolean {
  return String(record.configuration?.systemKey ?? '').startsWith('loc.');
}

export function localeFamily(record: StrategyRecord): LocaleFamily {
  const family = String(record.configuration?.localeFamily ?? '').toLowerCase();
  if (
    family === 'english' ||
    family === 'hausa' ||
    family === 'yoruba' ||
    family === 'igbo' ||
    family === 'pidgin'
  ) {
    return family;
  }
  return 'other';
}

export function isHubLocale(record: StrategyRecord): boolean {
  return localeFamily(record) === 'english' || String(record.configuration?.systemKey) === 'loc.en-ng';
}

export function familyShort(family: LocaleFamily): string {
  switch (family) {
    case 'english':
      return 'EN';
    case 'hausa':
      return 'HA';
    case 'yoruba':
      return 'YO';
    case 'igbo':
      return 'IG';
    case 'pidgin':
      return 'PCM';
    default:
      return '?';
  }
}

export function familyLabel(family: LocaleFamily): string {
  switch (family) {
    case 'english':
      return 'English';
    case 'hausa':
      return 'Hausa';
    case 'yoruba':
      return 'Yoruba';
    case 'igbo':
      return 'Igbo';
    case 'pidgin':
      return 'Pidgin';
    default:
      return 'Other';
  }
}

/** Hub first, then satellites by priority. */
export function sortLocaleConstellation(records: StrategyRecord[]): StrategyRecord[] {
  return [...records].sort((a, b) => {
    const hubDelta = Number(isHubLocale(b)) - Number(isHubLocale(a));
    if (hubDelta) return hubDelta;
    return b.priority - a.priority || a.name.localeCompare(b.name);
  });
}

export function requiresHumanReview(record: StrategyRecord): boolean {
  const review = configDisplay(record.configuration, 'humanReview').toLowerCase();
  return review.includes('required') || review.includes('mandatory') || review.includes('every');
}

export function languageStack(record: StrategyRecord): string[] {
  const primary = configDisplay(record.configuration, 'primaryLanguage');
  const secondary = configDisplay(record.configuration, 'secondaryLanguages');
  return [primary, ...secondary.split(/[,;]/).map((s) => s.trim())].filter(Boolean);
}

export function splitList(value?: string) {
  return (value ?? '')
    .split(/[,;|·]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function filledFieldCount(record: StrategyRecord, fields: readonly string[]): number {
  const config = record.configuration ?? {};
  return fields.reduce(
    (count, key) => count + (configDisplay(config, key).trim() ? 1 : 0),
    0,
  );
}

export function localisationCoverage(record: StrategyRecord): number {
  const all = [
    ...LANGUAGE_PACK_FIELDS,
    ...REGIONAL_FIELDS,
    ...TRANSLATION_FIELDS,
    ...CULTURE_FIELDS,
  ];
  const unique = [...new Set(all)];
  return Math.round((filledFieldCount(record, unique) / Math.max(1, unique.length)) * 100);
}

export function ladderCompletion(record: StrategyRecord): number {
  const filled = ADAPTATION_LADDER.filter((step) =>
    configDisplay(record.configuration, step.field).trim(),
  ).length;
  return Math.round((filled / Math.max(1, ADAPTATION_LADDER.length)) * 100);
}

export function localisationIssues(records: StrategyRecord[]) {
  const stubs = records.filter(isLocalisationStub);
  const thinPacks = records.filter(
    (record) => isLocalisationPolicyKit(record) && localisationCoverage(record) < 40,
  );
  const nameBuckets = new Map<string, StrategyRecord[]>();
  for (const record of records) {
    const key = `${record.name.trim().toLowerCase()}::${localeFamily(record)}`;
    const bucket = nameBuckets.get(key) ?? [];
    bucket.push(record);
    nameBuckets.set(key, bucket);
  }
  const duplicates = [...nameBuckets.values()].filter((list) => list.length > 1).flat();
  const missingTranslation = records.filter(
    (record) =>
      isLocalisationPolicyKit(record) &&
      !configDisplay(record.configuration, 'translationRules').trim(),
  );
  const missingCulture = records.filter(
    (record) =>
      isLocalisationPolicyKit(record) &&
      !configDisplay(record.configuration, 'culturalAdaptation').trim(),
  );
  const reviewRequired = records.filter(
    (record) => isLocalisationPolicyKit(record) && requiresHumanReview(record),
  );

  return {
    stubs,
    thinPacks,
    duplicates,
    missingTranslation,
    missingCulture,
    reviewRequired,
    issueCount:
      stubs.length +
      thinPacks.length +
      duplicates.length +
      missingTranslation.length +
      missingCulture.length,
  };
}

export function matchesLocalisationQuery(record: StrategyRecord, needle: string): boolean {
  if (!needle) return true;
  const config = record.configuration ?? {};
  const haystack = [
    record.name,
    record.status,
    record.description,
    familyLabel(localeFamily(record)),
    ...languageStack(record),
    ...LANGUAGE_PACK_FIELDS.map((key) => configDisplay(config, key)),
    ...TRANSLATION_FIELDS.map((key) => configDisplay(config, key)),
    configDisplay(config, 'systemKey'),
    configDisplay(config, 'countryMappings'),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function filterLocalisationRecords(
  records: StrategyRecord[],
  query: string,
  filter: LocalisationFilter = 'all',
): StrategyRecord[] {
  const needle = query.trim().toLowerCase();
  const issues = localisationIssues(records);
  return sortLocaleConstellation(
    records.filter((record) => {
      if (!matchesLocalisationQuery(record, needle)) return false;
      if (filter === 'all') return true;
      if (filter === 'hub') return isHubLocale(record);
      if (filter === 'satellite') return !isHubLocale(record) && isLocalisationPolicyKit(record);
      if (filter === 'validated') return record.status === 'ACTIVE' || record.status === 'READY';
      if (filter === 'review_required') return requiresHumanReview(record);
      if (filter === 'stub_only') return isLocalisationStub(record);
      if (filter === 'thin_pack') return issues.thinPacks.some((item) => item.id === record.id);
      if (filter === 'duplicate') return issues.duplicates.some((item) => item.id === record.id);
      return localeFamily(record) === filter;
    }),
  );
}

export function localisationSubtitle(record: StrategyRecord): string {
  const parts = [
    isHubLocale(record) ? 'Hub' : 'Satellite',
    familyLabel(localeFamily(record)),
    configDisplay(record.configuration, 'primaryLanguage'),
  ].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  if (isLocalisationStub(record)) return 'Baseline localisation stub';
  return 'Language pack';
}

export function uniqueLanguages(records: StrategyRecord[]): string[] {
  const set = new Set<string>();
  for (const record of records) {
    for (const lang of languageStack(record)) set.add(lang);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function uniqueRegions(records: StrategyRecord[]): string[] {
  const set = new Set<string>();
  for (const record of records) {
    for (const region of splitList(configDisplay(record.configuration, 'countryMappings'))) {
      set.add(region);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
