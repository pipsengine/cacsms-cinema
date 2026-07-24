import type { StrategyRecord } from '@/lib/strategy/contracts';
import { configDisplay, fieldLabel } from '@/apps/web/lib/strategy-taxonomy';

export { configDisplay, fieldLabel };

/** Timeline axis in seconds (30s → 20m). */
export const TIMELINE_MIN_SEC = 30;
export const TIMELINE_MAX_SEC = 1200;

export const SPEC_FIELDS = [
  'format',
  'purpose',
  'minimumDuration',
  'maximumDuration',
  'narrativeStructure',
  'aspectRatios',
  'visualRequirements',
  'audioRequirements',
  'captions',
  'accessibility',
] as const;

export const PRODUCTION_FIELDS = [
  'evidenceDepth',
  'costBoundary',
  'frequency',
  'narrativeStructure',
  'visualRequirements',
  'audioRequirements',
] as const;

export const PLATFORM_FIELDS = ['channels', 'aspectRatios', 'audiences', 'fields'] as const;

export const CALL_SHEET_FIELDS = [
  { key: 'purpose', label: 'Purpose' },
  { key: 'narrativeStructure', label: 'Structure' },
  { key: 'evidenceDepth', label: 'Evidence' },
  { key: 'visualRequirements', label: 'Visual' },
  { key: 'audioRequirements', label: 'Audio' },
  { key: 'captions', label: 'Captions' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'channels', label: 'Channels' },
] as const;

export type FormatCategory =
  | 'short_form'
  | 'explainer'
  | 'lesson'
  | 'documentary'
  | 'audio'
  | 'text'
  | 'visual'
  | 'other';

export type FormatFilter =
  | 'all'
  | FormatCategory
  | 'validated'
  | 'stub_only'
  | 'thin_spec'
  | 'duplicate';

export function isFormatStub(record: StrategyRecord): boolean {
  const key = String(record.configuration?.systemKey ?? '');
  return (
    key === 'policy.formats' ||
    ((record.name === 'Formats' || record.name === 'Content Format Strategy') &&
      !key.startsWith('fmt.'))
  );
}

export function isFormatPolicyProfile(record: StrategyRecord): boolean {
  return String(record.configuration?.systemKey ?? '').startsWith('fmt.');
}

function parseDurationToSec(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(s|m|min|secs?|mins?)?$/);
  if (!match) return null;
  const n = Number(match[1]);
  const unit = match[2] ?? 's';
  if (unit.startsWith('m')) return Math.round(n * 60);
  return Math.round(n);
}

export function durationBounds(record: StrategyRecord): { min: number; max: number } {
  const minCfg = Number(record.configuration?.durationMinSec);
  const maxCfg = Number(record.configuration?.durationMaxSec);
  if (Number.isFinite(minCfg) && Number.isFinite(maxCfg) && maxCfg >= minCfg) {
    return { min: minCfg, max: maxCfg };
  }
  const min =
    parseDurationToSec(configDisplay(record.configuration, 'minimumDuration')) ?? TIMELINE_MIN_SEC;
  const max =
    parseDurationToSec(configDisplay(record.configuration, 'maximumDuration')) ??
    Math.max(min, TIMELINE_MIN_SEC * 2);
  return { min, max };
}

/** 0–100 position on the shared timeline axis. */
export function timelinePercent(sec: number): number {
  const clamped = Math.min(TIMELINE_MAX_SEC, Math.max(TIMELINE_MIN_SEC, sec));
  return ((clamped - TIMELINE_MIN_SEC) / (TIMELINE_MAX_SEC - TIMELINE_MIN_SEC)) * 100;
}

export function formatDurationLabel(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.round(sec / 60);
  return `${m}m`;
}

