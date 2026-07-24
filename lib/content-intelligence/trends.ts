import { prisma } from '@/lib/db';

export type TrendPhase =
  | 'EMERGING'
  | 'GROWING'
  | 'STABLE'
  | 'DECLINING'
  | 'SEASONAL'
  | 'EVERGREEN'
  | 'ARCHIVED'
  | 'UNKNOWN';

export type TrendRecord = {
  id: string;
  topic: string;
  summary: string;
  signalType: string;
  phase: TrendPhase;
  category: string | null;
  region: string | null;
  language: string | null;
  growthRate: number | null;
  momentum: number | null;
  confidence: number;
  measuredConfidence: boolean;
  evidenceCount: number;
  geographicReach: string | null;
  audienceInterest: number | null;
  sentiment: string | null;
  freshnessHours: number | null;
  sourceId: string | null;
  sourceName: string | null;
  evidenceUrl: string | null;
  strategicRelevance: number | null;
  opportunityCount: number;
  forecastHorizon: string | null;
  forecastNote: string | null;
  clusterKey: string | null;
  runId: string;
  runStatus: string | null;
  observedAt: string | null;
  createdAt: string;
  fingerprint: string;
};

export type TrendIssue = {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  code: string;
  message: string;
  trendId?: string;
};

export type TrendIntelligenceOverview = {
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
    activeTrends: number;
    emergingTrends: number;
    decliningTrends: number;
    measuredConfidence: number;
    avgConfidence: number | null;
    coverageScore: number;
    opportunityIndex: number;
    seasonal: number;
    evergreen: number;
    stable: number;
    growing: number;
    weakSignals: number;
    duplicateClusters: number;
  };
  trends: TrendRecord[];
  issues: TrendIssue[];
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

function normalizePhase(raw: string | null | undefined, signalType: string): TrendPhase {
  const value = (raw ?? '').toUpperCase().replace(/[\s-]+/g, '_');
  const allowed: TrendPhase[] = [
    'EMERGING',
    'GROWING',
    'STABLE',
    'DECLINING',
    'SEASONAL',
    'EVERGREEN',
    'ARCHIVED',
  ];
  if (allowed.includes(value as TrendPhase)) return value as TrendPhase;
  if (signalType === 'SEASONAL') return 'SEASONAL';
  return 'UNKNOWN';
}

function derivePhase(
  meta: Record<string, unknown>,
  signalType: string,
  createdAt: Date,
  confidence: number,
  measured: boolean,
): TrendPhase {
  const fromMeta = normalizePhase(
    strOrNull(meta.phase ?? meta.trendPhase ?? meta.lifecycle ?? meta.status),
    signalType,
  );
  if (fromMeta !== 'UNKNOWN') return fromMeta;

  if (signalType === 'SEASONAL') return 'SEASONAL';

  const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  if (ageHours <= 168) return 'EMERGING';
  if (measured && confidence >= 70) return 'STABLE';
  if (measured && confidence < 40 && ageHours > 720) return 'DECLINING';
  return 'STABLE';
}

function freshnessHours(observedAt: Date | null, createdAt: Date): number {
  const anchor = observedAt ?? createdAt;
  return Math.max(0, Math.round((Date.now() - anchor.getTime()) / (1000 * 60 * 60)));
}

function deriveIssues(trends: TrendRecord[]): TrendIssue[] {
  const issues: TrendIssue[] = [];
  const byTopic = new Map<string, string[]>();

  for (const trend of trends) {
    const key = trend.topic.trim().toLowerCase();
    const list = byTopic.get(key) ?? [];
    list.push(trend.id);
    byTopic.set(key, list);

    if (!trend.measuredConfidence || trend.confidence < 40) {
      issues.push({
        id: `${trend.id}-weak`,
        severity: 'WARNING',
        code: 'WEAK_SIGNAL',
        message: `Weak or unmeasured confidence on “${trend.topic}”.`,
        trendId: trend.id,
      });
    }
    if ((trend.freshnessHours ?? 0) > 24 * 45) {
      issues.push({
        id: `${trend.id}-stale`,
        severity: 'WARNING',
        code: 'STALE_TREND',
        message: `Trend “${trend.topic}” has not been refreshed for ${trend.freshnessHours}h.`,
        trendId: trend.id,
      });
    }
    if (trend.phase === 'DECLINING') {
      issues.push({
        id: `${trend.id}-decline`,
        severity: 'INFO',
        code: 'DECLINING_TREND',
        message: `Declining phase recorded for “${trend.topic}”.`,
        trendId: trend.id,
      });
    }
    if (!trend.sourceId) {
      issues.push({
        id: `${trend.id}-nosource`,
        severity: 'INFO',
        code: 'MISSING_SOURCE',
        message: `Trend “${trend.topic}” has no linked source_id.`,
        trendId: trend.id,
      });
    }
  }

  let duplicateClusters = 0;
  for (const [topic, ids] of byTopic) {
    if (ids.length > 1) {
      duplicateClusters += 1;
      issues.push({
        id: `dup-${topic.slice(0, 40)}`,
        severity: 'WARNING',
        code: 'DUPLICATE_TOPIC',
        message: `${ids.length} signals share topic “${topic}”.`,
        trendId: ids[0],
      });
    }
  }

  void duplicateClusters;
  return issues.slice(0, 40);
}

