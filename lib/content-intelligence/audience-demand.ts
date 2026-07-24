import { prisma } from '@/lib/db';

export type DemandStatus =
  | 'ACTIVE'
  | 'EMERGING'
  | 'HIGH'
  | 'MODERATE'
  | 'WEAK'
  | 'STALE'
  | 'ARCHIVED'
  | 'UNKNOWN';

export type AudienceDemandRecord = {
  id: string;
  topic: string;
  summary: string;
  audience: string | null;
  intent: string | null;
  demandScore: number | null;
  searchIntentScore: number | null;
  engagement: number | null;
  sentiment: string | null;
  geography: string | null;
  language: string | null;
  platform: string | null;
  status: DemandStatus;
  confidence: number;
  measuredConfidence: boolean;
  opportunityRating: number | null;
  priority: number | null;
  evidenceUrl: string | null;
  sourceId: string | null;
  sourceName: string | null;
  opportunityCount: number;
  contentRecommendations: string[];
  forecastHorizon: string | null;
  forecastNote: string | null;
  painPoints: string[];
  questions: string[];
  unmetNeed: boolean;
  freshnessHours: number | null;
  runId: string;
  runStatus: string | null;
  observedAt: string | null;
  createdAt: string;
  fingerprint: string;
};

export type AudienceDemandIssue = {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  code: string;
  message: string;
  demandId?: string;
};

export type AudienceDemandOverview = {
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
    audienceSegments: number;
    highDemandTopics: number;
    measuredIntent: number;
    avgSearchIntent: number | null;
    demandIndex: number;
    measuredConfidence: number;
    avgConfidence: number | null;
    opportunityScore: number;
    weakDemand: number;
    staleInsights: number;
    duplicateTopics: number;
    unmetNeeds: number;
  };
  demands: AudienceDemandRecord[];
  segments: Array<{ audience: string; count: number; avgConfidence: number | null }>;
  issues: AudienceDemandIssue[];
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
  confidence: number,
  measured: boolean,
  demandScore: number | null,
  freshness: number,
): DemandStatus {
  const raw = strOrNull(meta.status ?? meta.demandStatus ?? meta.phase);
  const normalized = (raw ?? '').toUpperCase();
  const allowed: DemandStatus[] = [
    'ACTIVE',
    'EMERGING',
    'HIGH',
    'MODERATE',
    'WEAK',
    'STALE',
    'ARCHIVED',
  ];
  if (allowed.includes(normalized as DemandStatus)) return normalized as DemandStatus;

  if (freshness > 24 * 45) return 'STALE';
  if (demandScore != null && demandScore >= 75) return 'HIGH';
  if (demandScore != null && demandScore >= 45) return 'MODERATE';
  if (demandScore != null && demandScore < 45) return 'WEAK';
  if (!measured || confidence < 40) return 'WEAK';
  if (freshness <= 168) return 'EMERGING';
  return 'ACTIVE';
}

function deriveIssues(demands: AudienceDemandRecord[]): AudienceDemandIssue[] {
  const issues: AudienceDemandIssue[] = [];
  const byTopic = new Map<string, string[]>();

  for (const item of demands) {
    const key = item.topic.trim().toLowerCase();
    const list = byTopic.get(key) ?? [];
    list.push(item.id);
    byTopic.set(key, list);

    if (item.status === 'WEAK' || !item.measuredConfidence || item.confidence < 40) {
      issues.push({
        id: `${item.id}-weak`,
        severity: 'WARNING',
        code: 'WEAK_DEMAND',
        message: `Weak or unmeasured demand on “${item.topic}”.`,
        demandId: item.id,
      });
    }
    if (item.status === 'STALE' || (item.freshnessHours ?? 0) > 24 * 45) {
      issues.push({
        id: `${item.id}-stale`,
        severity: 'WARNING',
        code: 'STALE_INSIGHT',
        message: `Audience insight “${item.topic}” is stale (${item.freshnessHours}h).`,
        demandId: item.id,
      });
    }
    if (item.unmetNeed) {
      issues.push({
        id: `${item.id}-unmet`,
        severity: 'INFO',
        code: 'UNMET_NEED',
        message: `Unmet need flagged for “${item.topic}”.`,
        demandId: item.id,
      });
    }
  }

  for (const [topic, ids] of byTopic) {
    if (ids.length > 1) {
      issues.push({
        id: `dup-${topic.slice(0, 40)}`,
        severity: 'WARNING',
        code: 'DUPLICATE_OPPORTUNITY',
        message: `${ids.length} demand signals share topic “${topic}”.`,
        demandId: ids[0],
      });
    }
  }

  return issues.slice(0, 40);
}

