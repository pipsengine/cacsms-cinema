import type { StrategyRecord } from '@/lib/strategy/contracts';
import { configDisplay, fieldLabel } from '@/apps/web/lib/strategy-taxonomy';

export type CellTone = 'ok' | 'staged' | 'gap' | 'blocked' | 'unknown';

export type MatrixColumn = {
  id: 'enablement' | 'provider' | 'automation' | 'publish';
  label: string;
};

export { configDisplay, fieldLabel };

export const MATRIX_COLUMNS: MatrixColumn[] = [
  { id: 'enablement', label: 'Strategic enablement' },
  { id: 'provider', label: 'Provider readiness' },
  { id: 'automation', label: 'Automation' },
  { id: 'publish', label: 'Publish posture' },
];

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

export function sortChannels(records: StrategyRecord[]): StrategyRecord[] {
  return [...records].sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
}
