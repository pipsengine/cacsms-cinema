import { prisma } from '@/lib/db';

export type GapSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
export type GapStatus =
  | 'OPEN'
  | 'ANALYSING'
  | 'VALIDATED'
  | 'RECOMMENDED'
  | 'HANDED_OFF'
  | 'ARCHIVED'
  | 'UNKNOWN';

export type KnowledgeGapRecord = {
  id: string;
  topic: string;
  summary: string;
  signalType: string;
  domain: string | null;
  audience: string | null;
  geography: string | null;
  language: string | null;
  missingKnowledge: string | null;
  evidenceCoverage: number | null;
  demandScore: number | null;
  strategicImportance: number | null;
  businessImpact: string | null;
  confidence: number;
  measuredConfidence: boolean;
  severity: GapSeverity;
  status: GapStatus;
  priority: number | null;
  competitorsCovering: string[];
  recommendedActions: string[];
  supportingEvidence: string[];
  opportunityCount: number;
  sourceId: string | null;
  sourceName: string | null;
  evidenceUrl: string | null;
  freshnessHours: number | null;
  runId: string;
  runStatus: string | null;
  observedAt: string | null;
  createdAt: string;
  fingerprint: string;
};

export type KnowledgeGapIssue = {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  code: string;
  message: string;
  gapId?: string;
};

export type KnowledgeGapsOverview = {
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
    knowledgeGaps: number;
    criticalGaps: number;
    coverageScore: number;
    opportunityScore: number;
    measuredConfidence: number;
    avgConfidence: number | null;
    researchReadiness: number;
    weakCoverage: number;
    staleKnowledge: number;
    duplicateGaps: number;
    missingEvidence: number;
  };
  gaps: KnowledgeGapRecord[];
  coverageMatrix: Array<{
    domain: string;
    gapCount: number;
    avgCoverage: number | null;
    critical: number;
  }>;
  issues: KnowledgeGapIssue[];
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

type SignalRow = {
  id: string;
  runId: string;
  runStatus: string | null;
  sourceId: string | null;
  sourceName: string | null;
  signalType: string;
  subject: string;
  summary: string;
  evidenceUrl: string | null;
  observedAt: Date | null;
  confidence: number | string;
  fingerprint: string;
  rawMetadataJson: string | null;
  createdAt: Date;
  opportunityCount: number | bigint;
};

