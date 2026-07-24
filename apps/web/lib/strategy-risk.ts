import type { StrategyRecord } from '@/lib/strategy/contracts';
import { configDisplay, fieldLabel } from '@/apps/web/lib/strategy-taxonomy';

export type RiskSeverity =
  | 'CRITICAL'
  | 'HIGH'
  | 'ELEVATED'
  | 'MEDIUM'
  | 'LOW'
  | 'UNKNOWN';

export type RiskFilter =
  | 'all'
  | 'critical'
  | 'high'
  | 'elevated'
  | 'medium'
  | 'active'
  | 'stub_only'
  | 'thin_policy'
  | 'duplicate'
  | 'missing_detection'
  | 'missing_escalation'
  | 'review_required';

export { configDisplay, fieldLabel };

export const CLASSIFICATION_FIELDS = [
  'category',
  'severity',
  'likelihood',
  'fields',
  'countries',
  'audiences',
  'formats',
  'channels',
] as const;

export const DETECTION_FIELDS = [
  'detectionMethod',
  'blockingThreshold',
  'automaticAction',
] as const;

export const MITIGATION_FIELDS = [
  'escalationRequired',
  'reviewRequired',
  'remediation',
  'closureEvidence',
  'automaticAction',
] as const;

export const GOVERNANCE_FIELDS = [
  'origin',
  'systemKey',
  'riskCategory',
  'closureEvidence',
] as const;

export function isRiskStub(record: StrategyRecord): boolean {
  const key = String(record.configuration?.systemKey ?? '');
  return (
    key === 'policy.risk-policy' ||
    ((record.name === 'Risk & Sensitivity Policy' || record.name === 'Risk Policy') &&
      !key.startsWith('risk.'))
  );
}

export function isRiskPolicyRule(record: StrategyRecord): boolean {
  return String(record.configuration?.systemKey ?? '').startsWith('risk.');
}

export function riskSeverity(record: StrategyRecord): RiskSeverity {
  const value = configDisplay(record.configuration, 'severity').trim().toUpperCase();
  if (
    value === 'CRITICAL' ||
    value === 'HIGH' ||
    value === 'ELEVATED' ||
    value === 'MEDIUM' ||
    value === 'LOW'
  ) {
    return value;
  }
  return 'UNKNOWN';
}

export function riskCategory(record: StrategyRecord): string {
  return (
    configDisplay(record.configuration, 'category').trim() ||
    configDisplay(record.configuration, 'riskCategory').trim() ||
    'Uncategorised'
  );
}

export function automaticAction(record: StrategyRecord): string {
  return configDisplay(record.configuration, 'automaticAction').trim() || 'UNDECLARED';
}

export function filledFieldCount(record: StrategyRecord, fields: readonly string[]): number {
  const config = record.configuration ?? {};
  return fields.reduce(
    (count, key) => count + (configDisplay(config, key).trim() ? 1 : 0),
    0,
  );
}

export function riskCoverage(record: StrategyRecord): number {
  const all = [
    ...CLASSIFICATION_FIELDS,
    ...DETECTION_FIELDS,
    ...MITIGATION_FIELDS,
    ...GOVERNANCE_FIELDS,
  ];
  const unique = [...new Set(all)];
  return Math.round((filledFieldCount(record, unique) / Math.max(1, unique.length)) * 100);
}

export function mitigationReadiness(record: StrategyRecord): number {
  return Math.round(
    (filledFieldCount(record, MITIGATION_FIELDS) / Math.max(1, MITIGATION_FIELDS.length)) * 100,
  );
}

export function severityWeight(severity: RiskSeverity): number {
  switch (severity) {
    case 'CRITICAL':
      return 100;
    case 'HIGH':
      return 80;
    case 'ELEVATED':
      return 60;
    case 'MEDIUM':
      return 40;
    case 'LOW':
      return 20;
    default:
      return 0;
  }
}

/** Qualitative posture from declared severities — not a measured residual risk score. */
export function riskPostureLabel(records: StrategyRecord[]): string {
  const rules = records.filter(isRiskPolicyRule);
  if (!rules.length) return 'UNMEASURED';
  const max = Math.max(...rules.map((record) => severityWeight(riskSeverity(record))));
  if (max >= 100) return 'CRITICAL CONTROLS ACTIVE';
  if (max >= 80) return 'HIGH CONTROLS ACTIVE';
  if (max >= 60) return 'ELEVATED CONTROLS ACTIVE';
  return 'BASELINE CONTROLS';
}

