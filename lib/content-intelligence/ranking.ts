import { prisma } from '@/lib/db';

export type RankingRecord = {
  id: string;
  rankingId: string | null;
  opportunityId: string;
  title: string;
  summary: string;
  domain: string;
  audience: string | null;
  geography: string | null;
  status: string;
  rankPosition: number | null;
  selectionStatus: string;
  overallScore: number;
  measuredScore: boolean;
  confidence: number | null;
  measuredConfidence: boolean;
  demand: number | null;
  uniqueness: number | null;
  strategicFit: number | null;
  roi: number | null;
  portfolioImpact: number | null;
  portfolioFit: number | null;
  evidenceQuality: number | null;
  priority: number | null;
  duplicateSimilarity: number | null;
  riskScore: number | null;
  explanation: string | null;
  scoreFactors: Record<string, number>;
  portfolioEffect: Record<string, unknown>;
  evidenceCount: number;
  evidenceSubjects: string[];
  recommendedAction: 'select' | 'hold' | 'defer' | 'reject' | 'handoff';
  nextStage: string;
  rankedAt: string | null;
  createdAt: string;
  updatedAt: string;
  handoffStatus: string | null;
};

export type RankingIssue = {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  code: string;
  message: string;
  rankingId?: string;
};

export type RankingSelectionOverview = {
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
    candidates: number;
    ranked: number;
    selected: number;
    measuredAiScore: number;
    avgAiScore: number | null;
    measuredPortfolioFit: number;
    avgPortfolioFit: number | null;
    ready: number;
    ties: number;
    blocked: number;
  };
  records: RankingRecord[];
  scoreDistribution: Array<{ bucket: string; count: number }>;
  issues: RankingIssue[];
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

