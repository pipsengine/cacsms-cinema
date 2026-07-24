import { prisma } from '@/lib/db';

export type TopicOpportunityRecord = {
  id: string;
  topic: string;
  summary: string;
  status: string;
  domain: string;
  geography: string | null;
  audience: string | null;
  formatHint: string | null;
  opportunityScore: number;
  measuredScore: boolean;
  confidence: number;
  measuredConfidence: boolean;
  demandScore: number | null;
  competitionScore: number | null;
  trendStrength: number | null;
  evidenceQuality: number | null;
  audienceFit: number | null;
  strategicAlignment: number | null;
  predictedPerformance: number | null;
  expectedRoi: number | null;
  priority: number | null;
  duplicateSimilarity: number | null;
  riskScore: number | null;
  rankPosition: number | null;
  scoreExplanation: string | null;
  scoreFactors: Record<string, number>;
  evidenceCount: number;
  signalSubjects: string[];
  verificationPassed: number;
  verificationFailed: number;
  handoffStatus: string | null;
  runId: string;
  runStatus: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TopicOpportunityIssue = {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  code: string;
  message: string;
  opportunityId?: string;
};

export type TopicOpportunitiesOverview = {
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
    opportunities: number;
    highPriority: number;
    avgOpportunityScore: number | null;
    measuredScores: number;
    avgDemandScore: number | null;
    measuredDemand: number;
    measuredConfidence: number;
    avgConfidence: number | null;
    approved: number;
    duplicates: number;
    blocked: number;
    handedOff: number;
  };
  opportunities: TopicOpportunityRecord[];
  issues: TopicOpportunityIssue[];
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

type OpportunityRow = {
  id: string;
  title: string;
  summary: string;
  status: string;
  domain: string;
  geography: string | null;
  audience: string | null;
  formatHint: string | null;
  score: number | string;
  confidence: number | string;
  duplicateSimilarity: number | string | null;
  riskScore: number | string | null;
  scoreExplanationJson: string | null;
  runId: string;
  runStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
  evidenceCount: number | bigint;
  verificationPassed: number | bigint;
  verificationFailed: number | bigint;
  rankPosition: number | string | null;
  handoffStatus: string | null;
  totalScore: number | string | null;
  scoreExplanation: string | null;
  factorsJson: string | null;
};

function parseJsonObject(raw: string | null): Record<string, unknown> {
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

function factorMap(raw: string | null): Record<string, number> {
  const obj = parseJsonObject(raw);
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(obj)) {
    const n = Number(value);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

function deriveIssues(items: TopicOpportunityRecord[]): TopicOpportunityIssue[] {
  const issues: TopicOpportunityIssue[] = [];
  const byTopic = new Map<string, string[]>();

  for (const item of items) {
    const key = item.topic.trim().toLowerCase();
    const list = byTopic.get(key) ?? [];
    list.push(item.id);
    byTopic.set(key, list);

    if (item.status === 'BLOCKED' || item.status === 'REJECTED') {
      issues.push({
        id: `${item.id}-blocked`,
        severity: 'CRITICAL',
        code: 'BLOCKED_OPPORTUNITY',
        message: `Opportunity “${item.topic}” is ${item.status}.`,
        opportunityId: item.id,
      });
    }
    if (!item.measuredConfidence || item.confidence < 40) {
      issues.push({
        id: `${item.id}-low-conf`,
        severity: 'WARNING',
        code: 'LOW_CONFIDENCE',
        message: `Low or unmeasured confidence on “${item.topic}”.`,
        opportunityId: item.id,
      });
    }
    if (item.duplicateSimilarity != null && item.duplicateSimilarity >= 70) {
      issues.push({
        id: `${item.id}-dup`,
        severity: 'WARNING',
        code: 'DUPLICATE_SIMILARITY',
        message: `High duplicate similarity (${item.duplicateSimilarity}) on “${item.topic}”.`,
        opportunityId: item.id,
      });
    }
    if (item.evidenceCount === 0) {
      issues.push({
        id: `${item.id}-evidence`,
        severity: 'WARNING',
        code: 'MISSING_EVIDENCE',
        message: `No linked signals for “${item.topic}”.`,
        opportunityId: item.id,
      });
    }
    if (item.verificationFailed > 0) {
      issues.push({
        id: `${item.id}-verify`,
        severity: 'WARNING',
        code: 'VERIFICATION_FAILED',
        message: `${item.verificationFailed} failed verification(s) on “${item.topic}”.`,
        opportunityId: item.id,
      });
    }
  }

  for (const [topic, ids] of byTopic) {
    if (ids.length > 1) {
      issues.push({
        id: `cluster-${topic.slice(0, 40)}`,
        severity: 'INFO',
        code: 'TOPIC_CLUSTER',
        message: `${ids.length} opportunities share topic “${topic}”.`,
        opportunityId: ids[0],
      });
    }
  }

  return issues.slice(0, 40);
}

export async function loadTopicOpportunities(): Promise<TopicOpportunitiesOverview> {
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

    const rows = await prisma.$queryRaw<OpportunityRow[]>`
      SELECT TOP 200
        CONVERT(varchar(36), o.id) AS id,
        o.title,
        o.summary,
        o.status,
        o.domain,
        o.geography,
        o.audience,
        o.format_hint AS formatHint,
        o.score,
        o.confidence,
        o.duplicate_similarity AS duplicateSimilarity,
        o.risk_score AS riskScore,
        o.score_explanation_json AS scoreExplanationJson,
        CONVERT(varchar(36), o.run_id) AS runId,
        r.status AS runStatus,
        o.created_at AS createdAt,
        o.updated_at AS updatedAt,
        (
          SELECT COUNT(*)
          FROM ci_opportunity_signals os
          WHERE os.opportunity_id = o.id
        ) AS evidenceCount,
        (
          SELECT COUNT(*)
          FROM ci_verifications v
          WHERE v.opportunity_id = o.id AND v.status IN ('PASSED', 'VERIFIED', 'ACCEPTED')
        ) AS verificationPassed,
        (
          SELECT COUNT(*)
          FROM ci_verifications v
          WHERE v.opportunity_id = o.id AND v.status IN ('FAILED', 'REJECTED')
        ) AS verificationFailed,
        (
          SELECT TOP 1 rk.rank_position
          FROM ci_rankings rk
          WHERE rk.opportunity_id = o.id
          ORDER BY rk.ranked_at DESC
        ) AS rankPosition,
        (
          SELECT TOP 1 h.status
          FROM ci_handoffs h
          WHERE h.opportunity_id = o.id
          ORDER BY h.created_at DESC
        ) AS handoffStatus,
        (
          SELECT TOP 1 s.total_score
          FROM ci_scores s
          WHERE s.opportunity_id = o.id
          ORDER BY s.scored_at DESC
        ) AS totalScore,
        (
          SELECT TOP 1 s.explanation
          FROM ci_scores s
          WHERE s.opportunity_id = o.id
          ORDER BY s.scored_at DESC
        ) AS scoreExplanation,
        (
          SELECT TOP 1 s.factors_json
          FROM ci_scores s
          WHERE s.opportunity_id = o.id
          ORDER BY s.scored_at DESC
        ) AS factorsJson
      FROM ci_opportunities o
      LEFT JOIN ci_discovery_runs r ON r.id = o.run_id
      WHERE o.status <> 'ARCHIVED'
      ORDER BY
        CASE WHEN o.score IS NULL THEN 0 ELSE o.score END DESC,
        o.created_at DESC
    `;

    const signalRows = await prisma.$queryRaw<
      Array<{ opportunityId: string; subject: string }>
    >`
      SELECT TOP 500
        CONVERT(varchar(36), os.opportunity_id) AS opportunityId,
        sig.subject
      FROM ci_opportunity_signals os
      INNER JOIN ci_signals sig ON sig.id = os.signal_id
      ORDER BY sig.created_at DESC
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
         OR action LIKE '%OPPORTUNITY%'
         OR action LIKE '%SCORE%'
         OR action LIKE '%RANK%'
         OR opportunity_id IS NOT NULL
      ORDER BY created_at DESC
    `;

    const signalsByOpp = new Map<string, string[]>();
    for (const row of signalRows) {
      const list = signalsByOpp.get(row.opportunityId) ?? [];
      if (list.length < 8) list.push(row.subject);
      signalsByOpp.set(row.opportunityId, list);
    }

    const opportunities: TopicOpportunityRecord[] = rows.map((row) => {
      const factors = factorMap(row.factorsJson);
      const explanationObj = parseJsonObject(row.scoreExplanationJson);
      const opportunityScore =
        numOrNull(row.totalScore) ??
        Number(row.score) ??
        0;
      const confidence = Number(row.confidence);
      const measuredConfidence = Number.isFinite(confidence) && confidence >= 1;
      const measuredScore = Number.isFinite(opportunityScore) && opportunityScore > 0;

      return {
        id: row.id,
        topic: row.title,
        summary: row.summary,
        status: row.status,
        domain: row.domain,
        geography: row.geography,
        audience: row.audience,
        formatHint: row.formatHint,
        opportunityScore,
        measuredScore,
        confidence,
        measuredConfidence,
        demandScore: numOrNull(
          factors.audienceDemand ??
            factors.demand ??
            explanationObj.demandScore ??
            explanationObj.audienceDemand,
        ),
        competitionScore: numOrNull(
          factors.competition ??
            factors.competitorSaturation ??
            explanationObj.competitionScore,
        ),
        trendStrength: numOrNull(factors.trendStrength ?? factors.timeliness ?? explanationObj.trendStrength),
        evidenceQuality: numOrNull(factors.evidence ?? factors.evidenceQuality ?? explanationObj.evidenceQuality),
        audienceFit: numOrNull(factors.audienceFit ?? factors.audienceDemand ?? explanationObj.audienceFit),
        strategicAlignment: numOrNull(
          factors.strategicFit ?? factors.strategicAlignment ?? explanationObj.strategicFit,
        ),
        predictedPerformance: numOrNull(
          factors.predictedPerformance ?? explanationObj.predictedPerformance,
        ),
        expectedRoi: numOrNull(factors.expectedRoi ?? factors.roi ?? explanationObj.expectedRoi),
        priority: numOrNull(
          factors.priority ?? explanationObj.priority ?? row.rankPosition,
        ),
        duplicateSimilarity:
          row.duplicateSimilarity != null ? Number(row.duplicateSimilarity) : null,
        riskScore: row.riskScore != null ? Number(row.riskScore) : null,
        rankPosition: row.rankPosition != null ? Number(row.rankPosition) : null,
        scoreExplanation:
          row.scoreExplanation ??
          (typeof explanationObj.explanation === 'string'
            ? explanationObj.explanation
            : null),
        scoreFactors: factors,
        evidenceCount: Number(row.evidenceCount ?? 0),
        signalSubjects: signalsByOpp.get(row.id) ?? [],
        verificationPassed: Number(row.verificationPassed ?? 0),
        verificationFailed: Number(row.verificationFailed ?? 0),
        handoffStatus: row.handoffStatus,
        runId: row.runId,
        runStatus: row.runStatus,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });

    const highPriority = opportunities.filter(
      (item) =>
        (item.priority != null && item.priority <= 10) ||
        (item.rankPosition != null && item.rankPosition <= 10) ||
        (item.measuredScore && item.opportunityScore >= 75) ||
        item.status === 'QUALIFIED' ||
        item.status === 'HANDED_OFF',
    ).length;

    const measuredScores = opportunities.filter((item) => item.measuredScore);
    const avgOpportunityScore =
      measuredScores.length > 0
        ? Math.round(
            measuredScores.reduce((sum, item) => sum + item.opportunityScore, 0) /
              measuredScores.length,
          )
        : null;

    const demandValues = opportunities
      .map((item) => item.demandScore)
      .filter((value): value is number => value != null);
    const avgDemandScore =
      demandValues.length > 0
        ? Math.round(demandValues.reduce((sum, n) => sum + n, 0) / demandValues.length)
        : null;

    const measured = opportunities.filter((item) => item.measuredConfidence);
    const avgConfidence =
      measured.length > 0
        ? Math.round(measured.reduce((sum, item) => sum + item.confidence, 0) / measured.length)
        : null;

    const approved = opportunities.filter(
      (item) =>
        item.status === 'QUALIFIED' ||
        item.status === 'VERIFIED' ||
        item.status === 'HANDED_OFF' ||
        item.handoffStatus === 'ACKNOWLEDGED',
    ).length;

    const duplicates = opportunities.filter(
      (item) => item.duplicateSimilarity != null && item.duplicateSimilarity >= 70,
    ).length;
    const blocked = opportunities.filter(
      (item) => item.status === 'BLOCKED' || item.status === 'REJECTED',
    ).length;
    const handedOff = opportunities.filter(
      (item) => item.status === 'HANDED_OFF' || item.handoffStatus === 'ACKNOWLEDGED',
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
        opportunities: opportunities.length,
        highPriority,
        avgOpportunityScore,
        measuredScores: measuredScores.length,
        avgDemandScore,
        measuredDemand: demandValues.length,
        measuredConfidence: measured.length,
        avgConfidence,
        approved,
        duplicates,
        blocked,
        handedOff,
      },
      opportunities,
      issues: deriveIssues(opportunities),
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
          : 'Topic opportunities unavailable. Run the Content Intelligence migration.',
      metrics: {
        opportunities: 0,
        highPriority: 0,
        avgOpportunityScore: null,
        measuredScores: 0,
        avgDemandScore: null,
        measuredDemand: 0,
        measuredConfidence: 0,
        avgConfidence: null,
        approved: 0,
        duplicates: 0,
        blocked: 0,
        handedOff: 0,
      },
      opportunities: [],
      issues: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
