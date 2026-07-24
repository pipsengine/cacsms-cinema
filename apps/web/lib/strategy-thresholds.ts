import type { StrategyRecord } from '@/lib/strategy/contracts';
import { configDisplay, fieldLabel } from '@/apps/web/lib/strategy-taxonomy';

export type ThresholdFilter =
  | 'all'
  | 'mandatory'
  | 'optional'
  | 'active'
  | 'stub_only'
  | 'thin_rule'
  | 'duplicate'
  | 'missing_decision'
  | 'missing_audit'
  | 'reject'
  | 'review'
  | 'escalate';

export { configDisplay, fieldLabel };

export const RULE_CORE_FIELDS = [
  'metric',
  'operator',
  'value',
  'scopeType',
  'scopeId',
  'mandatory',
] as const;

export const DECISION_FIELDS = [
  'decisionAction',
  'escalationAction',
  'overrideAllowed',
  'auditRequired',
] as const;

export const GOVERNANCE_FIELDS = [
  'origin',
  'systemKey',
  'ruleCategory',
  'linkedSections',
  'effectiveFromNote',
  'effectiveToNote',
] as const;

export function isThresholdStub(record: StrategyRecord): boolean {
  const key = String(record.configuration?.systemKey ?? '');
  return (
    key === 'policy.selection-thresholds' ||
    ((record.name === 'Autonomous Selection Thresholds' ||
      record.name === 'Selection Thresholds') &&
      !key.startsWith('thr.'))
  );
}

export function isThresholdRule(record: StrategyRecord): boolean {
  return String(record.configuration?.systemKey ?? '').startsWith('thr.');
}

export function ruleCategory(record: StrategyRecord): string {
  return (
    configDisplay(record.configuration, 'ruleCategory').trim() ||
    configDisplay(record.configuration, 'metric').trim() ||
    'uncategorised'
  );
}

export function ruleCategoryLabel(value: string): string {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function decisionAction(record: StrategyRecord): string {
  return configDisplay(record.configuration, 'decisionAction').trim().toUpperCase() || 'UNDECLARED';
}

export function isMandatory(record: StrategyRecord): boolean {
  const value = configDisplay(record.configuration, 'mandatory').trim().toUpperCase();
  return value === 'YES' || value.startsWith('YES');
}

export function filledFieldCount(record: StrategyRecord, fields: readonly string[]): number {
  const config = record.configuration ?? {};
  return fields.reduce(
    (count, key) => count + (configDisplay(config, key).trim() ? 1 : 0),
    0,
  );
}

export function thresholdCoverage(record: StrategyRecord): number {
  const all = [...RULE_CORE_FIELDS, ...DECISION_FIELDS, ...GOVERNANCE_FIELDS];
  const unique = [...new Set(all)];
  return Math.round((filledFieldCount(record, unique) / Math.max(1, unique.length)) * 100);
}

export function thresholdIssues(records: StrategyRecord[]) {
  const stubs = records.filter(isThresholdStub);
  const thinRules = records.filter(
    (record) => isThresholdRule(record) && thresholdCoverage(record) < 40,
  );
  const nameBuckets = new Map<string, StrategyRecord[]>();
  for (const record of records) {
    const key = `${record.name.trim().toLowerCase()}::${ruleCategory(record).toLowerCase()}`;
    const bucket = nameBuckets.get(key) ?? [];
    bucket.push(record);
    nameBuckets.set(key, bucket);
  }
  const duplicates = [...nameBuckets.values()].filter((list) => list.length > 1).flat();

  const metricBuckets = new Map<string, StrategyRecord[]>();
  for (const record of records.filter(isThresholdRule)) {
    const metric = configDisplay(record.configuration, 'metric').trim().toLowerCase();
    const scope = `${configDisplay(record.configuration, 'scopeType')}:${configDisplay(record.configuration, 'scopeId')}`
      .trim()
      .toLowerCase();
    const key = `${metric}::${scope}`;
    const bucket = metricBuckets.get(key) ?? [];
    bucket.push(record);
    metricBuckets.set(key, bucket);
  }
  const conflicting = [...metricBuckets.values()]
    .filter((list) => list.length > 1)
    .flat()
    .filter((record, index, all) => {
      const actions = new Set(all.map((item) => decisionAction(item)));
      return actions.size > 1 && all.some((item) => item.id === record.id);
    });

  const missingDecision = records.filter(
    (record) => isThresholdRule(record) && decisionAction(record) === 'UNDECLARED',
  );
  const missingAudit = records.filter(
    (record) =>
      isThresholdRule(record) && !configDisplay(record.configuration, 'auditRequired').trim(),
  );

  return {
    stubs,
    thinRules,
    duplicates,
    conflicting,
    missingDecision,
    missingAudit,
    issueCount:
      stubs.length +
      thinRules.length +
      duplicates.length +
      conflicting.length +
      missingDecision.length +
      missingAudit.length,
  };
}

export function matchesThresholdQuery(record: StrategyRecord, needle: string): boolean {
  if (!needle) return true;
  const config = record.configuration ?? {};
  const haystack = [
    record.name,
    record.status,
    record.description,
    ruleCategory(record),
    decisionAction(record),
    ...RULE_CORE_FIELDS.map((key) => configDisplay(config, key)),
    ...DECISION_FIELDS.map((key) => configDisplay(config, key)),
    configDisplay(config, 'systemKey'),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function sortThresholds(records: StrategyRecord[]): StrategyRecord[] {
  return [...records].sort(
    (a, b) =>
      Number(isMandatory(b)) - Number(isMandatory(a)) ||
      b.priority - a.priority ||
      a.name.localeCompare(b.name),
  );
}

export function filterThresholdRecords(
  records: StrategyRecord[],
  query: string,
  filter: ThresholdFilter = 'all',
): StrategyRecord[] {
  const needle = query.trim().toLowerCase();
  const issues = thresholdIssues(records);
  return sortThresholds(
    records.filter((record) => {
      if (!matchesThresholdQuery(record, needle)) return false;
      if (filter === 'all') return true;
      if (filter === 'mandatory') return isMandatory(record);
      if (filter === 'optional') return !isMandatory(record);
      if (filter === 'active') return record.status === 'ACTIVE' || record.status === 'READY';
      if (filter === 'stub_only') return isThresholdStub(record);
      if (filter === 'thin_rule') return issues.thinRules.some((item) => item.id === record.id);
      if (filter === 'duplicate') return issues.duplicates.some((item) => item.id === record.id);
      if (filter === 'missing_decision')
        return issues.missingDecision.some((item) => item.id === record.id);
      if (filter === 'missing_audit')
        return issues.missingAudit.some((item) => item.id === record.id);
      if (filter === 'reject') return decisionAction(record) === 'REJECT';
      if (filter === 'review') return decisionAction(record) === 'REVIEW';
      if (filter === 'escalate')
        return decisionAction(record) === 'ESCALATE' || decisionAction(record) === 'HOLD';
      return true;
    }),
  );
}

export function thresholdSubtitle(record: StrategyRecord): string {
  const metric = configDisplay(record.configuration, 'metric').trim();
  const operator = configDisplay(record.configuration, 'operator').trim();
  const value = configDisplay(record.configuration, 'value').trim();
  if (metric && operator && value) return `${metric} ${operator} ${value}`;
  if (isThresholdStub(record)) return 'Baseline threshold stub';
  return ruleCategoryLabel(ruleCategory(record));
}

export function thresholdExpression(record: StrategyRecord): string {
  return thresholdSubtitle(record);
}
