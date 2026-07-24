import { prisma } from '@/lib/db';

export type CompetitorStatus = 'ACTIVE' | 'MONITORING' | 'WARNING' | 'ARCHIVED' | 'UNKNOWN';

export type CompetitorRecord = {
  id: string;
  name: string;
  summary: string;
  platform: string | null;
  region: string | null;
  niche: string | null;
  status: CompetitorStatus;
  publishingFrequency: string | null;
  contentCategories: string[];
  engagement: number | null;
  seoVisibility: number | null;
  audienceOverlap: number | null;
  trendAdoption: number | null;
  coverageScore: number | null;
  threatScore: number | null;
  benchmarkScore: number | null;
  similarityScore: number | null;
  strengths: string[];
  weaknesses: string[];
  whitespaceOpportunities: string[];
  recommendations: string[];
  confidence: number;
  measuredConfidence: boolean;
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

export type CompetitorIssue = {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  code: string;
  message: string;
  competitorId?: string;
};

export type CompetitorIntelligenceOverview = {
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
    competitors: number;
    monitoredSources: number;
    coverage: number | null;
    measuredCoverage: number;
    gaps: number;
    threatScore: number | null;
    measuredThreat: number;
    opportunities: number;
    warningCount: number;
    highThreat: number;
  };
  competitors: CompetitorRecord[];
  issues: CompetitorIssue[];
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

function deriveStatus(
  meta: Record<string, unknown>,
  threatScore: number | null,
  freshness: number,
): CompetitorStatus {
  const raw = (strOrNull(meta.status ?? meta.competitorStatus) ?? '').toUpperCase();
  if (raw === 'ACTIVE' || raw === 'MONITORING' || raw === 'WARNING' || raw === 'ARCHIVED') {
    return raw as CompetitorStatus;
  }
  if (freshness > 24 * 45) return 'WARNING';
  if (threatScore != null && threatScore >= 75) return 'WARNING';
  return 'MONITORING';
}

function deriveIssues(items: CompetitorRecord[]): CompetitorIssue[] {
  const issues: CompetitorIssue[] = [];
  const byName = new Map<string, string[]>();

  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    const list = byName.get(key) ?? [];
    list.push(item.id);
    byName.set(key, list);

    if (item.threatScore != null && item.threatScore >= 75) {
      issues.push({
        id: `${item.id}-threat`,
        severity: 'CRITICAL',
        code: 'HIGH_THREAT',
        message: `High threat score (${item.threatScore}) for “${item.name}”.`,
        competitorId: item.id,
      });
    }
    if (item.status === 'WARNING' || (item.freshnessHours ?? 0) > 24 * 45) {
      issues.push({
        id: `${item.id}-stale`,
        severity: 'WARNING',
        code: 'STALE_MONITORING',
        message: `Competitor “${item.name}” monitoring may be stale (${item.freshnessHours}h).`,
        competitorId: item.id,
      });
    }
    if (!item.measuredConfidence || item.confidence < 40) {
      issues.push({
        id: `${item.id}-conf`,
        severity: 'WARNING',
        code: 'LOW_CONFIDENCE',
        message: `Low or unmeasured confidence on “${item.name}”.`,
        competitorId: item.id,
      });
    }
    if (item.whitespaceOpportunities.length === 0 && item.opportunityCount === 0) {
      issues.push({
        id: `${item.id}-gap`,
        severity: 'INFO',
        code: 'NO_WHITESPACE',
        message: `No whitespace opportunities recorded for “${item.name}”.`,
        competitorId: item.id,
      });
    }
  }

  for (const [name, ids] of byName) {
    if (ids.length > 1) {
      issues.push({
        id: `dup-${name.slice(0, 40)}`,
        severity: 'WARNING',
        code: 'DUPLICATE_COMPETITOR',
        message: `${ids.length} competitor signals share name “${name}”.`,
        competitorId: ids[0],
      });
    }
  }

  return issues.slice(0, 40);
}