export async function loadTrendIntelligence(): Promise<TrendIntelligenceOverview> {
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
      WHERE s.signal_type IN ('TREND', 'SEASONAL')
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
         OR action LIKE '%TREND%'
         OR action LIKE '%SIGNAL%'
      ORDER BY created_at DESC
    `;

    const trends: TrendRecord[] = rows.map((row) => {
      const meta = parseMeta(row.rawMetadataJson);
      const confidence = Number(row.confidence);
      const measuredConfidence = Number.isFinite(confidence) && confidence >= 1;
      const phase = derivePhase(meta, row.signalType, row.createdAt, confidence, measuredConfidence);

      return {
        id: row.id,
        topic: row.subject,
        summary: row.summary,
        signalType: row.signalType,
        phase,
        category: strOrNull(meta.category ?? meta.domain ?? meta.field),
        region: strOrNull(meta.region ?? meta.geography ?? meta.country),
        language: strOrNull(meta.language ?? meta.languageCode ?? meta.locale),
        growthRate: numOrNull(meta.growthRate ?? meta.growth_rate),
        momentum: numOrNull(meta.momentum ?? meta.velocity),
        confidence,
        measuredConfidence,
        evidenceCount: 1 + (row.evidenceUrl ? 1 : 0),
        geographicReach: strOrNull(meta.geographicReach ?? meta.region ?? meta.geography),
        audienceInterest: numOrNull(meta.audienceInterest ?? meta.audience_interest),
        sentiment: strOrNull(meta.sentiment),
        freshnessHours: freshnessHours(row.observedAt, row.createdAt),
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        evidenceUrl: row.evidenceUrl,
        strategicRelevance: numOrNull(meta.strategicRelevance ?? meta.strategic_fit),
        opportunityCount: Number(row.opportunityCount ?? 0),
        forecastHorizon: strOrNull(meta.forecastHorizon ?? meta.forecast_horizon),
        forecastNote: strOrNull(meta.forecastNote ?? meta.forecast ?? meta.decayPrediction),
        clusterKey: strOrNull(meta.clusterKey ?? meta.cluster_id) ?? row.fingerprint.slice(0, 16),
        runId: row.runId,
        runStatus: row.runStatus,
        observedAt: row.observedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        fingerprint: row.fingerprint,
      };
    });

    const activeTrends = trends.filter((item) => item.phase !== 'ARCHIVED').length;
    const emergingTrends = trends.filter((item) => item.phase === 'EMERGING').length;
    const decliningTrends = trends.filter((item) => item.phase === 'DECLINING').length;
    const seasonal = trends.filter((item) => item.phase === 'SEASONAL').length;
    const evergreen = trends.filter((item) => item.phase === 'EVERGREEN').length;
    const stable = trends.filter((item) => item.phase === 'STABLE').length;
    const growing = trends.filter((item) => item.phase === 'GROWING').length;

    const measured = trends.filter((item) => item.measuredConfidence);
    const avgConfidence =
      measured.length > 0
        ? Math.round(
            measured.reduce((sum, item) => sum + item.confidence, 0) / measured.length,
          )
        : null;

    const withSource = trends.filter((item) => item.sourceId).length;
    const coverageScore =
      trends.length === 0 ? 0 : Math.round((withSource / trends.length) * 100);

    const withOpportunities = trends.filter((item) => item.opportunityCount > 0).length;
    const opportunityIndex =
      trends.length === 0 ? 0 : Math.round((withOpportunities / trends.length) * 100);

    const weakSignals = trends.filter(
      (item) => !item.measuredConfidence || item.confidence < 40,
    ).length;

    const topicCounts = new Map<string, number>();
    for (const trend of trends) {
      const key = trend.topic.trim().toLowerCase();
      topicCounts.set(key, (topicCounts.get(key) ?? 0) + 1);
    }
    const duplicateClusters = [...topicCounts.values()].filter((count) => count > 1).length;

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
        activeTrends,
        emergingTrends,
        decliningTrends,
        measuredConfidence: measured.length,
        avgConfidence,
        coverageScore,
        opportunityIndex,
        seasonal,
        evergreen,
        stable,
        growing,
        weakSignals,
        duplicateClusters,
      },
      trends,
      issues: deriveIssues(trends),
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
          : 'Trend intelligence unavailable. Run the Content Intelligence migration.',
      metrics: {
        activeTrends: 0,
        emergingTrends: 0,
        decliningTrends: 0,
        measuredConfidence: 0,
        avgConfidence: null,
        coverageScore: 0,
        opportunityIndex: 0,
        seasonal: 0,
        evergreen: 0,
        stable: 0,
        growing: 0,
        weakSignals: 0,
        duplicateClusters: 0,
      },
      trends: [],
      issues: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
