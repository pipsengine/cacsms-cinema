import type { StrategyRecord } from '@/lib/strategy/contracts';
import { getSection } from '@/apps/web/lib/strategy-config';
import { configDisplay, fieldLabel } from '@/apps/web/lib/strategy-taxonomy';

export type GeographyFilter =
  | 'all'
  | 'with_country'
  | 'stub_only'
  | 'validated'
  | 'thin_culture'
  | 'missing_coverage';

export type GeographyFieldGroup = {
  id: 'place' | 'culture' | 'constraints';
  label: string;
  fields: string[];
};

const GEOGRAPHY_FIELDS = getSection('geographies')?.fields ?? [];

export const PLACE_FIELDS = [
  'country',
  'region',
  'state',
  'timeZone',
  'supportedLanguages',
] as const;

export const CULTURE_FIELDS = [
  'culturalContext',
  'historicalContext',
  'demographics',
  'eventsAndSeasons',
  'localTerminology',
] as const;

export const CONSTRAINT_FIELDS = [
  'representationRules',
  'sensitiveSubjects',
  'restrictedSubjects',
  'authenticityRules',
  'localSourceRequirements',
  'visualRepresentation',
] as const;

export { configDisplay, fieldLabel };

export function geographyFieldKeys(): string[] {
  return GEOGRAPHY_FIELDS;
}

export function geographyFieldGroups(): GeographyFieldGroup[] {
  return [
    { id: 'place', label: 'Place', fields: [...PLACE_FIELDS] },
    { id: 'culture', label: 'Culture & history', fields: [...CULTURE_FIELDS] },
    { id: 'constraints', label: 'Constraints & authenticity', fields: [...CONSTRAINT_FIELDS] },
  ];
}

export function isGeographyStub(record: StrategyRecord): boolean {
  const key = String(record.configuration?.systemKey ?? '');
  return key === 'policy.geographies' || (record.name === 'Geographies' && !key.startsWith('geo.'));
}

export function isGeographyPolicyProfile(record: StrategyRecord): boolean {
  return String(record.configuration?.systemKey ?? '').startsWith('geo.');
}

export function hasCountry(record: StrategyRecord): boolean {
  return Boolean(configDisplay(record.configuration, 'country').trim());
}

export function geographySubtitle(record: StrategyRecord): string {
  const config = record.configuration ?? {};
  const country = configDisplay(config, 'country');
  const region = configDisplay(config, 'region');
  const state = configDisplay(config, 'state');
  const parts = [country, region, state].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  if (isGeographyStub(record)) return 'Baseline geography stub';
  return 'Geographic profile';
}

export function matchesGeographyQuery(record: StrategyRecord, needle: string): boolean {
  if (!needle) return true;
  const config = record.configuration ?? {};
  const haystack = [
    record.name,
    record.status,
    record.description,
    ...GEOGRAPHY_FIELDS.map((key) => configDisplay(config, key)),
    configDisplay(config, 'origin'),
    configDisplay(config, 'systemKey'),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function filterGeographyRecords(
  records: StrategyRecord[],
  query: string,
  filter: GeographyFilter,
): StrategyRecord[] {
  const needle = query.trim().toLowerCase();
  const issues = geographyIssues(records);
  return records.filter((record) => {
    if (!matchesGeographyQuery(record, needle)) return false;
    if (filter === 'with_country') return hasCountry(record);
    if (filter === 'stub_only') return isGeographyStub(record);
    if (filter === 'validated') return record.status === 'ACTIVE' || record.status === 'READY';
    if (filter === 'thin_culture') return issues.thinCulture.some((item) => item.id === record.id);
    if (filter === 'missing_coverage') {
      return issues.missingCoverage.some((item) => item.id === record.id);
    }
    return true;
  });
}

export function filledFieldCount(record: StrategyRecord, fields: readonly string[]): number {
  const config = record.configuration ?? {};
  return fields.reduce((count, key) => {
    return count + (configDisplay(config, key).trim() ? 1 : 0);
  }, 0);
}

export function splitList(value?: string) {
  return (value ?? '')
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function coverageScore(record: StrategyRecord): number {
  const all = [...PLACE_FIELDS, ...CULTURE_FIELDS, ...CONSTRAINT_FIELDS];
  const filled = filledFieldCount(record, all);
  return Math.round((filled / Math.max(1, all.length)) * 100);
}

export function uniqueCountries(records: StrategyRecord[]): string[] {
  const set = new Set<string>();
  for (const record of records) {
    const country = configDisplay(record.configuration, 'country').trim();
    if (country) set.add(country);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function uniqueRegions(records: StrategyRecord[]): string[] {
  const set = new Set<string>();
  for (const record of records) {
    const region = configDisplay(record.configuration, 'region').trim();
    if (region) set.add(region);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function uniqueLanguages(records: StrategyRecord[]): string[] {
  const set = new Set<string>();
  for (const record of records) {
    for (const lang of splitList(configDisplay(record.configuration, 'supportedLanguages'))) {
      set.add(lang);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function geographyIssues(records: StrategyRecord[]) {
  const missingCoverage = records.filter((record) => !hasCountry(record) && !isGeographyStub(record));
  const stubs = records.filter(isGeographyStub);
  const thinCulture = records.filter(
    (record) => isGeographyPolicyProfile(record) && filledFieldCount(record, CULTURE_FIELDS) === 0,
  );
  const thinConstraints = records.filter(
    (record) => isGeographyPolicyProfile(record) && filledFieldCount(record, CONSTRAINT_FIELDS) === 0,
  );
  return {
    missingCoverage,
    stubs,
    thinCulture,
    thinConstraints,
    issueCount: missingCoverage.length + stubs.length + thinCulture.length + thinConstraints.length,
  };
}

export function continentHint(country: string): string {
  const value = country.toLowerCase();
  if (!value) return 'Unassigned';
  if (['nigeria', 'ghana', 'kenya', 'south africa', 'egypt', 'senegal'].some((c) => value.includes(c))) {
    return 'Africa';
  }
  if (['united kingdom', 'uk', 'france', 'germany', 'ireland', 'spain'].some((c) => value.includes(c))) {
    return 'Europe';
  }
  if (['united states', 'usa', 'canada', 'mexico'].some((c) => value.includes(c))) {
    return 'North America';
  }
  if (['brazil', 'argentina', 'chile', 'colombia'].some((c) => value.includes(c))) {
    return 'South America';
  }
  if (['india', 'japan', 'china', 'singapore', 'indonesia'].some((c) => value.includes(c))) {
    return 'Asia';
  }
  if (['australia', 'new zealand'].some((c) => value.includes(c))) {
    return 'Oceania';
  }
  return 'Global / Other';
}