type RankingRow = {
  opportunityId: string;
  rankingId: string | null;
  title: string;
  summary: string;
  status: string;
  domain: string;
  geography: string | null;
  audience: string | null;
  score: number | string;
  confidence: number | string;
  duplicateSimilarity: number | string | null;
  riskScore: number | string | null;
  scoreExplanationJson: string | null;
  rankPosition: number | string | null;
  selectionStatus: string | null;
  portfolioEffectJson: string | null;
  rankedAt: Date | null;
  totalScore: number | string | null;
  scoreExplanation: string | null;
  factorsJson: string | null;
  evidenceCount: number | bigint;
  handoffStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
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

function factorMap(raw: string | null): Record<string, number> {
  const obj = parseJson(raw);
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(obj)) {
    const n = Number(value);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

function isSelected(selectionStatus: string, status: string): boolean {
  const s = selectionStatus.toUpperCase();
  const st = status.toUpperCase();
  return (
    s === 'SELECTED' ||
    s === 'APPROVED' ||
    s === 'CHOSEN' ||
    s === 'SHORTLISTED' ||
    st === 'QUALIFIED' ||
    st === 'HANDED_OFF'
  );
}

function isReady(item: {
  selectionStatus: string;
  status: string;
  handoffStatus: string | null;
  rankPosition: number | null;
  measuredScore: boolean;
}): boolean {
  if (item.status === 'HANDED_OFF' || item.handoffStatus === 'ACKNOWLEDGED') return true;
  if (item.status === 'QUALIFIED' || item.status === 'VERIFIED') return true;
  if (isSelected(item.selectionStatus, item.status) && item.rankPosition != null) return true;
  return item.measuredScore && item.rankPosition != null && item.rankPosition <= 10;
}

function recommendedAction(
  selectionStatus: string,
  status: string,
  rankPosition: number | null,
  riskScore: number | null,
  explanation: Record<string, unknown>,
): RankingRecord['recommendedAction'] {
  const explicit = String(
    explanation.recommendedAction ?? explanation.selectionAction ?? '',
  ).toLowerCase();
  if (
    explicit === 'select' ||
    explicit === 'hold' ||
    explicit === 'defer' ||
    explicit === 'reject' ||
    explicit === 'handoff'
  ) {
    return explicit as RankingRecord['recommendedAction'];
  }
  if (status === 'HANDED_OFF' || selectionStatus.toUpperCase() === 'HANDED_OFF') return 'handoff';
  if (status === 'REJECTED' || status === 'BLOCKED' || selectionStatus.toUpperCase() === 'REJECTED') {
    return 'reject';
  }
  if (isSelected(selectionStatus, status)) return 'select';
  if (riskScore != null && riskScore >= 70) return 'defer';
  if (rankPosition != null && rankPosition <= 5) return 'select';
  if (rankPosition != null && rankPosition <= 15) return 'hold';
  return 'defer';
}

function nextStageFor(
  status: string,
  selectionStatus: string,
  handoffStatus: string | null,
  rankPosition: number | null,
): string {
  if (status === 'HANDED_OFF' || handoffStatus === 'ACKNOWLEDGED') {
    return 'Stage 03 – Idea Qualification (acknowledged)';
  }
  if (status === 'ARCHIVED') return 'Archived — excluded from selection';
  if (status === 'REJECTED' || status === 'BLOCKED') return 'Recovery / re-score required';
  if (isSelected(selectionStatus, status)) {
    return 'Ready for Stage 03 Idea Qualification handoff';
  }
  if (rankPosition != null) return 'Awaiting selection / approval';
  if (status === 'DISCOVERED' || status === 'ENRICHING') return 'Scoring in progress';
  return 'Awaiting rank assignment';
}

function uniquenessFrom(duplicateSimilarity: number | null): number | null {
  if (duplicateSimilarity == null) return null;
  return Math.max(0, Math.round(100 - Number(duplicateSimilarity)));
}

function deriveIssues(records: RankingRecord[]): RankingIssue[] {
  const issues: RankingIssue[] = [];
  const byRank = new Map<number, string[]>();

  for (const item of records) {
    if (item.rankPosition != null) {
      const list = byRank.get(item.rankPosition) ?? [];
      list.push(item.id);
      byRank.set(item.rankPosition, list);
    }
    if (item.status === 'BLOCKED' || item.status === 'REJECTED') {
      issues.push({
        id: `${item.id}-blocked`,
        severity: 'CRITICAL',
        code: 'SELECTION_BLOCKED',
        message: `“${item.title}” is ${item.status} and cannot advance.`,
        rankingId: item.id,
      });
    }
    if (item.rankPosition == null && item.measuredScore) {
      issues.push({
        id: `${item.id}-unranked`,
        severity: 'INFO',
        code: 'SCORED_UNRANKED',
        message: `“${item.title}” has a score but no rank position yet.`,
        rankingId: item.id,
      });
    }
    if (!item.measuredConfidence || (item.confidence ?? 0) < 40) {
      issues.push({
        id: `${item.id}-conf`,
        severity: 'WARNING',
        code: 'LOW_CONFIDENCE',
        message: `Low or unmeasured confidence on ranked candidate “${item.title}”.`,
        rankingId: item.id,
      });
    }
    if (item.riskScore != null && item.riskScore >= 70) {
      issues.push({
        id: `${item.id}-risk`,
        severity: 'WARNING',
        code: 'HIGH_RISK',
        message: `Elevated risk (${item.riskScore}) on “${item.title}”.`,
        rankingId: item.id,
      });
    }
  }

  for (const [rank, ids] of byRank) {
    if (ids.length > 1) {
      issues.push({
        id: `tie-${rank}`,
        severity: 'WARNING',
        code: 'RANK_TIE',
        message: `${ids.length} candidates share rank #${rank} — tie resolution needed.`,
        rankingId: ids[0],
      });
    }
  }

  return issues.slice(0, 40);
}

function scoreDistribution(records: RankingRecord[]) {
  const buckets = [
    { bucket: '0–19', min: 0, max: 20, count: 0 },
    { bucket: '20–39', min: 20, max: 40, count: 0 },
    { bucket: '40–59', min: 40, max: 60, count: 0 },
    { bucket: '60–79', min: 60, max: 80, count: 0 },
    { bucket: '80–100', min: 80, max: 101, count: 0 },
  ];
  for (const item of records) {
    if (!item.measuredScore) continue;
    const score = item.overallScore;
    const bucket = buckets.find((b) => score >= b.min && score < b.max);
    if (bucket) bucket.count += 1;
  }
  return buckets.map(({ bucket, count }) => ({ bucket, count }));
}

export async function loadRankingSelection(): Promise<RankingSelectionOverview> {
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

    const rows = await prisma.$queryRaw<RankingRow[]>`
      SELECT TOP 200
        CONVERT(varchar(36), o.id) AS opportunityId,
        CONVERT(varchar(36), rk.id) AS rankingId,
        o.title,
        o.summary,
        o.status,
        o.domain,
        o.geography,
        o.audience,
        o.score,
        o.confidence,
        o.duplicate_similarity AS duplicateSimilarity,
        o.risk_score AS riskScore,
        o.score_explanation_json AS scoreExplanationJson,
        rk.rank_position AS rankPosition,
        rk.selection_status AS selectionStatus,
        rk.portfolio_effect_json AS portfolioEffectJson,
        rk.ranked_at AS rankedAt,
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
        ) AS factorsJson,
        (
          SELECT COUNT(*)
          FROM ci_opportunity_signals os
          WHERE os.opportunity_id = o.id
        ) AS evidenceCount,
        (
          SELECT TOP 1 h.status
          FROM ci_handoffs h
          WHERE h.opportunity_id = o.id
          ORDER BY h.created_at DESC
        ) AS handoffStatus,
        o.created_at AS createdAt,
        o.updated_at AS updatedAt
      FROM ci_opportunities o
      OUTER APPLY (
        SELECT TOP 1
          r.id,
          r.rank_position,
          r.selection_status,
          r.portfolio_effect_json,
          r.ranked_at
        FROM ci_rankings r
        WHERE r.opportunity_id = o.id
        ORDER BY r.ranked_at DESC
      ) rk
      WHERE o.status <> 'ARCHIVED'
      ORDER BY
        CASE WHEN rk.rank_position IS NULL THEN 999999 ELSE rk.rank_position END ASC,
        CASE WHEN o.score IS NULL THEN 0 ELSE o.score END DESC,
        o.updated_at DESC
    `;

    const signalRows = await prisma.$queryRaw<
      Array<{ opportunityId: string; subject: string }>
    >`
      SELECT TOP 400
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
         OR action LIKE '%RANK%'
         OR action LIKE '%SCORE%'
         OR action LIKE '%SELECT%'
         OR action LIKE '%HANDOFF%'
         OR opportunity_id IS NOT NULL
      ORDER BY created_at DESC
    `;

    const subjectsByOpportunity = new Map<string, string[]>();
    for (const row of signalRows) {
      const list = subjectsByOpportunity.get(row.opportunityId) ?? [];
      if (list.length < 6) list.push(row.subject);
      subjectsByOpportunity.set(row.opportunityId, list);
    }

    const records: RankingRecord[] = rows.map((row) => {
      const factors = factorMap(row.factorsJson);
      const explanationObj = {
        ...parseJson(row.scoreExplanationJson),
        ...parseJson(row.portfolioEffectJson),
      };
      const portfolioEffect = parseJson(row.portfolioEffectJson);
      const overallScore =
        numOrNull(row.totalScore) ?? Number(row.score) ?? 0;
      const measuredScore = Number.isFinite(overallScore) && overallScore > 0;
      const confidence = numOrNull(row.confidence);
      const measuredConfidence = confidence != null && confidence >= 1;
      const duplicateSimilarity =
        row.duplicateSimilarity != null ? Number(row.duplicateSimilarity) : null;
      const rankPosition =
        row.rankPosition != null ? Number(row.rankPosition) : null;
      const selectionStatus = row.selectionStatus ?? 'UNRANKED';
      const riskScore = row.riskScore != null ? Number(row.riskScore) : null;

      const portfolioFit = numOrNull(
        portfolioEffect.portfolioFit ??
          portfolioEffect.fit ??
          factors.portfolioFit ??
          explanationObj.portfolioFit,
      );
      const portfolioImpact = numOrNull(
        portfolioEffect.portfolioImpact ??
          portfolioEffect.impact ??
          factors.portfolioImpact ??
          explanationObj.portfolioImpact,
      );

      return {
        id: row.opportunityId,
        rankingId: row.rankingId,
        opportunityId: row.opportunityId,
        title: row.title,
        summary: row.summary,
        domain: row.domain,
        audience: row.audience,
        geography: row.geography,
        status: row.status,
        rankPosition,
        selectionStatus,
        overallScore,
        measuredScore,
        confidence,
        measuredConfidence,
        demand: numOrNull(
          factors.audienceDemand ?? factors.demand ?? explanationObj.demandScore,
        ),
        uniqueness: uniquenessFrom(duplicateSimilarity),
        strategicFit: numOrNull(
          factors.strategicFit ??
            factors.strategicAlignment ??
            explanationObj.strategicFit,
        ),
        roi: numOrNull(factors.expectedRoi ?? factors.roi ?? explanationObj.expectedRoi),
        portfolioImpact,
        portfolioFit,
        evidenceQuality: numOrNull(
          factors.evidence ?? factors.evidenceQuality ?? explanationObj.evidenceQuality,
        ),
        priority: numOrNull(
          factors.priority ?? explanationObj.priority ?? rankPosition,
        ),
        duplicateSimilarity,
        riskScore,
        explanation:
          row.scoreExplanation ??
          strOrNull(explanationObj.explanation ?? portfolioEffect.explanation),
        scoreFactors: factors,
        portfolioEffect,
        evidenceCount: Number(row.evidenceCount ?? 0),
        evidenceSubjects: subjectsByOpportunity.get(row.opportunityId) ?? [],
        recommendedAction: recommendedAction(
          selectionStatus,
          row.status,
          rankPosition,
          riskScore,
          explanationObj,
        ),
        nextStage: nextStageFor(
          row.status,
          selectionStatus,
          row.handoffStatus,
          rankPosition,
        ),
        rankedAt: row.rankedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        handoffStatus: row.handoffStatus,
      };
    });

    const ranked = records.filter((item) => item.rankPosition != null).length;
    const selected = records.filter((item) =>
      isSelected(item.selectionStatus, item.status),
    ).length;
    const measuredScores = records.filter((item) => item.measuredScore);
    const avgAiScore =
      measuredScores.length > 0
        ? Math.round(
            measuredScores.reduce((sum, item) => sum + item.overallScore, 0) /
              measuredScores.length,
          )
        : null;
    const portfolioValues = records
      .map((item) => item.portfolioFit)
      .filter((value): value is number => value != null);
    const avgPortfolioFit =
      portfolioValues.length > 0
        ? Math.round(
            portfolioValues.reduce((sum, n) => sum + n, 0) / portfolioValues.length,
          )
        : null;
    const ready = records.filter((item) => isReady(item)).length;
    const blocked = records.filter(
      (item) => item.status === 'BLOCKED' || item.status === 'REJECTED',
    ).length;

    const rankCounts = new Map<number, number>();
    for (const item of records) {
      if (item.rankPosition == null) continue;
      rankCounts.set(item.rankPosition, (rankCounts.get(item.rankPosition) ?? 0) + 1);
    }
    const ties = [...rankCounts.values()].filter((count) => count > 1).length;

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
        candidates: records.length,
        ranked,
        selected,
        measuredAiScore: measuredScores.length,
        avgAiScore,
        measuredPortfolioFit: portfolioValues.length,
        avgPortfolioFit,
        ready,
        ties,
        blocked,
      },
      records,
      scoreDistribution: scoreDistribution(records),
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
          : 'Ranking & selection unavailable. Run the Content Intelligence migration.',
      metrics: {
        candidates: 0,
        ranked: 0,
        selected: 0,
        measuredAiScore: 0,
        avgAiScore: null,
        measuredPortfolioFit: 0,
        avgPortfolioFit: null,
        ready: 0,
        ties: 0,
        blocked: 0,
      },
      records: [],
      scoreDistribution: [],
      issues: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
