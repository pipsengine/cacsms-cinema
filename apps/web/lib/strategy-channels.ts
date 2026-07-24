import type { StrategyRecord } from '@/lib/strategy/contracts';
import { configDisplay, fieldLabel } from '@/apps/web/lib/strategy-taxonomy';

export type CellTone = 'ok' | 'staged' | 'gap' | 'blocked' | 'unknown';

export type MatrixColumn = {
  id: 'enablement' | 'provider' | 'automation' | 'publish';
  label: string;
};

export type ChannelCategory =
  | 'owned'
  | 'social'
  | 'education'
  | 'partner'
  | 'internal'
  | 'messaging'
  | 'other';

export type ChannelFilter =
  | 'all'
  | ChannelCategory
  | 'validated'
  | 'enabled'
  | 'staged'
  | 'stub_only'
  | 'thin_config'
  | 'duplicate';

export { configDisplay, fieldLabel };

export const MATRIX_COLUMNS: MatrixColumn[] = [
  { id: 'enablement', label: 'Strategic enablement' },
  { id: 'provider', label: 'Provider readiness' },
  { id: 'automation', label: 'Automation' },
  { id: 'publish', label: 'Publish posture' },
];

export const PLATFORM_FIELDS = [
  'channel',
  'enabled',
  'providerAvailability',
  'aspectRatios',
  'durationLimits',
  'resolutionCodec',
  'metadataRequirements',
  'thumbnailRequirements',
  'captionRequirements',
] as const;

export const AUDIENCE_FIELDS = ['audiences', 'formats', 'geographicTargeting', 'objective'] as const;

export const DISTRIBUTION_FIELDS = [
  'cadence',
  'publishingWindows',
  'automationPermissions',
  'restrictions',
] as const;

export const PUBLISHING_FIELDS = [
  'cadence',
  'publishingWindows',
  'metadataRequirements',
  'captionRequirements',
  'thumbnailRequirements',
  'successMetrics',
] as const;

export const INSPECTOR_FIELDS = [
  'channel',
  'enabled',
  'objective',
  'formats',
  'audiences',
  'providerAvailability',
  'automationPermissions',
  'cadence',
  'restrictions',
] as const;

export function isChannelStub(record: StrategyRecord): boolean {
  const key = String(record.configuration?.systemKey ?? '');
  return (
    key === 'policy.channels' ||
    ((record.name === 'Channels' || record.name === 'Channel Strategy') && !key.startsWith('ch.'))
  );
}

export function isChannelPolicyProfile(record: StrategyRecord): boolean {
  return String(record.configuration?.systemKey ?? '').startsWith('ch.');
}

export function enablementState(record: StrategyRecord): string {
  const raw = configDisplay(record.configuration, 'enabled').trim().toUpperCase();
  if (raw === 'ENABLED' || raw === 'TRUE' || raw === 'YES') return 'ENABLED';
  if (raw === 'STAGED' || raw === 'STAGING') return 'STAGED';
  if (raw === 'DISABLED' || raw === 'FALSE' || raw === 'NO') return 'DISABLED';
  return 'UNKNOWN';
}

export function providerTone(record: StrategyRecord): CellTone {
  const provider = configDisplay(record.configuration, 'providerAvailability').toLowerCase();
  if (!provider.trim()) return 'gap';
  if (provider.includes('unavailable') || provider.includes('blocked')) return 'blocked';
  if (
    provider.includes('offline') ||
    provider.includes('until ') ||
    provider.includes('depends on') ||
    provider.includes('unmeasured if')
  ) {
    return 'gap';
  }
  if (provider.includes('optional') || provider.includes('owned')) return 'ok';
  return 'ok';
}

export function automationTone(record: StrategyRecord): CellTone {
  const text = configDisplay(record.configuration, 'automationPermissions').toLowerCase();
  if (text.includes('never') || text.includes('no auto')) return 'blocked';
  if (text.includes('while staged') || text.includes('require') || text.includes('block if')) {
    return 'staged';
  }
  if (text.includes('auto-publish') || text.includes('auto-package') || text.includes('auto-ingest')) {
    return 'ok';
  }
  return 'unknown';
}

export function publishTone(record: StrategyRecord): CellTone {
  const enabled = enablementState(record);
  const provider = providerTone(record);
  if (enabled === 'DISABLED') return 'blocked';
  if (enabled === 'STAGED') return 'staged';
  if (provider === 'gap' || provider === 'blocked') return 'gap';
  if (enabled === 'ENABLED' && provider === 'ok') return 'ok';
  return 'unknown';
}

export function matrixCell(
  record: StrategyRecord,
  column: MatrixColumn['id'],
): { label: string; tone: CellTone; detail: string } {
  switch (column) {
    case 'enablement': {
      const label = enablementState(record);
      const tone: CellTone =
        label === 'ENABLED' ? 'ok' : label === 'STAGED' ? 'staged' : label === 'DISABLED' ? 'blocked' : 'unknown';
      return {
        label,
        tone,
        detail: configDisplay(record.configuration, 'objective'),
      };
    }
    case 'provider': {
      const tone = providerTone(record);
      const labels: Record<CellTone, string> = {
        ok: 'READY',
        staged: 'STAGED',
        gap: 'GAP',
        blocked: 'BLOCKED',
        unknown: 'UNKNOWN',
      };
      return {
        label: labels[tone],
        tone,
        detail: configDisplay(record.configuration, 'providerAvailability'),
      };
    }
    case 'automation': {
      const tone = automationTone(record);
      const labels: Record<CellTone, string> = {
        ok: 'AUTO',
        staged: 'GATED',
        gap: 'GATED',
        blocked: 'MANUAL',
        unknown: '—',
      };
      return {
        label: labels[tone],
        tone,
        detail: configDisplay(record.configuration, 'automationPermissions'),
      };
    }
    case 'publish': {
      const tone = publishTone(record);
      const labels: Record<CellTone, string> = {
        ok: 'CAN PUBLISH',
        staged: 'HOLD',
        gap: 'WAIT PROVIDER',
        blocked: 'NO PUBLISH',
        unknown: '—',
      };
      return {
        label: labels[tone],
        tone,
        detail: configDisplay(record.configuration, 'restrictions'),
      };
    }
  }
}