function parseMeta(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
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

function freshnessHours(observedAt: Date | null, createdAt: Date): number {
  const anchor = observedAt ?? createdAt;
  return Math.max(0, Math.round((Date.now() - anchor.getTime()) / (1000 * 60 * 60)));
}

function deriveSeverity(
  meta: Record<string, unknown>,
  confidence: number,
  measured: boolean,
  coverage: number | null,
  importance: number | null,
): GapSeverity {
  const raw = (strOrNull(meta.severity ?? meta.gapSeverity) ?? '').toUpperCase();
  if (raw === 'CRITICAL' || raw === 'HIGH' || raw === 'MEDIUM' || raw === 'LOW') {
    return raw as GapSeverity;
  }
  if (importance != null && importance >= 85) return 'CRITICAL';
  if (coverage != null && coverage < 20) return 'CRITICAL';
  if (importance != null && importance >= 65) return 'HIGH';
  if (coverage != null && coverage < 45) return 'HIGH';
  if (!measured || confidence < 40) return 'MEDIUM';
  if (coverage != null && coverage < 70) return 'MEDIUM';
  return 'LOW';
}

function deriveStatus(meta: Record<string, unknown>, opportunityCount: number): GapStatus {
  const raw = (strOrNull(meta.status ?? meta.gapStatus) ?? '').toUpperCase();
  const allowed: GapStatus[] = [
    'OPEN',
    'ANALYSING',
    'VALIDATED',
    'RECOMMENDED',
    'HANDED_OFF',
    'ARCHIVED',
  ];
  if (allowed.includes(raw as GapStatus)) return raw as GapStatus;
  if (opportunityCount > 0) return 'RECOMMENDED';
  return 'OPEN';
}

function deriveIssues(gaps: KnowledgeGapRecord[]): KnowledgeGapIssue[] {
  const issues: KnowledgeGapIssue[] = [];
  const byTopic = new Map<string, string[]>();

  for (const gap of gaps) {
    const key = gap.topic.trim().toLowerCase();
    const list = byTopic.get(key) ?? [];
    list.push(gap.id);
    byTopic.set(key, list);

    if (gap.evidenceCoverage == null || gap.evidenceCoverage < 40) {
      issues.push({
        id: `${gap.id}-weak-cov`,
        severity: gap.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        code: 'WEAK_COVERAGE',
        message: `Weak or unmeasured evidence coverage on “${gap.topic}”.`,
        gapId: gap.id,
      });
    }
    if (!gap.evidenceUrl && !gap.sourceId) {
      issues.push({
        id: `${gap.id}-missing`,
        severity: 'WARNING',
        code: 'MISSING_EVIDENCE',
        message: `Gap “${gap.topic}” has no linked source or evidence URL.`,
        gapId: gap.id,
      });
    }
    if ((gap.freshnessHours ?? 0) > 24 * 45) {
      issues.push({
        id: `${gap.id}-stale`,
        severity: 'WARNING',
        code: 'STALE_KNOWLEDGE',
        message: `Gap “${gap.topic}” has not been refreshed for ${gap.freshnessHours}h.`,
        gapId: gap.id,
      });
    }
    if (gap.severity === 'CRITICAL') {
      issues.push({
        id: `${gap.id}-critical`,
        severity: 'CRITICAL',
        code: 'CRITICAL_GAP',
        message: `Critical knowledge gap: “${gap.topic}”.`,
        gapId: gap.id,
      });
    }
  }

  for (const [topic, ids] of byTopic) {
    if (ids.length > 1) {
      issues.push({
        id: `dup-${topic.slice(0, 40)}`,
        severity: 'WARNING',
        code: 'DUPLICATE_GAP',
        message: `${ids.length} gap signals share topic “${topic}”.`,
        gapId: ids[0],
      });
    }
  }

  return issues.slice(0, 40);
}

export async function loadKnowledgeGaps(): Promise<KnowledgeGapsOverview> {
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

    const rows = await prisma.$queryRaw<SignalRow[]>`
      SELECT TOP 200
        CONVERT(varchar(36), s.id) AS id,
        CONVERT(varchar(36), s.run_id) AS runId,
        r.status AS runStatus,
        CONVERT(varchar(36), s.source_id) AS sourceId,
        src.name AS sourceName,
        s.signal_type AS signalType,
        s.subject,
        s.summary,
        s.evidence_url AS evidenceUrl,
        s.observed_at AS observedAt,
        s.confidence,
        s.fingerprint,
        s.raw_metadata_json AS rawMetadataJson,
        s.created_at AS createdAt,
        (
          SELECT COUNT(*)
          FROM ci_opportunity_signals os
          WHERE os.signal_id = s.id
        ) AS opportunityCount
      FROM ci_signals s
      LEFT JOIN ci_discovery_runs r ON r.id = s.run_id
      LEFT JOIN ci_sources src ON src.id = s.source_id
      WHERE s.signal_type IN ('KNOWLEDGE_GAP', 'SEARCH_GAP')
      ORDER BY s.created_at DESC
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
         OR action LIKE '%GAP%'
         OR action LIKE '%SIGNAL%'
      ORDER BY created_at DESC
    `;

    const gaps: KnowledgeGapRecord[] = rows.map((row) => {
      const meta = parseMeta(row.rawMetadataJson);
      const confidence = Number(row.confidence);
      const measuredConfidence = Number.isFinite(confidence) && confidence >= 1;
      const evidenceCoverage = numOrNull(
        meta.evidenceCoverage ?? meta.coverageScore ?? meta.coverage,
      );
      const strategicImportance = numOrNull(
        meta.strategicImportance ?? meta.strategic_importance ?? meta.importance,
      );
      const opportunityCount = Number(row.opportunityCount ?? 0);
      const fresh = freshnessHours(row.observedAt, row.createdAt);

      return {
        id: row.id,
        topic: row.subject,
        summary: row.summary,
        signalType: row.signalType,
        domain: strOrNull(meta.domain ?? meta.category ?? meta.field),
        audience: strOrNull(meta.audience ?? meta.segment),
        geography: strOrNull(meta.geography ?? meta.region ?? meta.country),
        language: strOrNull(meta.language ?? meta.languageCode ?? meta.locale),
        missingKnowledge: strOrNull(
          meta.missingKnowledge ?? meta.missing_knowledge ?? meta.blindSpot ?? row.summary,
        ),
        evidenceCoverage,
        demandScore: numOrNull(meta.demandScore ?? meta.demand_score),
        strategicImportance,
        businessImpact: strOrNull(meta.businessImpact ?? meta.impact),
        confidence,
        measuredConfidence,
        severity: deriveSeverity(
          meta,
          confidence,
          measuredConfidence,
          evidenceCoverage,
          strategicImportance,
        ),
        status: deriveStatus(meta, opportunityCount),
        priority: numOrNull(meta.priority),
        competitorsCovering: stringList(
          meta.competitorsCovering ?? meta.competitors ?? meta.competitorCoverage,
        ),
        recommendedActions: stringList(
          meta.recommendedActions ?? meta.recommendations ?? meta.actions,
        ),
        supportingEvidence: stringList(meta.supportingEvidence ?? meta.evidence),
        opportunityCount,
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        evidenceUrl: row.evidenceUrl,
        freshnessHours: fresh,
        runId: row.runId,
        runStatus: row.runStatus,
        observedAt: row.observedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        fingerprint: row.fingerprint,
      };
    });

    const domainMap = new Map<
      string,
      { gapCount: number; coverages: number[]; critical: number }
    >();
    for (const gap of gaps) {
      const domain = gap.domain?.trim() || 'Unspecified domain';
      const entry = domainMap.get(domain) ?? { gapCount: 0, coverages: [], critical: 0 };
      entry.gapCount += 1;
      if (gap.evidenceCoverage != null) entry.coverages.push(gap.evidenceCoverage);
      if (gap.severity === 'CRITICAL') entry.critical += 1;
      domainMap.set(domain, entry);
    }

    const coverageMatrix = [...domainMap.entries()]
      .map(([domain, value]) => ({
        domain,
        gapCount: value.gapCount,
        avgCoverage:
          value.coverages.length > 0
            ? Math.round(
                value.coverages.reduce((sum, n) => sum + n, 0) / value.coverages.length,
              )
            : null,
        critical: value.critical,
      }))
      .sort((a, b) => b.gapCount - a.gapCount);

    const criticalGaps = gaps.filter((item) => item.severity === 'CRITICAL').length;
    const measured = gaps.filter((item) => item.measuredConfidence);
    const avgConfidence =
      measured.length > 0
        ? Math.round(measured.reduce((sum, item) => sum + item.confidence, 0) / measured.length)
        : null;

    const withCoverage = gaps.filter((item) => item.evidenceCoverage != null);
    const coverageScore =
      withCoverage.length === 0
        ? 0
        : Math.round(
            withCoverage.reduce((sum, item) => sum + (item.evidenceCoverage ?? 0), 0) /
              withCoverage.length,
          );

    const withOpportunities = gaps.filter((item) => item.opportunityCount > 0).length;
    const opportunityScore =
      gaps.length === 0 ? 0 : Math.round((withOpportunities / gaps.length) * 100);

    const validatedOrBetter = gaps.filter((item) =>
      ['VALIDATED', 'RECOMMENDED', 'HANDED_OFF'].includes(item.status),
    ).length;
    const researchReadiness =
      gaps.length === 0
        ? 0
        : Math.round(
            ((validatedOrBetter + withOpportunities) / Math.max(1, gaps.length * 2)) * 100,
          );

    const weakCoverage = gaps.filter(
      (item) => item.evidenceCoverage == null || item.evidenceCoverage < 40,
    ).length;
    const staleKnowledge = gaps.filter((item) => (item.freshnessHours ?? 0) > 24 * 45).length;
    const missingEvidence = gaps.filter((item) => !item.evidenceUrl && !item.sourceId).length;

    const topicCounts = new Map<string, number>();
    for (const gap of gaps) {
      const key = gap.topic.trim().toLowerCase();
      topicCounts.set(key, (topicCounts.get(key) ?? 0) + 1);
    }
    const duplicateGaps = [...topicCounts.values()].filter((count) => count > 1).length;

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
        knowledgeGaps: gaps.length,
        criticalGaps,
        coverageScore,
        opportunityScore,
        measuredConfidence: measured.length,
        avgConfidence,
        researchReadiness,
        weakCoverage,
        staleKnowledge,
        duplicateGaps,
        missingEvidence,
      },
      gaps,
      coverageMatrix,
      issues: deriveIssues(gaps),
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
          : 'Knowledge gaps unavailable. Run the Content Intelligence migration.',
      metrics: {
        knowledgeGaps: 0,
        criticalGaps: 0,
        coverageScore: 0,
        opportunityScore: 0,
        measuredConfidence: 0,
        avgConfidence: null,
        researchReadiness: 0,
        weakCoverage: 0,
        staleKnowledge: 0,
        duplicateGaps: 0,
        missingEvidence: 0,
      },
      gaps: [],
      coverageMatrix: [],
      issues: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
