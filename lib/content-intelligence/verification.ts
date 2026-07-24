import { prisma } from '@/lib/db';

export type EvidenceVerificationRecord = {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  opportunityStatus: string;
  domain: string;
  claim: string;
  ruleCode: string;
  ruleVersion: number;
  status: string;
  severity: string;
  blocking: boolean;
  summary: string | null;
  sourceName: string | null;
  sourceId: string | null;
  authority: number | null;
  recencyHours: number | null;
  corroborationCount: number | null;
  confidence: number | null;
  measuredConfidence: boolean;
  trustScore: number | null;
  citations: string[];
  conflicts: string[];
  category: string | null;
  nextStage: string;
  checkedAt: string;
  evidenceJson: Record<string, unknown>;
};

export type EvidenceVerificationIssue = {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  code: string;
  message: string;
  evidenceId?: string;
};

export type EvidenceVerificationOverview = {
  available: boolean;
  reason?: string;
  strategy?: {
    versionId: string;
    versionNumber: number;
    checksum: string;
    status: string;
  };
  run?: {
    id: string;
    status: string;
    startedAt: string;
    completedAt?: string | null;
    failureReason?: string | null;
  };
  metrics: {
    evidence: number;
    verified: number;
    pending: number;
    failed: number;
    measuredConfidence: number;
    avgConfidence: number | null;
    measuredTrust: number;
    avgSourceTrust: number | null;
    blockingFailures: number;
    conflicts: number;
  };
  records: EvidenceVerificationRecord[];
  sources: Array<{
    sourceId: string | null;
    sourceName: string;
    verificationCount: number;
    passed: number;
    failed: number;
    avgAuthority: number | null;
  }>;
  issues: EvidenceVerificationIssue[];
  audit: Array<{
    id: string;
    action: string;
    actorType: string;
    createdAt: string;
    reason: string | null;
  }>;
  lastUpdated: string;
};

type PackageRow = {
  strategy_version_id: string;
  version_number: number;
  checksum: string;
  status: string;
};

type VerificationRow = {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  opportunityStatus: string;
  domain: string;
  opportunitySummary: string;
  opportunityConfidence: number | string;
  ruleCode: string;
  ruleVersion: number;
  status: string;
  severity: string;
  blocking: boolean | number;
  evidenceJson: string | null;
  checkedAt: Date;
};

