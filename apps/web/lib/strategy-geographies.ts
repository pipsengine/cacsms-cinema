import type { StrategyRecord } from '@/lib/strategy/contracts';
import { getSection } from '@/apps/web/lib/strategy-config';
import { configDisplay, fieldLabel } from '@/apps/web/lib/strategy-taxonomy';

export type GeographyFilter = 'all' | 'with_country' | 'stub_only';

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
  return records.filter((record) => {
    if (!matchesGeographyQuery(record, needle)) return false;
    if (filter === 'with_country') return hasCountry(record);
    if (filter === 'stub_only') return isGeographyStub(record);
    return true;
  });
}

export function filledFieldCount(record: StrategyRecord, fields: readonly string[]): number {
  const config = record.configuration ?? {};
  return fields.reduce((count, key) => {
    return count + (configDisplay(config, key).trim() ? 1 : 0);
  }, 0);
}