export function aspectList(record: StrategyRecord): string[] {
  return configDisplay(record.configuration, 'aspectRatios')
    .split(/[·;,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function splitList(value?: string) {
  return (value ?? '')
    .split(/[,;|·]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function sortFormatsByDuration(records: StrategyRecord[]): StrategyRecord[] {
  return [...records].sort((a, b) => {
    const da = durationBounds(a);
    const db = durationBounds(b);
    return da.min - db.min || da.max - db.max || b.priority - a.priority;
  });
}

export function formatCategory(record: StrategyRecord): FormatCategory {
  const family = String(record.configuration?.family ?? '').toLowerCase();
  const name = record.name.toLowerCase();
  const hay = `${family} ${name} ${configDisplay(record.configuration, 'format')}`.toLowerCase();
  if (family === 'short_form' || hay.includes('short') || hay.includes('reel') || hay.includes('clip')) {
    return 'short_form';
  }
  if (family === 'explainer' || hay.includes('explainer') || hay.includes('tutorial')) {
    return 'explainer';
  }
  if (family === 'lesson' || hay.includes('lesson') || hay.includes('classroom') || hay.includes('educat')) {
    return 'lesson';
  }
  if (hay.includes('doc') || hay.includes('long-form') || hay.includes('feature')) return 'documentary';
  if (hay.includes('podcast') || hay.includes('audio')) return 'audio';
  if (hay.includes('article') || hay.includes('blog') || hay.includes('newsletter') || hay.includes('report')) {
    return 'text';
  }
  if (hay.includes('infographic') || hay.includes('image') || hay.includes('presentation')) {
    return 'visual';
  }
  return 'other';
}

export function categoryLabel(category: FormatCategory): string {
  switch (category) {
    case 'short_form':
      return 'Short-form';
    case 'explainer':
      return 'Explainer';
    case 'lesson':
      return 'Lesson';
    case 'documentary':
      return 'Documentary';
    case 'audio':
      return 'Audio';
    case 'text':
      return 'Text';
    case 'visual':
      return 'Visual';
    default:
      return 'Other';
  }
}

export function filledFieldCount(record: StrategyRecord, fields: readonly string[]): number {
  const config = record.configuration ?? {};
  return fields.reduce(
    (count, key) => count + (configDisplay(config, key).trim() ? 1 : 0),
    0,
  );
}

export function formatCoverage(record: StrategyRecord): number {
  const all = [...SPEC_FIELDS, ...PRODUCTION_FIELDS, ...PLATFORM_FIELDS];
  const unique = [...new Set(all)];
  return Math.round((filledFieldCount(record, unique) / Math.max(1, unique.length)) * 100);
}

export function formatIssues(records: StrategyRecord[]) {
  const stubs = records.filter(isFormatStub);
  const thinSpecs = records.filter(
    (record) => isFormatPolicyProfile(record) && formatCoverage(record) < 40,
  );
  const nameBuckets = new Map<string, StrategyRecord[]>();
  for (const record of records) {
    const key = `${record.name.trim().toLowerCase()}::${String(record.configuration?.family ?? '')}`;
    const bucket = nameBuckets.get(key) ?? [];
    bucket.push(record);
    nameBuckets.set(key, bucket);
  }
  const duplicates = [...nameBuckets.values()].filter((list) => list.length > 1).flat();
  const missingChannels = records.filter(
    (record) =>
      isFormatPolicyProfile(record) && !configDisplay(record.configuration, 'channels').trim(),
  );
  const missingAspect = records.filter(
    (record) =>
      isFormatPolicyProfile(record) && !configDisplay(record.configuration, 'aspectRatios').trim(),
  );

  return {
    stubs,
    thinSpecs,
    duplicates,
    missingChannels,
    missingAspect,
    issueCount:
      stubs.length +
      thinSpecs.length +
      duplicates.length +
      missingChannels.length +
      missingAspect.length,
  };
}

export function matchesFormatQuery(record: StrategyRecord, needle: string): boolean {
  if (!needle) return true;
  const config = record.configuration ?? {};
  const haystack = [
    record.name,
    record.status,
    record.description,
    categoryLabel(formatCategory(record)),
    ...SPEC_FIELDS.map((key) => configDisplay(config, key)),
    ...PLATFORM_FIELDS.map((key) => configDisplay(config, key)),
    configDisplay(config, 'systemKey'),
    configDisplay(config, 'family'),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function filterFormatRecords(
  records: StrategyRecord[],
  query: string,
  filter: FormatFilter = 'all',
): StrategyRecord[] {
  const needle = query.trim().toLowerCase();
  const issues = formatIssues(records);
  return sortFormatsByDuration(
    records.filter((record) => {
      if (!matchesFormatQuery(record, needle)) return false;
      if (filter === 'all') return true;
      if (filter === 'validated') return record.status === 'ACTIVE' || record.status === 'READY';
      if (filter === 'stub_only') return isFormatStub(record);
      if (filter === 'thin_spec') return issues.thinSpecs.some((item) => item.id === record.id);
      if (filter === 'duplicate') return issues.duplicates.some((item) => item.id === record.id);
      return formatCategory(record) === filter;
    }),
  );
}

export function formatSubtitle(record: StrategyRecord): string {
  const bounds = durationBounds(record);
  const parts = [
    categoryLabel(formatCategory(record)),
    `${formatDurationLabel(bounds.min)}–${formatDurationLabel(bounds.max)}`,
    configDisplay(record.configuration, 'channels'),
  ].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  if (isFormatStub(record)) return 'Baseline format stub';
  return 'Content format';
}
