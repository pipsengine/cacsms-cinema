import type { StrategyRecord } from '@/lib/strategy/contracts';
import { configDisplay, fieldLabel } from '@/apps/web/lib/strategy-taxonomy';

export type PortfolioFilter =
  | 'all'
  | 'domains'
  | 'audiences'
  | 'regions'
  | 'formats'
  | 'channels'
  | 'languages'
  | 'capacity'
  | 'active'
  | 'stub_only'
  | 'thin_rule'
  | 'imbalanced'
  | 'duplicate'
  | 'over_allocation'
  | 'under_coverage';

export { configDisplay, fieldLabel };

export const ALLOCATION_FIELDS = [
  'dimension',
  'dimensionValue',
  'minimumAllocation',
  'maximumAllocation',
  'targetPercentage',
] as const;

export const CAPACITY_FIELDS = [
  'capacityLimit',
  'budgetLimit',
  'diversityRequirement',
  'repetitionLimit',
] as const;

export const SCHEDULE_FIELDS = [
  'timeWindow',
  'frequencyCap',
  'balancingLogic',
  'autoOptimize',
] as const;

export function isPortfolioStub(record: StrategyRecord): boolean {
  const key = String(record.configuration?.systemKey ?? '');
  return (
    key === 'policy.portfolio' ||
    ((record.name === 'Portfolio Allocation' || record.name === 'Portfolio') &&
      !key.startsWith('port.'))
  );
}

export function isPortfolioRule(record: StrategyRecord): boolean {
  return String(record.configuration?.systemKey ?? '').startsWith('port.');
}

export function allocationCategory(record: StrategyRecord): string {
  return (
    configDisplay(record.configuration, 'allocationCategory').trim() ||
    configDisplay(record.configuration, 'dimension').trim() ||
    'uncategorised'
  );
}

export function allocationCategoryLabel(value: string): string {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function parseAllocationNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toUpperCase() === 'UNMEASURED') return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

export function targetPercentage(record: StrategyRecord): number | null {
  return parseAllocationNumber(configDisplay(record.configuration, 'targetPercentage'));
}

export function minAllocation(record: StrategyRecord): number | null {
  return parseAllocationNumber(configDisplay(record.configuration, 'minimumAllocation'));
}

export function maxAllocation(record: StrategyRecord): number | null {
  return parseAllocationNumber(configDisplay(record.configuration, 'maximumAllocation'));
}

export function filledFieldCount(record: StrategyRecord, fields: readonly string[]): number {
  const config = record.configuration ?? {};
  return fields.reduce(
    (count, key) => count + (configDisplay(config, key).trim() ? 1 : 0),
    0,
  );
}

export function portfolioCoverage(record: StrategyRecord): number {
  const all = [
    ...ALLOCATION_FIELDS,
    ...CAPACITY_FIELDS,
    ...SCHEDULE_FIELDS,
    'origin',
    'systemKey',
    'allocationCategory',
    'linkedObjectives',
  ];
  const unique = [...new Set(all)];
  return Math.round((filledFieldCount(record, unique) / Math.max(1, unique.length)) * 100);
}

export function dimensionGroups(records: StrategyRecord[]) {
  const groups = new Map<string, StrategyRecord[]>();
  for (const record of records.filter(isPortfolioRule)) {
    const dimension = configDisplay(record.configuration, 'dimension').trim().toLowerCase() || 'other';
    const target = targetPercentage(record);
    if (target == null) continue;
    const bucket = groups.get(dimension) ?? [];
    bucket.push(record);
    groups.set(dimension, bucket);
  }
  return groups;
}

/** Declared share-band balance from persisted targets — not measured production mix. */
export function balancedDimensionCount(records: StrategyRecord[]): {
  balanced: number;
  total: number;
  imbalanced: StrategyRecord[];
  overAllocated: StrategyRecord[];
  underCovered: StrategyRecord[];
} {
  const groups = dimensionGroups(records);
  let balanced = 0;
  const imbalanced: StrategyRecord[] = [];
  const overAllocated: StrategyRecord[] = [];
  const underCovered: StrategyRecord[] = [];

  for (const [, items] of groups) {
    const sum = items.reduce((acc, item) => acc + (targetPercentage(item) ?? 0), 0);
    const bandOk = items.every((item) => {
      const min = minAllocation(item);
      const max = maxAllocation(item);
      const target = targetPercentage(item);
      if (target == null) return false;
      if (min != null && target < min) {
        underCovered.push(item);
        return false;
      }
      if (max != null && target > max) {
        overAllocated.push(item);
        return false;
      }
      return true;
    });
    if (bandOk && sum === 100) {
      balanced += 1;
    } else {
      imbalanced.push(...items);
    }
  }

  return {
    balanced,
    total: groups.size,
    imbalanced,
    overAllocated,
    underCovered,
  };
}