export async function loadAudienceDemand(): Promise<AudienceDemandOverview> {
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
      WHERE s.signal_type = 'AUDIENCE_DEMAND'
      ORDER BY s.created_at DESC
    `;

    const opportunityAudiences = await prisma.$queryRaw<
      Array<{ audience: string; count: number | bigint }>
    >`
      SELECT audience, COUNT(*) AS count
      FROM ci_opportunities
      WHERE audience IS NOT NULL AND LTRIM(RTRIM(audience)) <> ''
      GROUP BY audience
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
         OR action LIKE '%AUDIENCE%'
         OR action LIKE '%SIGNAL%'
      ORDER BY created_at DESC
    `;

    const demands: AudienceDemandRecord[] = rows.map((row) => {
      const meta = parseMeta(row.rawMetadataJson);
      const confidence = Number(row.confidence);
      const measuredConfidence = Number.isFinite(confidence) && confidence >= 1;
      const demandScore = numOrNull(meta.demandScore ?? meta.demand_score ?? meta.score);
      const searchIntentScore = numOrNull(
        meta.searchIntentScore ?? meta.search_intent_score ?? meta.intentScore,
      );
      const fresh = freshnessHours(row.observedAt, row.createdAt);
      const unmetNeed =
        meta.unmetNeed === true ||
        meta.unmet_need === true ||
        String(meta.unmetNeed ?? '').toLowerCase() === 'true';

      return {
        id: row.id,
        topic: row.subject,
        summary: row.summary,
        audience: strOrNull(meta.audience ?? meta.segment ?? meta.persona),
        intent: strOrNull(meta.intent ?? meta.searchIntent ?? meta.search_intent),
        demandScore,
        searchIntentScore,
        engagement: numOrNull(meta.engagement ?? meta.engagementScore),
        sentiment: strOrNull(meta.sentiment),
        geography: strOrNull(meta.geography ?? meta.region ?? meta.country),
        language: strOrNull(meta.language ?? meta.languageCode ?? meta.locale),
        platform: strOrNull(meta.platform ?? meta.channel),
        status: deriveStatus(meta, confidence, measuredConfidence, demandScore, fresh),
        confidence,
        measuredConfidence,
        opportunityRating: numOrNull(meta.opportunityRating ?? meta.opportunity_score),
        priority: numOrNull(meta.priority),
        evidenceUrl: row.evidenceUrl,
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        opportunityCount: Number(row.opportunityCount ?? 0),
        contentRecommendations: stringList(
          meta.contentRecommendations ?? meta.recommendations ?? meta.downstream,
        ),
        forecastHorizon: strOrNull(meta.forecastHorizon ?? meta.forecast_horizon),
        forecastNote: strOrNull(meta.forecastNote ?? meta.forecast),
        painPoints: stringList(meta.painPoints ?? meta.pain_points),
        questions: stringList(meta.questions ?? meta.audienceQuestions),
        unmetNeed,
        freshnessHours: fresh,
        runId: row.runId,
        runStatus: row.runStatus,
        observedAt: row.observedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        fingerprint: row.fingerprint,
      };
    });

    const segmentMap = new Map<string, { count: number; confidences: number[] }>();
    for (const item of demands) {
      const key = item.audience?.trim() || 'Unspecified audience';
      const entry = segmentMap.get(key) ?? { count: 0, confidences: [] };
      entry.count += 1;
      if (item.measuredConfidence) entry.confidences.push(item.confidence);
      segmentMap.set(key, entry);
    }
    for (const row of opportunityAudiences) {
      const key = row.audience.trim();
      if (!key) continue;
      const entry = segmentMap.get(key) ?? { count: 0, confidences: [] };
      entry.count += Number(row.count);
      segmentMap.set(key, entry);
    }

    const segments = [...segmentMap.entries()]
      .map(([audience, value]) => ({
        audience,
        count: value.count,
        avgConfidence:
          value.confidences.length > 0
            ? Math.round(
                value.confidences.reduce((sum, n) => sum + n, 0) / value.confidences.length,
              )
            : null,
      }))
      .sort((a, b) => b.count - a.count);

    const highDemandTopics = demands.filter(
      (item) =>
        item.status === 'HIGH' ||
        (item.demandScore != null && item.demandScore >= 75) ||
        (item.measuredConfidence && item.confidence >= 70),
    ).length;

    const searchIntentScores = demands
      .map((item) => item.searchIntentScore)
      .filter((value): value is number => value != null);
    const measuredIntent = searchIntentScores.length;
    const avgSearchIntent =
      measuredIntent > 0
        ? Math.round(searchIntentScores.reduce((sum, n) => sum + n, 0) / measuredIntent)
        : null;

    const measured = demands.filter((item) => item.measuredConfidence);
    const avgConfidence =
      measured.length > 0
        ? Math.round(measured.reduce((sum, item) => sum + item.confidence, 0) / measured.length)
        : null;

    const withOpportunities = demands.filter((item) => item.opportunityCount > 0).length;
    const demandIndex =
      demands.length === 0
        ? 0
        : Math.round(
            ((highDemandTopics + withOpportunities) / Math.max(1, demands.length * 2)) * 100,
          );
    const opportunityScore =
      demands.length === 0 ? 0 : Math.round((withOpportunities / demands.length) * 100);

    const weakDemand = demands.filter(
      (item) => item.status === 'WEAK' || !item.measuredConfidence || item.confidence < 40,
    ).length;
    const staleInsights = demands.filter(
      (item) => item.status === 'STALE' || (item.freshnessHours ?? 0) > 24 * 45,
    ).length;
    const unmetNeeds = demands.filter((item) => item.unmetNeed).length;

    const topicCounts = new Map<string, number>();
    for (const item of demands) {
      const key = item.topic.trim().toLowerCase();
      topicCounts.set(key, (topicCounts.get(key) ?? 0) + 1);
    }
    const duplicateTopics = [...topicCounts.values()].filter((count) => count > 1).length;

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
        audienceSegments: segments.length,
        highDemandTopics,
        measuredIntent,
        avgSearchIntent,
        demandIndex,
        measuredConfidence: measured.length,
        avgConfidence,
        opportunityScore,
        weakDemand,
        staleInsights,
        duplicateTopics,
        unmetNeeds,
      },
      demands,
      segments,
      issues: deriveIssues(demands),
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
          : 'Audience demand unavailable. Run the Content Intelligence migration.',
      metrics: {
        audienceSegments: 0,
        highDemandTopics: 0,
        measuredIntent: 0,
        avgSearchIntent: null,
        demandIndex: 0,
        measuredConfidence: 0,
        avgConfidence: null,
        opportunityScore: 0,
        weakDemand: 0,
        staleInsights: 0,
        duplicateTopics: 0,
        unmetNeeds: 0,
      },
      demands: [],
      segments: [],
      issues: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
