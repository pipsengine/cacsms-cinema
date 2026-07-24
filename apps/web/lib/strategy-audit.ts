export type AuditEvent = {
  id: string;
  versionId: string | null;
  versionNumber?: number | null;
  versionStatus?: string | null;
  action: string;
  actorType: string;
  actorReference?: string | null;
  requestId?: string | null;
  correlationId?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  reason: string | null;
  createdAt: string;
};

export type AuditFilter =
  | 'all'
  | 'critical'
  | 'validation'
  | 'configuration'
  | 'versioning'
  | 'handoff'
  | 'system'
  | 'user'
  | 'failed'
  | 'missing_correlation';

export type AuditSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

const MODULE_PATTERNS: Array<{ match: RegExp; module: string }> = [
  { match: /OBJECTIVE/i, module: 'objectives' },
  { match: /DOMAIN/i, module: 'domains' },
  { match: /TAXONOMY/i, module: 'taxonomy' },
  { match: /GEOGRAPH/i, module: 'geographies' },
  { match: /AUDIENCE/i, module: 'audiences' },
  { match: /EDITORIAL/i, module: 'editorial-policy' },
  { match: /FORMAT/i, module: 'formats' },
  { match: /CHANNEL/i, module: 'channels' },
  { match: /LOCALISATION|LOCALIZATION/i, module: 'localisation' },
  { match: /SOURCE_POLICY|SOURCE/i, module: 'source-policy' },
  { match: /RISK/i, module: 'risk-policy' },
  { match: /SELECTION_THRESHOLD|THRESHOLD/i, module: 'selection-thresholds' },
  { match: /PORTFOLIO/i, module: 'portfolio' },
  { match: /VALIDAT/i, module: 'validation' },
  { match: /ACTIVAT|PACKAGE|HANDOFF|OUTBOX/i, module: 'handoff' },
  { match: /ROLLBACK|DRAFT|VERSION/i, module: 'versioning' },
  { match: /RECORD_/i, module: 'configuration' },
];

export function auditModule(action: string): string {
  for (const item of MODULE_PATTERNS) {
    if (item.match.test(action)) return item.module;
  }
  return 'strategy';
}

export function auditSeverity(action: string, reason?: string | null): AuditSeverity {
  const text = `${action} ${reason ?? ''}`.toUpperCase();
  if (
    text.includes('FAILED') ||
    text.includes('INVALID') ||
    text.includes('BLOCK') ||
    text.includes('EMERGENCY')
  ) {
    return 'CRITICAL';
  }
  if (
    text.includes('WARNING') ||
    text.includes('CANCEL') ||
    text.includes('STOP') ||
    text.includes('STUB')
  ) {
    return 'WARNING';
  }
  if (
    text.includes('ACTIVAT') ||
    text.includes('HANDOFF') ||
    text.includes('VALIDAT') ||
    text.includes('ROLLBACK')
  ) {
    return 'WARNING';
  }
  return 'INFO';
}

export function auditEventType(action: string): string {
  if (/VALIDAT/i.test(action)) return 'validation';
  if (/ACTIVAT|HANDOFF|PACKAGE/i.test(action)) return 'handoff';
  if (/ROLLBACK|DRAFT_CREATED|VERSION/i.test(action)) return 'versioning';
  if (/RECORD_|RECONCIL|AUTONOMY/i.test(action)) return 'configuration';
  return 'governance';
}

export function actorLabel(actorType: string): string {
  switch (actorType) {
    case 'SYSTEM':
      return 'System';
    case 'SERVICE':
      return 'AI Agent / Service';
    case 'DEVELOPMENT_USER':
      return 'User';
    default:
      return actorType;
  }
}

export function auditStats(events: AuditEvent[]) {
  const critical = events.filter((item) => auditSeverity(item.action, item.reason) === 'CRITICAL');
  const validation = events.filter((item) => auditEventType(item.action) === 'validation');
  const configuration = events.filter((item) => auditEventType(item.action) === 'configuration');
  const missingCorrelation = events.filter((item) => !item.correlationId && !item.requestId);
  const withDiff = events.filter((item) => item.previousValue || item.newValue);
  return {
    total: events.length,
    critical: critical.length,
    validation: validation.length,
    configuration: configuration.length,
    missingCorrelation: missingCorrelation.length,
    withDiff: withDiff.length,
  };
}