export function portfolioIssues(records: StrategyRecord[]) {
  const stubs = records.filter(isPortfolioStub);
  const thinRules = records.filter(
    (record) => isPortfolioRule(record) && portfolioCoverage(record) < 40,
  );
  const nameBuckets = new Map<string, StrategyRecord[]>();
  for (const record of records) {
    const key = `${record.name.trim().toLowerCase()}::${allocationCategory(record).toLowerCase()}`;
    const bucket = nameBuckets.get(key) ?? [];
    bucket.push(record);
    nameBuckets.set(key, bucket);
  }
  const duplicates = [...nameBuckets.values()].filter((list) => list.length > 1).flat();
  const balance = balancedDimensionCount(records);
  const missingDiversity = records.filter(
    (record) =>
      isPortfolioRule(record) &&
      !configDisplay(record.configuration, 'diversityRequirement').trim(),
  );
  const missingCapacity = records.filter(
    (record) =>
      isPortfolioRule(record) && !configDisplay(record.configuration, 'capacityLimit').trim(),
  );

  return {
    stubs,
    thinRules,
    duplicates,
    imbalanced: balance.imbalanced,
    overAllocated: balance.overAllocated,
    underCovered: balance.underCovered,
    missingDiversity,
    missingCapacity,
    balance,
    issueCount:
      stubs.length +
      thinRules.length +
      duplicates.length +
      (balance.imbalanced.length ? 1 : 0) +
      balance.overAllocated.length +
      balance.underCovered.length +
      missingDiversity.length +
      missingCapacity.length,
  };
}

export function matchesPortfolioQuery(record: StrategyRecord, needle: string): boolean {
  if (!needle) return true;
  const config = record.configuration ?? {};
  const haystack = [
    record.name,
    record.status,
    record.description,
    allocationCategory(record),
    ...ALLOCATION_FIELDS.map((key) => configDisplay(config, key)),
    ...CAPACITY_FIELDS.map((key) => configDisplay(config, key)),
    ...SCHEDULE_FIELDS.map((key) => configDisplay(config, key)),
    configDisplay(config, 'systemKey'),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function sortPortfolio(records: StrategyRecord[]): StrategyRecord[] {
  return [...records].sort(
    (a, b) =>
      b.priority - a.priority ||
      allocationCategory(a).localeCompare(allocationCategory(b)) ||
      a.name.localeCompare(b.name),
  );
}

export function filterPortfolioRecords(
  records: StrategyRecord[],
  query: string,
  filter: PortfolioFilter = 'all',
): StrategyRecord[] {
  const needle = query.trim().toLowerCase();
  const issues = portfolioIssues(records);
  return sortPortfolio(
    records.filter((record) => {
      if (!matchesPortfolioQuery(record, needle)) return false;
      if (filter === 'all') return true;
      if (filter === 'domains') return allocationCategory(record) === 'domains';
      if (filter === 'audiences') return allocationCategory(record) === 'audiences';
      if (filter === 'regions') return allocationCategory(record) === 'regions';
      if (filter === 'formats') return allocationCategory(record) === 'formats';
      if (filter === 'channels') return allocationCategory(record) === 'channels';
      if (filter === 'languages') return allocationCategory(record) === 'languages';
      if (filter === 'capacity')
        return (
          allocationCategory(record) === 'production_capacity' ||
          allocationCategory(record) === 'publishing_frequency' ||
          allocationCategory(record) === 'budgets' ||
          allocationCategory(record) === 'priorities'
        );
      if (filter === 'active') return record.status === 'ACTIVE' || record.status === 'READY';
      if (filter === 'stub_only') return isPortfolioStub(record);
      if (filter === 'thin_rule') return issues.thinRules.some((item) => item.id === record.id);
      if (filter === 'imbalanced') return issues.imbalanced.some((item) => item.id === record.id);
      if (filter === 'duplicate') return issues.duplicates.some((item) => item.id === record.id);
      if (filter === 'over_allocation')
        return issues.overAllocated.some((item) => item.id === record.id);
      if (filter === 'under_coverage')
        return issues.underCovered.some((item) => item.id === record.id);
      return true;
    }),
  );
}

export function portfolioSubtitle(record: StrategyRecord): string {
  const dimension = configDisplay(record.configuration, 'dimension').trim();
  const value = configDisplay(record.configuration, 'dimensionValue').trim();
  const target = configDisplay(record.configuration, 'targetPercentage').trim();
  if (dimension && value && target) {
    return `${dimension}: ${value} · target ${target}${target === 'UNMEASURED' ? '' : '%'}`;
  }
  if (isPortfolioStub(record)) return 'Baseline portfolio stub';
  return allocationCategoryLabel(allocationCategory(record));
}