function parseJson(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(value: unknown): string | null {
  if (value == null || value === '') return null;
  return String(value);
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[;|]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function isPassed(status: string) {
  const s = status.toUpperCase();
  return s === 'PASSED' || s === 'VERIFIED' || s === 'ACCEPTED' || s === 'APPROVED';
}

function isFailed(status: string) {
  const s = status.toUpperCase();
  return s === 'FAILED' || s === 'REJECTED' || s === 'BLOCKED';
}

function isPending(status: string) {
  const s = status.toUpperCase();
  return s === 'PENDING' || s === 'QUEUED' || s === 'RUNNING' || s === 'IN_PROGRESS';
}

function nextStageFor(status: string, opportunityStatus: string): string {
  if (isFailed(status)) return 'Recovery / re-verification';
  if (isPending(status)) return 'Awaiting corroboration';
  if (isPassed(status)) {
    if (opportunityStatus === 'HANDED_OFF' || opportunityStatus === 'QUALIFIED') {
      return 'Stage 03 – Idea Qualification';
    }
    return 'Ready for scoring / qualification handoff';
  }
  return 'Under review';
}

function deriveIssues(records: EvidenceVerificationRecord[]): EvidenceVerificationIssue[] {
  const issues: EvidenceVerificationIssue[] = [];
  const byClaim = new Map<string, string[]>();

  for (const item of records) {
    const key = item.claim.trim().toLowerCase();
    const list = byClaim.get(key) ?? [];
    list.push(item.id);
    byClaim.set(key, list);

    if (isFailed(item.status)) {
      issues.push({
        id: `${item.id}-failed`,
        severity: item.blocking ? 'CRITICAL' : 'WARNING',
        code: 'VERIFICATION_FAILED',
        message: `Verification failed for “${item.opportunityTitle}” (${item.ruleCode}).`,
        evidenceId: item.id,
      });
    }
    if (item.conflicts.length > 0) {
      issues.push({
        id: `${item.id}-conflict`,
        severity: 'WARNING',
        code: 'CONTRADICTION',
        message: `Conflicts recorded on “${item.opportunityTitle}”: ${item.conflicts.slice(0, 2).join('; ')}`,
        evidenceId: item.id,
      });
    }
    if (!item.measuredConfidence || (item.confidence ?? 0) < 40) {
      issues.push({
        id: `${item.id}-conf`,
        severity: 'WARNING',
        code: 'LOW_CONFIDENCE',
        message: `Low or unmeasured confidence on “${item.opportunityTitle}”.`,
        evidenceId: item.id,
      });
    }
    if (!item.sourceName && !item.sourceId) {
      issues.push({
        id: `${item.id}-source`,
        severity: 'INFO',
        code: 'MISSING_SOURCE',
        message: `No source attribution on verification “${item.ruleCode}”.`,
        evidenceId: item.id,
      });
    }
  }

  for (const [claim, ids] of byClaim) {
    if (ids.length > 1) {
      issues.push({
        id: `dup-${claim.slice(0, 40)}`,
        severity: 'INFO',
        code: 'DUPLICATE_EVIDENCE',
        message: `${ids.length} verification rows share the same claim text.`,
        evidenceId: ids[0],
      });
    }
  }

  return issues.slice(0, 40);
}

export async function loadEvidenceVerification(): Promise<EvidenceVerificationOverview> {
  try {
    const packages = await prisma.$queryRaw<PackageRow[]>`
      SELECT TOP 1
        CONVERT(varchar(36), strategy_version_id) AS strategy_version_id,
        version_number,
        checksum,
        status
      FROM ci_strategy_packages
      WHERE status = 'ACKNOWLEDGED'
      ORDER BY acknowledged_at DESC
    `;

    const runs = await prisma.$queryRaw<
      Array<{
        id: string;
        status: string;
        started_at: Date | null;
        completed_at: Date | null;
        failure_reason: string | null;
      }>
    >`
      SELECT TOP 1
        CONVERT(varchar(36), id) AS id,
        status,
        started_at,
        completed_at,
        failure_reason
      FROM ci_discovery_runs
      ORDER BY created_at DESC
    `;

    const rows = await prisma.$queryRaw<VerificationRow[]>`
      SELECT TOP 200
        CONVERT(varchar(36), v.id) AS id,
        CONVERT(varchar(36), v.opportunity_id) AS opportunityId,
        o.title AS opportunityTitle,
        o.status AS opportunityStatus,
        o.domain,
        o.summary AS opportunitySummary,
        o.confidence AS opportunityConfidence,
        v.rule_code AS ruleCode,
        v.rule_version AS ruleVersion,
        v.status,
        v.severity,
        v.blocking,
        v.evidence_json AS evidenceJson,
        v.checked_at AS checkedAt
      FROM ci_verifications v
      INNER JOIN ci_opportunities o ON o.id = v.opportunity_id
      ORDER BY v.checked_at DESC
    `;

    const auditRows = await prisma.$queryRaw<
      Array<{
        id: string;
        action: string;
        actorType: string;
        createdAt: Date;
        reason: string | null;
      }>
    >`
      SELECT TOP 24
        CONVERT(varchar(36), id) AS id,
        action,
        actor_type AS actorType,
        created_at AS createdAt,
        reason
      FROM ci_audit_events
      WHERE action LIKE 'DISCOVERY%'
         OR action LIKE 'STRATEGY_PACKAGE%'
         OR action LIKE '%VERIF%'
         OR action LIKE '%EVIDENCE%'
         OR opportunity_id IS NOT NULL
      ORDER BY created_at DESC
    `;

    const records: EvidenceVerificationRecord[] = rows.map((row) => {
      const evidence = parseJson(row.evidenceJson);
      const opportunityConfidence = Number(row.opportunityConfidence);
      const confidence =
        numOrNull(evidence.confidence ?? evidence.confidenceScore) ??
        (Number.isFinite(opportunityConfidence) && opportunityConfidence >= 1
          ? opportunityConfidence
          : null);
      const measuredConfidence = confidence != null && confidence >= 1;
      const trustScore = numOrNull(
        evidence.trustScore ?? evidence.sourceTrust ?? evidence.authorityScore,
      );
      const authority = numOrNull(evidence.authority ?? evidence.authorityScore ?? trustScore);
      const recencyHours = numOrNull(evidence.recencyHours ?? evidence.ageHours ?? evidence.recency);
      const corroborationCount = numOrNull(
        evidence.corroborationCount ?? evidence.corroboration ?? evidence.sourcesCount,
      );

      return {
        id: row.id,
        opportunityId: row.opportunityId,
        opportunityTitle: row.opportunityTitle,
        opportunityStatus: row.opportunityStatus,
        domain: row.domain,
        claim:
          strOrNull(evidence.claim ?? evidence.statement ?? evidence.assertion) ??
          row.opportunitySummary,
        ruleCode: row.ruleCode,
        ruleVersion: Number(row.ruleVersion),
        status: row.status,
        severity: row.severity,
        blocking: Boolean(row.blocking),
        summary: strOrNull(evidence.summary ?? evidence.explanation ?? evidence.notes),
        sourceName: strOrNull(evidence.sourceName ?? evidence.source ?? evidence.publisher),
        sourceId: strOrNull(evidence.sourceId),
        authority,
        recencyHours,
        corroborationCount,
        confidence,
        measuredConfidence,
        trustScore,
        citations: stringList(evidence.citations ?? evidence.citationUrls ?? evidence.references),
        conflicts: stringList(evidence.conflicts ?? evidence.contradictions ?? evidence.conflictsWith),
        category: strOrNull(evidence.category ?? row.domain ?? row.ruleCode),
        nextStage: nextStageFor(row.status, row.opportunityStatus),
        checkedAt: row.checkedAt.toISOString(),
        evidenceJson: evidence,
      };
    });

    const sourceMap = new Map<
      string,
      {
        sourceId: string | null;
        sourceName: string;
        verificationCount: number;
        passed: number;
        failed: number;
        authorities: number[];
      }
    >();

    for (const item of records) {
      const name = item.sourceName?.trim() || 'Unspecified source';
      const key = `${item.sourceId ?? ''}|${name}`;
      const entry = sourceMap.get(key) ?? {
        sourceId: item.sourceId,
        sourceName: name,
        verificationCount: 0,
        passed: 0,
        failed: 0,
        authorities: [],
      };
      entry.verificationCount += 1;
      if (isPassed(item.status)) entry.passed += 1;
      if (isFailed(item.status)) entry.failed += 1;
      if (item.authority != null) entry.authorities.push(item.authority);
      sourceMap.set(key, entry);
    }

    const sources = [...sourceMap.values()]
      .map((entry) => ({
        sourceId: entry.sourceId,
        sourceName: entry.sourceName,
        verificationCount: entry.verificationCount,
        passed: entry.passed,
        failed: entry.failed,
        avgAuthority:
          entry.authorities.length > 0
            ? Math.round(
                entry.authorities.reduce((sum, n) => sum + n, 0) / entry.authorities.length,
              )
            : null,
      }))
      .sort((a, b) => b.verificationCount - a.verificationCount);

    const verified = records.filter((item) => isPassed(item.status)).length;
    const failed = records.filter((item) => isFailed(item.status)).length;
    const pending = records.filter((item) => isPending(item.status)).length;

    const confidenceValues = records
      .filter((item) => item.measuredConfidence && item.confidence != null)
      .map((item) => item.confidence as number);
    const avgConfidence =
      confidenceValues.length > 0
        ? Math.round(confidenceValues.reduce((sum, n) => sum + n, 0) / confidenceValues.length)
        : null;

    const trustValues = records
      .map((item) => item.trustScore ?? item.authority)
      .filter((value): value is number => value != null);
    const avgSourceTrust =
      trustValues.length > 0
        ? Math.round(trustValues.reduce((sum, n) => sum + n, 0) / trustValues.length)
        : null;

    const blockingFailures = records.filter(
      (item) => isFailed(item.status) && item.blocking,
    ).length;
    const conflicts = records.filter((item) => item.conflicts.length > 0).length;

    const packageRow = packages[0];
    const run = runs[0];

    return {
      available: true,
      strategy: packageRow
        ? {
            versionId: packageRow.strategy_version_id,
            versionNumber: Number(packageRow.version_number),
            checksum: packageRow.checksum,
            status: packageRow.status,
          }
        : undefined,
      run: run
        ? {
            id: run.id,
            status: run.status,
            startedAt: run.started_at?.toISOString() ?? new Date(0).toISOString(),
            completedAt: run.completed_at?.toISOString() ?? null,
            failureReason: run.failure_reason,
          }
        : undefined,
      metrics: {
        evidence: records.length,
        verified,
        pending,
        failed,
        measuredConfidence: confidenceValues.length,
        avgConfidence,
        measuredTrust: trustValues.length,
        avgSourceTrust,
        blockingFailures,
        conflicts,
      },
      records,
      sources,
      issues: deriveIssues(records),
      audit: auditRows.map((row) => ({
        id: row.id,
        action: row.action,
        actorType: row.actorType,
        createdAt: row.createdAt.toISOString(),
        reason: row.reason,
      })),
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    return {
      available: false,
      reason:
        error instanceof Error
          ? error.message.replace(/password|secret|token/gi, '[redacted]')
          : 'Evidence verification unavailable. Run the Content Intelligence migration.',
      metrics: {
        evidence: 0,
        verified: 0,
        pending: 0,
        failed: 0,
        measuredConfidence: 0,
        avgConfidence: null,
        measuredTrust: 0,
        avgSourceTrust: null,
        blockingFailures: 0,
        conflicts: 0,
      },
      records: [],
      sources: [],
      issues: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