/** Qualitative compliance from persisted coverage — not a fabricated regulatory score. */
export function complianceScore(events: AuditEvent[], checksum?: string | null): number {
  if (!events.length) return 0;
  const stats = auditStats(events);
  const correlated = events.length - stats.missingCorrelation;
  const correlationShare = Math.round((correlated / events.length) * 100);
  const integrityBonus = checksum ? 10 : 0;
  return Math.min(100, Math.round(correlationShare * 0.9 + integrityBonus));
}

export function auditIssues(events: AuditEvent[]) {
  const critical = events.filter((item) => auditSeverity(item.action, item.reason) === 'CRITICAL');
  const missingCorrelation = events.filter((item) => !item.correlationId && !item.requestId);
  const failedValidation = events.filter(
    (item) => /VALIDAT/i.test(item.action) && /FAIL|INVALID/i.test(`${item.action} ${item.reason}`),
  );
  const sparseDiff = events.filter(
    (item) =>
      /RECORD_|RECONCIL|ACTIVAT|ROLLBACK/i.test(item.action) &&
      !item.newValue &&
      !item.previousValue,
  );
  return {
    critical,
    missingCorrelation,
    failedValidation,
    sparseDiff,
    issueCount:
      critical.length +
      Math.min(missingCorrelation.length, 5) +
      failedValidation.length +
      Math.min(sparseDiff.length, 3),
  };
}

export function matchesAuditQuery(event: AuditEvent, needle: string): boolean {
  if (!needle) return true;
  const haystack = [
    event.action,
    event.actorType,
    actorLabel(event.actorType),
    event.reason,
    event.requestId,
    event.correlationId,
    event.versionId,
    event.versionNumber != null ? `v${event.versionNumber}` : '',
    auditModule(event.action),
    auditEventType(event.action),
    auditSeverity(event.action, event.reason),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function filterAuditEvents(
  events: AuditEvent[],
  query: string,
  filter: AuditFilter = 'all',
): AuditEvent[] {
  const needle = query.trim().toLowerCase();
  return events.filter((event) => {
    if (!matchesAuditQuery(event, needle)) return false;
    if (filter === 'all') return true;
    if (filter === 'critical') return auditSeverity(event.action, event.reason) === 'CRITICAL';
    if (filter === 'validation') return auditEventType(event.action) === 'validation';
    if (filter === 'configuration') return auditEventType(event.action) === 'configuration';
    if (filter === 'versioning') return auditEventType(event.action) === 'versioning';
    if (filter === 'handoff') return auditEventType(event.action) === 'handoff';
    if (filter === 'system') return event.actorType === 'SYSTEM' || event.actorType === 'SERVICE';
    if (filter === 'user') return event.actorType === 'DEVELOPMENT_USER';
    if (filter === 'failed')
      return /FAIL|INVALID|BLOCK|CANCEL/i.test(`${event.action} ${event.reason ?? ''}`);
    if (filter === 'missing_correlation') return !event.correlationId && !event.requestId;
    return true;
  });
}

export function truncateJson(value?: string | null, max = 180): string {
  if (!value) return '—';
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max)}…`;
}

export function exportAuditJson(events: AuditEvent[]): string {
  return JSON.stringify(events, null, 2);
}

export function exportAuditCsv(events: AuditEvent[]): string {
  const headers = [
    'id',
    'createdAt',
    'action',
    'actorType',
    'module',
    'severity',
    'versionId',
    'versionNumber',
    'requestId',
    'correlationId',
    'reason',
  ];
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const lines = [
    headers.join(','),
    ...events.map((event) =>
      [
        event.id,
        event.createdAt,
        event.action,
        event.actorType,
        auditModule(event.action),
        auditSeverity(event.action, event.reason),
        event.versionId ?? '',
        event.versionNumber != null ? String(event.versionNumber) : '',
        event.requestId ?? '',
        event.correlationId ?? '',
        event.reason ?? '',
      ]
        .map((cell) => escape(String(cell)))
        .join(','),
    ),
  ];
  return lines.join('\n');
}

export function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