export function sortChannels(records: StrategyRecord[]): StrategyRecord[] {
  return [...records].sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
}

export function splitList(value?: string) {
  return (value ?? '')
    .split(/[,;|·]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function channelCategory(record: StrategyRecord): ChannelCategory {
  const lane = String(record.configuration?.lane ?? '').toLowerCase();
  if (lane === 'owned' || lane === 'social' || lane === 'education' || lane === 'partner' || lane === 'internal') {
    return lane;
  }
  const hay = `${record.name} ${configDisplay(record.configuration, 'channel')}`.toLowerCase();
  if (hay.includes('whatsapp') || hay.includes('telegram') || hay.includes('email')) return 'messaging';
  if (hay.includes('youtube') || hay.includes('instagram') || hay.includes('tiktok') || hay.includes('social')) {
    return 'social';
  }
  if (hay.includes('lms') || hay.includes('classroom') || hay.includes('education')) return 'education';
  if (hay.includes('owned') || hay.includes('website') || hay.includes('library')) return 'owned';
  if (hay.includes('partner') || hay.includes('ott')) return 'partner';
  if (hay.includes('internal') || hay.includes('api')) return 'internal';
  return 'other';
}

export function categoryLabel(category: ChannelCategory): string {
  switch (category) {
    case 'owned':
      return 'Owned';
    case 'social':
      return 'Social';
    case 'education':
      return 'Education';
    case 'partner':
      return 'Partner';
    case 'internal':
      return 'Internal';
    case 'messaging':
      return 'Messaging';
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

export function channelCoverage(record: StrategyRecord): number {
  const all = [...PLATFORM_FIELDS, ...AUDIENCE_FIELDS, ...DISTRIBUTION_FIELDS, ...PUBLISHING_FIELDS];
  const unique = [...new Set(all)];
  return Math.round((filledFieldCount(record, unique) / Math.max(1, unique.length)) * 100);
}

export function channelIssues(records: StrategyRecord[]) {
  const stubs = records.filter(isChannelStub);
  const thinConfigs = records.filter(
    (record) => isChannelPolicyProfile(record) && channelCoverage(record) < 40,
  );
  const nameBuckets = new Map<string, StrategyRecord[]>();
  for (const record of records) {
    const key = `${record.name.trim().toLowerCase()}::${channelCategory(record)}`;
    const bucket = nameBuckets.get(key) ?? [];
    bucket.push(record);
    nameBuckets.set(key, bucket);
  }
  const duplicates = [...nameBuckets.values()].filter((list) => list.length > 1).flat();
  const providerGaps = records.filter(
    (record) => isChannelPolicyProfile(record) && providerTone(record) === 'gap',
  );
  const blockedPublish = records.filter(
    (record) => isChannelPolicyProfile(record) && publishTone(record) === 'blocked',
  );
  const missingFormats = records.filter(
    (record) =>
      isChannelPolicyProfile(record) && !configDisplay(record.configuration, 'formats').trim(),
  );

  return {
    stubs,
    thinConfigs,
    duplicates,
    providerGaps,
    blockedPublish,
    missingFormats,
    issueCount:
      stubs.length +
      thinConfigs.length +
      duplicates.length +
      providerGaps.length +
      blockedPublish.length +
      missingFormats.length,
  };
}

export function matchesChannelQuery(record: StrategyRecord, needle: string): boolean {
  if (!needle) return true;
  const config = record.configuration ?? {};
  const haystack = [
    record.name,
    record.status,
    record.description,
    categoryLabel(channelCategory(record)),
    enablementState(record),
    ...INSPECTOR_FIELDS.map((key) => configDisplay(config, key)),
    configDisplay(config, 'systemKey'),
    configDisplay(config, 'lane'),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function filterChannelRecords(
  records: StrategyRecord[],
  query: string,
  filter: ChannelFilter = 'all',
): StrategyRecord[] {
  const needle = query.trim().toLowerCase();
  const issues = channelIssues(records);
  return sortChannels(
    records.filter((record) => {
      if (!matchesChannelQuery(record, needle)) return false;
      if (filter === 'all') return true;
      if (filter === 'validated') return record.status === 'ACTIVE' || record.status === 'READY';
      if (filter === 'enabled') return enablementState(record) === 'ENABLED';
      if (filter === 'staged') return enablementState(record) === 'STAGED';
      if (filter === 'stub_only') return isChannelStub(record);
      if (filter === 'thin_config') {
        return issues.thinConfigs.some((item) => item.id === record.id);
      }
      if (filter === 'duplicate') return issues.duplicates.some((item) => item.id === record.id);
      return channelCategory(record) === filter;
    }),
  );
}

export function channelSubtitle(record: StrategyRecord): string {
  const parts = [
    categoryLabel(channelCategory(record)),
    enablementState(record),
    configDisplay(record.configuration, 'formats'),
  ].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  if (isChannelStub(record)) return 'Baseline channel stub';
  return 'Distribution channel';
}