export function riskIssues(records: StrategyRecord[]) {
  const stubs = records.filter(isRiskStub);
  const thinPolicies = records.filter(
    (record) => isRiskPolicyRule(record) && riskCoverage(record) < 40,
  );
  const nameBuckets = new Map<string, StrategyRecord[]>();
  for (const record of records) {
    const key = `${record.name.trim().toLowerCase()}::${riskCategory(record).toLowerCase()}`;
    const bucket = nameBuckets.get(key) ?? [];
    bucket.push(record);
    nameBuckets.set(key, bucket);
  }
  const duplicates = [...nameBuckets.values()].filter((list) => list.length > 1).flat();
  const missingDetection = records.filter(
    (record) =>
      isRiskPolicyRule(record) && !configDisplay(record.configuration, 'detectionMethod').trim(),
  );
  const missingEscalation = records.filter(
    (record) =>
      isRiskPolicyRule(record) && !configDisplay(record.configuration, 'escalationRequired').trim(),
  );
  const reviewRequired = records.filter((record) => {
    if (!isRiskPolicyRule(record)) return false;
    const value = configDisplay(record.configuration, 'reviewRequired').trim().toUpperCase();
    return value.startsWith('YES');
  });
  const critical = records.filter(
    (record) => isRiskPolicyRule(record) && riskSeverity(record) === 'CRITICAL',
  );
  const conflictingActions = records.filter((record) => {
    if (!isRiskPolicyRule(record)) return false;
    const action = automaticAction(record).toUpperCase();
    return action.includes('BLOCK') && action.includes('WARN') && !action.includes(';');
  });

  return {
    stubs,
    thinPolicies,
    duplicates,
    missingDetection,
    missingEscalation,
    reviewRequired,
    critical,
    conflictingActions,
    issueCount:
      stubs.length +
      thinPolicies.length +
      duplicates.length +
      missingDetection.length +
      missingEscalation.length +
      conflictingActions.length,
  };
}

export function matchesRiskQuery(record: StrategyRecord, needle: string): boolean {
  if (!needle) return true;
  const config = record.configuration ?? {};
  const haystack = [
    record.name,
    record.status,
    record.description,
    riskCategory(record),
    riskSeverity(record),
    automaticAction(record),
    ...CLASSIFICATION_FIELDS.map((key) => configDisplay(config, key)),
    ...DETECTION_FIELDS.map((key) => configDisplay(config, key)),
    ...MITIGATION_FIELDS.map((key) => configDisplay(config, key)),
    configDisplay(config, 'systemKey'),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function sortRiskPolicies(records: StrategyRecord[]): StrategyRecord[] {
  return [...records].sort(
    (a, b) =>
      severityWeight(riskSeverity(b)) - severityWeight(riskSeverity(a)) ||
      b.priority - a.priority ||
      a.name.localeCompare(b.name),
  );
}

export function filterRiskRecords(
  records: StrategyRecord[],
  query: string,
  filter: RiskFilter = 'all',
): StrategyRecord[] {
  const needle = query.trim().toLowerCase();
  const issues = riskIssues(records);
  return sortRiskPolicies(
    records.filter((record) => {
      if (!matchesRiskQuery(record, needle)) return false;
      if (filter === 'all') return true;
      if (filter === 'critical') return riskSeverity(record) === 'CRITICAL';
      if (filter === 'high') return riskSeverity(record) === 'HIGH';
      if (filter === 'elevated') return riskSeverity(record) === 'ELEVATED';
      if (filter === 'medium') return riskSeverity(record) === 'MEDIUM';
      if (filter === 'active') return record.status === 'ACTIVE' || record.status === 'READY';
      if (filter === 'stub_only') return isRiskStub(record);
      if (filter === 'thin_policy') return issues.thinPolicies.some((item) => item.id === record.id);
      if (filter === 'duplicate') return issues.duplicates.some((item) => item.id === record.id);
      if (filter === 'missing_detection')
        return issues.missingDetection.some((item) => item.id === record.id);
      if (filter === 'missing_escalation')
        return issues.missingEscalation.some((item) => item.id === record.id);
      if (filter === 'review_required')
        return issues.reviewRequired.some((item) => item.id === record.id);
      return true;
    }),
  );
}

export function riskSubtitle(record: StrategyRecord): string {
  const parts = [riskCategory(record), riskSeverity(record), record.status].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  if (isRiskStub(record)) return 'Baseline risk stub';
  return 'Risk policy';
}
