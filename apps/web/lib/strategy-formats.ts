import type { StrategyRecord } from '@/lib/strategy/contracts';
import { configDisplay, fieldLabel } from '@/apps/web/lib/strategy-taxonomy';

export { configDisplay, fieldLabel };

/** Timeline axis in seconds (30s → 20m). */
export const TIMELINE_MIN_SEC = 30;
export const TIMELINE_MAX_SEC = 1200;

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

export function sortFormatsByDuration(records: StrategyRecord[]): StrategyRecord[] {
  return [...records].sort((a, b) => {
    const da = durationBounds(a);
    const db = durationBounds(b);
    return da.min - db.min || da.max - db.max || b.priority - a.priority;
  });
}

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