export async function loadCompetitorIntelligence(): Promise<CompetitorIntelligenceOverview> {
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

    const sourceCountRows = await prisma.$queryRaw<Array<{ total: number | bigint }>>`
      SELECT COUNT(*) AS total
      FROM ci_sources
      WHERE status <> 'ARCHIVED'
        AND (
          source_type IN ('VERIFIED_NEWS', 'SOCIAL', 'YOUTUBE', 'RSS', 'LICENSED_PROVIDER')
          OR JSON_VALUE(configuration_json, '$.category') LIKE '%news%'
          OR JSON_VALUE(configuration_json, '$.category') LIKE '%social%'
        )
    `;

    const rows = await prisma.$queryRaw<SignalRow[]>`
      SELECT TOP 200
        CONVERT(varchar(36), s.id) AS id,
        CONVERT(varchar(36), s.run_id) AS runId,
        r.status AS runStatus,
        CONVERT(varchar(36), s.source_id) AS sourceId,
        src.name AS sourceName,
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
      WHERE s.signal_type = 'COMPETITOR'
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
         OR action LIKE '%COMPETITOR%'
         OR action LIKE '%SIGNAL%'
      ORDER BY created_at DESC
    `;

    const competitors: CompetitorRecord[] = rows.map((row) => {
      const meta = parseMeta(row.rawMetadataJson);
      const confidence = Number(row.confidence);
      const measuredConfidence = Number.isFinite(confidence) && confidence >= 1;
      const threatScore = numOrNull(meta.threatScore ?? meta.threat_score ?? meta.risk);
      const fresh = freshnessHours(row.observedAt, row.createdAt);
      const whitespace = stringList(
        meta.whitespaceOpportunities ?? meta.whitespace ?? meta.contentGaps ?? meta.gaps,
      );

      return {
        id: row.id,
        name: strOrNull(meta.competitorName ?? meta.name) ?? row.subject,
        summary: row.summary,
        platform: strOrNull(meta.platform ?? meta.channel),
        region: strOrNull(meta.region ?? meta.geography ?? meta.country),
        niche: strOrNull(meta.niche ?? meta.category ?? meta.domain),
        status: deriveStatus(meta, threatScore, fresh),
        publishingFrequency: strOrNull(
          meta.publishingFrequency ?? meta.publishFrequency ?? meta.cadence,
        ),
        contentCategories: stringList(meta.contentCategories ?? meta.categories ?? meta.topics),
        engagement: numOrNull(meta.engagement ?? meta.engagementScore),
        seoVisibility: numOrNull(meta.seoVisibility ?? meta.seo_score ?? meta.visibility),
        audienceOverlap: numOrNull(meta.audienceOverlap ?? meta.audience_overlap),
        trendAdoption: numOrNull(meta.trendAdoption ?? meta.trend_adoption),
        coverageScore: numOrNull(meta.coverageScore ?? meta.coverage),
        threatScore,
        benchmarkScore: numOrNull(meta.benchmarkScore ?? meta.benchmark),
        similarityScore: numOrNull(meta.similarityScore ?? meta.similarity),
        strengths: stringList(meta.strengths),
        weaknesses: stringList(meta.weaknesses),
        whitespaceOpportunities: whitespace,
        recommendations: stringList(
          meta.recommendations ?? meta.strategicRecommendations ?? meta.actions,
        ),
        confidence,
        measuredConfidence,
        opportunityCount: Number(row.opportunityCount ?? 0),
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

    const distinctCompetitors = new Set(
      competitors.map((item) => item.name.trim().toLowerCase()).filter(Boolean),
    );

    const coverageValues = competitors
      .map((item) => item.coverageScore)
      .filter((value): value is number => value != null);
    const coverage =
      coverageValues.length > 0
        ? Math.round(coverageValues.reduce((sum, n) => sum + n, 0) / coverageValues.length)
        : null;

    const threatValues = competitors
      .map((item) => item.threatScore)
      .filter((value): value is number => value != null);
    const threatScore =
      threatValues.length > 0
        ? Math.round(threatValues.reduce((sum, n) => sum + n, 0) / threatValues.length)
        : null;

    const gaps = competitors.reduce(
      (sum, item) => sum + item.whitespaceOpportunities.length,
      0,
    );
    const opportunities = competitors.reduce((sum, item) => sum + item.opportunityCount, 0);
    const warningCount = competitors.filter((item) => item.status === 'WARNING').length;
    const highThreat = competitors.filter(
      (item) => item.threatScore != null && item.threatScore >= 75,
    ).length;

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
        competitors: distinctCompetitors.size || competitors.length,
        monitoredSources: Number(sourceCountRows[0]?.total ?? 0),
        coverage,
        measuredCoverage: coverageValues.length,
        gaps,
        threatScore,
        measuredThreat: threatValues.length,
        opportunities,
        warningCount,
        highThreat,
      },
      competitors,
      issues: deriveIssues(competitors),
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
          : 'Competitor intelligence unavailable. Run the Content Intelligence migration.',
      metrics: {
        competitors: 0,
        monitoredSources: 0,
        coverage: null,
        measuredCoverage: 0,
        gaps: 0,
        threatScore: null,
        measuredThreat: 0,
        opportunities: 0,
        warningCount: 0,
        highThreat: 0,
      },
      competitors: [],
      issues: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
