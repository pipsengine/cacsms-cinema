import { prisma } from '@/lib/db';
import type { FactorScores } from './contracts';
import { DEFAULT_WEIGHTS, rankCandidates, scoreCandidate } from './scoring';

export type RankingRecommendation =
  | 'Recommend for Production'
  | 'Hold for Portfolio Balance'
  | 'Defer'
  | 'Await Ranking'
  | 'Not Eligible';

export type RankingPriority = 'P1' | 'P2' | 'P3' | 'P4' | 'UNMEASURED';

export type RankingCandidate = {
  id: string;
  rankingId: string | null;
  title: string;
  summary: string;
  domain: string;
  audience: string | null;
  geography: string | null;
  formatHint: string | null;
  candidateStatus: string;
  gateStatus: string;
  decision: string | null;
  finalRank: number | null;
  compositeScore: number | null;
  strategicFit: number | null;
  audienceValue: number | null;
  originality: number | null;
  evidenceQuality: number | null;
  productionFeasibility: number | null;
  commercialPotential: number | null;
  riskLevel: number | null;
  confidence: number | null;
  measuredConfidence: boolean;
  priorityLevel: RankingPriority;
  recommendation: RankingRecommendation;
  productionReady: boolean;
  explainability: string[];
  rankingFactors: Array<{
    label: string;
    value: number | null;
    weight: number | null;
    contribution: number | null;
  }>;
  tieBreakers: string[];
  portfolioEffect: {
    diversityImpact: number | null;
    budgetFit: number | null;
    scheduleFit: number | null;
    resourceFit: number | null;
    estimatedRoi: number | null;
    notes: string[];
  };
  heatmap: Array<{ label: string; value: number | null }>;
  scenarios: Array<{ name: string; rank: number | null; score: number | null; note: string }>;
  sensitivity: Array<{ factor: string; delta: string; effect: string }>;
  lifecycle: Array<{ key: string; label: string; done: boolean; at: string | null }>;
  factors: Partial<FactorScores> | null;
  modelVersion: string | null;
  rankedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QualifiedRankingOverview = {
  available: boolean;
  reason?: string;
  meta: {
    cycleStatus: string;
    intakeStatus: string | null;
    modelVersions: string[];
    rankingModel: string;
    diversityCap: number;
  };
  metrics: {
    totalQualifiedIdeas: number;
    topRankedCandidates: number;
    productionReady: number;
    averageQualificationScore: number | null;
    aiConfidence: number | null;
    portfolioDiversity: number | null;
    estimatedRoi: number | null;
    recommendedForProduction: number;
    rankedCount: number;
    eligibleUnranked: number;
  };
  pipeline: Array<{
    key: string;
    label: string;
    state: 'pending' | 'active' | 'done' | 'failed';
  }>;
  weightModel: Array<{ key: string; label: string; weight: number }>;
  candidates: RankingCandidate[];
  comparison: Array<{
    id: string;
    title: string;
    rank: number | null;
    score: number | null;
    priority: RankingPriority;
  }>;
  recommendations: Array<{
    id: string;
    action: string;
    reason: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    candidateId?: string;
  }>;
  analytics: {
    priorityDistribution: Array<{ label: string; count: number }>;
    recommendationDistribution: Array<{ label: string; count: number }>;
    scoreDistribution: Array<{ label: string; count: number }>;
    domainDiversity: Array<{ label: string; count: number; avgScore: number | null }>;
    rankTimeline: Array<{ id: string; title: string; rank: number; rankedAt: string }>;
  };
  governance: {
    modelVersions: string[];
    decisionsLogged: number;
    auditEvents: number;
    rankingsPersisted: number;
    diversityCap: number;
  };
  notifications: Array<{
    id: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
  }>;
  audit: Array<{
    id: string;
    action: string;
    actorType: string;
    createdAt: string;
    reason: string | null;
  }>;
  lastUpdated: string;
};

const WEIGHT_LABELS: Record<keyof typeof DEFAULT_WEIGHTS, string> = {
  strategicFit: 'Strategy Alignment',
  evidence: 'Evidence Quality',
  audienceValue: 'Audience Value',
  originality: 'Originality',
  timeliness: 'Timeliness',
  educationalValue: 'Educational Value',
  regionalRelevance: 'Regional Relevance',
  visualPotential: 'Visual Potential',
  feasibility: 'Production Feasibility',
  sourceAvailability: 'Source Availability',
};

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, n) => sum + n, 0) / values.length);
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

function parseFactors(raw: string | null): Partial<FactorScores> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<FactorScores> = {};
    for (const key of [
      'strategicFit',
      'evidence',
      'audienceValue',
      'originality',
      'timeliness',
      'educationalValue',
      'regionalRelevance',
      'visualPotential',
      'feasibility',
      'sourceAvailability',
      'risk',
      'duplicateSimilarity',
    ] as const) {
      const v = num(parsed[key]);
      if (v != null) out[key] = v;
    }
    return out;
  } catch {
    return null;
  }
}

function parsePortfolio(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function nestedNum(meta: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = num(meta[key]);
    if (v != null) return v;
  }
  return null;
}

function nestedNotes(meta: Record<string, unknown>): string[] {
  const notes = meta.notes ?? meta.reasons ?? meta.effects;
  if (typeof notes === 'string') return [notes];
  if (Array.isArray(notes)) {
    return notes.filter((n): n is string => typeof n === 'string').slice(0, 6);
  }
  return [];
}

function isGatePassed(gateStatus: string): boolean {
  const s = gateStatus.toUpperCase();
  return s === 'PASSED' || s === 'PASS' || s === 'OK' || s === 'CLEARED';
}

function priorityFrom(rank: number | null, score: number | null): RankingPriority {
  if (rank == null && score == null) return 'UNMEASURED';
  if (rank != null) {
    if (rank <= 3) return 'P1';
    if (rank <= 8) return 'P2';
    if (rank <= 15) return 'P3';
    return 'P4';
  }
  if (score != null) {
    if (score >= 90) return 'P1';
    if (score >= 82) return 'P2';
    if (score >= 78) return 'P3';
    return 'P4';
  }
  return 'UNMEASURED';
}

function recommendationFor(
  eligible: boolean,
  rank: number | null,
  productionReady: boolean,
  heldForDiversity: boolean,
): RankingRecommendation {
  if (!eligible) return 'Not Eligible';
  if (rank == null) return 'Await Ranking';
  if (heldForDiversity) return 'Hold for Portfolio Balance';
  if (productionReady && rank <= 10) return 'Recommend for Production';
  if (rank > 10) return 'Defer';
  return productionReady ? 'Recommend for Production' : 'Defer';
}

function emptyOverview(reason: string, cycleStatus = 'UNAVAILABLE'): QualifiedRankingOverview {
  return {
    available: false,
    reason,
    meta: {
      cycleStatus,
      intakeStatus: null,
      modelVersions: [],
      rankingModel: 'portfolio-aware-v1',
      diversityCap: 2,
    },
    metrics: {
      totalQualifiedIdeas: 0,
      topRankedCandidates: 0,
      productionReady: 0,
      averageQualificationScore: null,
      aiConfidence: null,
      portfolioDiversity: null,
      estimatedRoi: null,
      recommendedForProduction: 0,
      rankedCount: 0,
      eligibleUnranked: 0,
    },
    pipeline: [],
    weightModel: (Object.keys(DEFAULT_WEIGHTS) as Array<keyof typeof DEFAULT_WEIGHTS>).map(
      (key) => ({
        key,
        label: WEIGHT_LABELS[key],
        weight: Math.round(DEFAULT_WEIGHTS[key] * 1000) / 10,
      }),
    ),
    candidates: [],
    comparison: [],
    recommendations: [],
    analytics: {
      priorityDistribution: [],
      recommendationDistribution: [],
      scoreDistribution: [],
      domainDiversity: [],
      rankTimeline: [],
    },
    governance: {
      modelVersions: [],
      decisionsLogged: 0,
      auditEvents: 0,
      rankingsPersisted: 0,
      diversityCap: 2,
    },
    notifications: [],
    audit: [],
    lastUpdated: new Date().toISOString(),
  };
}

export async function loadQualifiedRanking(): Promise<QualifiedRankingOverview> {
  try {
    await prisma.$queryRaw`SELECT TOP 1 id FROM iq_candidates`;
  } catch {
    return emptyOverview(
      'Idea Qualification tables unavailable. Run the Stage 03 migration.',
    );
  }

  try {
    const cycles = await prisma.$queryRaw<
      Array<{ id: string; status: string; startedAt: Date | null }>
    >`
      SELECT TOP 1
        CONVERT(varchar(36), id) AS id,
        status,
        started_at AS startedAt
      FROM iq_cycles
      ORDER BY started_at DESC
    `;

    const intakes = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT TOP 1 status FROM iq_intake_packages ORDER BY received_at DESC
    `;

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        summary: string;
        domain: string;
        audience: string | null;
        geography: string | null;
        formatHint: string | null;
        status: string;
        gateStatus: string;
        decision: string | null;
        confidence: number | string | null;
        createdAt: Date;
        updatedAt: Date;
        factorsJson: string | null;
        weightsJson: string | null;
        totalScore: number | string | null;
        scoreConfidence: number | string | null;
        modelVersion: string | null;
        scoredAt: Date | null;
        rankingId: string | null;
        rankPosition: number | string | null;
        portfolioEffectJson: string | null;
        rankedAt: Date | null;
      }>
    >`
      SELECT
        CONVERT(varchar(36), c.id) AS id,
        c.title,
        c.summary,
        c.domain,
        c.audience,
        c.geography,
        c.format_hint AS formatHint,
        c.status,
        c.gate_status AS gateStatus,
        c.decision,
        c.confidence,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt,
        s.factors_json AS factorsJson,
        s.weights_json AS weightsJson,
        s.total_score AS totalScore,
        s.confidence AS scoreConfidence,
        s.model_version AS modelVersion,
        s.scored_at AS scoredAt,
        CONVERT(varchar(36), r.id) AS rankingId,
        r.rank_position AS rankPosition,
        r.portfolio_effect_json AS portfolioEffectJson,
        r.ranked_at AS rankedAt
      FROM iq_candidates c
      OUTER APPLY (
        SELECT TOP 1 *
        FROM iq_scores sc
        WHERE sc.candidate_id = c.id
        ORDER BY sc.scored_at DESC
      ) s
      OUTER APPLY (
        SELECT TOP 1 *
        FROM iq_rankings rk
        WHERE rk.candidate_id = c.id
        ORDER BY rk.ranked_at DESC
      ) r
      ORDER BY
        CASE WHEN r.rank_position IS NULL THEN 1 ELSE 0 END,
        r.rank_position ASC,
        COALESCE(s.total_score, 0) DESC,
        c.updated_at DESC
    `;

    const decisionCount = await prisma.$queryRaw<Array<{ count: number | bigint }>>`
      SELECT COUNT(*) AS count FROM iq_decisions
    `;

    const rankingCount = await prisma.$queryRaw<Array<{ count: number | bigint }>>`
      SELECT COUNT(*) AS count FROM iq_rankings
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
      SELECT TOP 50
        CONVERT(varchar(36), id) AS id,
        action,
        actor_type AS actorType,
        created_at AS createdAt,
        reason
      FROM iq_audit_events
      WHERE action LIKE '%RANK%'
         OR action LIKE '%PORTFOLIO%'
         OR action LIKE '%PRIORIT%'
         OR action LIKE '%QUALIF%'
         OR action LIKE '%SELECT%'
         OR action LIKE '%GATE%'
      ORDER BY created_at DESC
    `;

    const diversityCap = 2;

    // Provisional portfolio-aware order for gate-passers without persisted ranks
    const provisionalPool = rows
      .filter((row) => isGatePassed(row.gateStatus))
      .map((row) => {
        const factors = parseFactors(row.factorsJson);
        let score = num(row.totalScore) ?? 0;
        if (
          !num(row.totalScore) &&
          factors &&
          (Object.keys(DEFAULT_WEIGHTS) as Array<keyof typeof DEFAULT_WEIGHTS>).every(
            (key) => factors[key] != null,
          )
        ) {
          score = scoreCandidate(factors as FactorScores);
        }
        return {
          id: row.id,
          score,
          gateStatus: 'PASSED',
          domain: row.domain,
          geography: row.geography ?? undefined,
        };
      });

    const provisionalOrdered = rankCandidates(provisionalPool, diversityCap);
    const provisionalRank = new Map<string, number>();
    provisionalOrdered.forEach((item, index) => {
      provisionalRank.set(item.id, index + 1);
    });
    const heldIds = new Set(
      provisionalPool
        .filter((item) => isGatePassed(item.gateStatus) && !provisionalRank.has(item.id))
        .map((item) => item.id),
    );

    const candidates: RankingCandidate[] = rows.map((row) => {
      const factors = parseFactors(row.factorsJson);
      const portfolioMeta = parsePortfolio(row.portfolioEffectJson);
      const confidence = num(row.scoreConfidence) ?? num(row.confidence);
      const measuredConfidence = confidence != null && confidence >= 1;

      let compositeScore = num(row.totalScore);
      if (
        compositeScore == null &&
        factors &&
        (Object.keys(DEFAULT_WEIGHTS) as Array<keyof typeof DEFAULT_WEIGHTS>).every(
          (key) => factors[key] != null,
        )
      ) {
        compositeScore = scoreCandidate(factors as FactorScores);
      }

      const persistedRank = num(row.rankPosition);
      const eligible = isGatePassed(row.gateStatus) || persistedRank != null;
      const heldForDiversity = heldIds.has(row.id) && persistedRank == null;
      const finalRank =
        persistedRank ??
        (eligible && provisionalRank.has(row.id) ? provisionalRank.get(row.id)! : null);

      const commercialPotential =
        nestedNum(portfolioMeta, ['commercialPotential', 'commercial']) ??
        (factors?.audienceValue != null && factors?.feasibility != null
          ? Math.round((factors.audienceValue * 0.6 + factors.feasibility * 0.4) * 100) / 100
          : factors?.audienceValue ?? null);

      const estimatedRoi = nestedNum(portfolioMeta, [
        'estimatedRoi',
        'roi',
        'expectedRoi',
        'roiEstimate',
      ]);

      const productionReady =
        eligible &&
        (factors?.feasibility != null ? factors.feasibility >= 70 : false) &&
        (factors?.risk != null ? factors.risk <= 30 : compositeScore != null && compositeScore >= 78) &&
        (compositeScore != null ? compositeScore >= 78 : false);

      const priorityLevel = priorityFrom(finalRank, compositeScore);
      const recommendation = recommendationFor(
        eligible,
        finalRank,
        productionReady,
        heldForDiversity,
      );

      const rankingFactors = (Object.keys(DEFAULT_WEIGHTS) as Array<keyof typeof DEFAULT_WEIGHTS>).map(
        (key) => {
          const value = factors?.[key] ?? null;
          const weight = Math.round(DEFAULT_WEIGHTS[key] * 1000) / 10;
          const contribution =
            value != null ? Math.round(value * DEFAULT_WEIGHTS[key] * 100) / 100 : null;
          return {
            label: WEIGHT_LABELS[key],
            value,
            weight,
            contribution,
          };
        },
      );

      const explainability: string[] = [];
      if (!eligible) {
        explainability.push('Not eligible — mandatory gates not passed');
      } else if (persistedRank != null) {
        explainability.push(`Persisted rank #${persistedRank} from iq_rankings`);
      } else if (finalRank != null) {
        explainability.push(
          `Provisional portfolio-aware rank #${finalRank} from gate-pass score order (diversity cap ${diversityCap})`,
        );
      } else if (heldForDiversity) {
        explainability.push(
          `Held for portfolio balance — domain/geography diversity cap (${diversityCap}) already filled by higher scores`,
        );
      } else {
        explainability.push('Awaiting autonomous ranking persistence');
      }
      if (compositeScore != null) explainability.push(`Composite score ${compositeScore}`);
      if (confidence != null) explainability.push(`AI confidence ${confidence}%`);
      for (const factor of rankingFactors
        .filter((f) => f.contribution != null)
        .sort((a, b) => (b.contribution ?? 0) - (a.contribution ?? 0))
        .slice(0, 3)) {
        explainability.push(
          `${factor.label} contributes ${factor.contribution} (weight ${factor.weight}%)`,
        );
      }
      if (estimatedRoi != null) explainability.push(`Estimated ROI ${estimatedRoi}`);

      const tieBreakers = [
        'Higher composite score wins',
        'Then higher AI confidence',
        'Then lower risk factor',
        'Then earlier scored_at',
        `Portfolio diversity cap ${diversityCap} per domain|geography`,
      ];

      const heatmap = [
        { label: 'Strategy', value: factors?.strategicFit ?? null },
        { label: 'Evidence', value: factors?.evidence ?? null },
        { label: 'Audience', value: factors?.audienceValue ?? null },
        { label: 'Originality', value: factors?.originality ?? null },
        { label: 'Feasibility', value: factors?.feasibility ?? null },
        { label: 'Commercial', value: commercialPotential },
        { label: 'Risk', value: factors?.risk ?? null },
        { label: 'Confidence', value: confidence },
      ];

      const scenarios: RankingCandidate['scenarios'] = [
        {
          name: 'Baseline (current weights)',
          rank: finalRank,
          score: compositeScore,
          note: persistedRank != null ? 'Persisted ranking' : 'Current model',
        },
        {
          name: 'Audience-weighted tilt',
          rank: null,
          score:
            factors?.audienceValue != null && compositeScore != null
              ? Math.round((compositeScore * 0.7 + factors.audienceValue * 0.3) * 100) / 100
              : null,
          note:
            factors?.audienceValue != null
              ? 'Derived preview from persisted audienceValue — not a persisted scenario'
              : 'UNMEASURED — audienceValue missing',
        },
        {
          name: 'Risk-averse tilt',
          rank: null,
          score:
            factors?.risk != null && compositeScore != null
              ? Math.round((compositeScore * 0.8 + (100 - factors.risk) * 0.2) * 100) / 100
              : null,
          note:
            factors?.risk != null
              ? 'Derived preview from persisted risk — not a persisted scenario'
              : 'UNMEASURED — risk missing',
        },
      ];

      const sensitivity: RankingCandidate['sensitivity'] = [
        {
          factor: 'strategicFit ±5',
          delta: '±5',
          effect:
            factors?.strategicFit != null
              ? `Contribution shifts ~${Math.round(5 * DEFAULT_WEIGHTS.strategicFit * 100) / 100}`
              : 'UNMEASURED',
        },
        {
          factor: 'audienceValue ±5',
          delta: '±5',
          effect:
            factors?.audienceValue != null
              ? `Contribution shifts ~${Math.round(5 * DEFAULT_WEIGHTS.audienceValue * 100) / 100}`
              : 'UNMEASURED',
        },
        {
          factor: 'risk ±5',
          delta: '±5',
          effect:
            factors?.risk != null
              ? 'May change priority / production-ready band'
              : 'UNMEASURED',
        },
      ];

      const createdAt = row.createdAt.toISOString();
      const updatedAt = row.updatedAt.toISOString();
      const rankedAt = row.rankedAt?.toISOString() ?? null;

      return {
        id: row.id,
        rankingId: row.rankingId,
        title: row.title,
        summary: row.summary,
        domain: row.domain,
        audience: row.audience,
        geography: row.geography,
        formatHint: row.formatHint,
        candidateStatus: row.status,
        gateStatus: row.gateStatus,
        decision: row.decision,
        finalRank,
        compositeScore,
        strategicFit: factors?.strategicFit ?? null,
        audienceValue: factors?.audienceValue ?? null,
        originality: factors?.originality ?? null,
        evidenceQuality: factors?.evidence ?? null,
        productionFeasibility: factors?.feasibility ?? null,
        commercialPotential,
        riskLevel: factors?.risk ?? null,
        confidence,
        measuredConfidence,
        priorityLevel,
        recommendation,
        productionReady,
        explainability,
        rankingFactors,
        tieBreakers,
        portfolioEffect: {
          diversityImpact: nestedNum(portfolioMeta, ['diversityImpact', 'diversity']),
          budgetFit: nestedNum(portfolioMeta, ['budgetFit', 'budget']),
          scheduleFit: nestedNum(portfolioMeta, ['scheduleFit', 'schedule']),
          resourceFit: nestedNum(portfolioMeta, ['resourceFit', 'resources', 'resourceAvailability']),
          estimatedRoi,
          notes: nestedNotes(portfolioMeta),
        },
        heatmap,
        scenarios,
        sensitivity,
        lifecycle: [
          {
            key: 'gates',
            label: 'Mandatory gates passed',
            done: isGatePassed(row.gateStatus),
            at: isGatePassed(row.gateStatus) ? updatedAt : null,
          },
          {
            key: 'score',
            label: 'Composite score ready',
            done: compositeScore != null,
            at: row.scoredAt?.toISOString() ?? null,
          },
          {
            key: 'weights',
            label: 'Weighted model applied',
            done: compositeScore != null,
            at: row.scoredAt?.toISOString() ?? null,
          },
          {
            key: 'portfolio',
            label: 'Portfolio balancing',
            done: persistedRank != null || heldForDiversity || finalRank != null,
            at: rankedAt ?? (finalRank != null ? updatedAt : null),
          },
          {
            key: 'rank',
            label: 'Final rank assigned',
            done: finalRank != null,
            at: rankedAt ?? (finalRank != null ? updatedAt : null),
          },
          {
            key: 'forward',
            label: 'Forward to Decision Register',
            done: recommendation === 'Recommend for Production',
            at: recommendation === 'Recommend for Production' ? updatedAt : null,
          },
        ],
        factors,
        modelVersion: row.modelVersion,
        rankedAt,
        createdAt,
        updatedAt,
      };
    });

    // Surface gate-passers and ranked items first in UI metrics
    const qualified = candidates.filter(
      (c) => isGatePassed(c.gateStatus) || c.finalRank != null,
    );
    const ranked = candidates.filter((c) => c.finalRank != null);
    const productionReady = candidates.filter((c) => c.productionReady).length;
    const recommendedForProduction = candidates.filter(
      (c) => c.recommendation === 'Recommend for Production',
    ).length;
    const topRankedCandidates = ranked.filter((c) => (c.finalRank ?? 999) <= 5).length;
    const eligibleUnranked = candidates.filter(
      (c) => isGatePassed(c.gateStatus) && c.finalRank == null,
    ).length;

    const domains = new Map<string, number[]>();
    for (const c of qualified) {
      const list = domains.get(c.domain) ?? [];
      if (c.compositeScore != null) list.push(c.compositeScore);
      else list.push(0);
      domains.set(c.domain, list);
    }
    const portfolioDiversity = pct(domains.size, Math.max(qualified.length, 1));

    const estimatedRoi = avg(
      candidates
        .map((c) => c.portfolioEffect.estimatedRoi)
        .filter((v): v is number => v != null),
    );

    const recommendations: QualifiedRankingOverview['recommendations'] = [];
    for (const item of ranked.slice(0, 12)) {
      recommendations.push({
        id: `rank-${item.id}`,
        action: item.recommendation,
        reason: `${item.title} · rank #${item.finalRank} · score ${item.compositeScore ?? 'UNMEAS.'}`,
        priority:
          item.recommendation === 'Recommend for Production'
            ? 'HIGH'
            : item.recommendation === 'Hold for Portfolio Balance'
              ? 'MEDIUM'
              : 'LOW',
        candidateId: item.id,
      });
    }
    for (const item of candidates.filter((c) => c.recommendation === 'Hold for Portfolio Balance').slice(0, 4)) {
      recommendations.push({
        id: `hold-${item.id}`,
        action: 'Hold for Portfolio Balance',
        reason: `${item.title} deferred by diversity cap on ${item.domain}`,
        priority: 'MEDIUM',
        candidateId: item.id,
      });
    }

    const notifications: QualifiedRankingOverview['notifications'] = [];
    for (const item of candidates.slice(0, 14)) {
      if (item.recommendation === 'Recommend for Production') {
        notifications.push({
          id: `prod-${item.id}`,
          severity: 'INFO',
          message: `Recommended for production / Decision Register: #${item.finalRank} ${item.title}`,
        });
      }
      if (item.recommendation === 'Hold for Portfolio Balance') {
        notifications.push({
          id: `bal-${item.id}`,
          severity: 'WARNING',
          message: `Portfolio balance hold: ${item.title} (${item.domain})`,
        });
      }
      if (item.recommendation === 'Not Eligible') {
        // skip noise for large ineligible pools
      } else if (item.recommendation === 'Await Ranking' && isGatePassed(item.gateStatus)) {
        notifications.push({
          id: `await-${item.id}`,
          severity: 'WARNING',
          message: `Gate-passed, awaiting rank: ${item.title}`,
        });
      }
    }

    const modelVersions = [
      ...new Set(
        candidates.map((c) => c.modelVersion).filter((v): v is string => Boolean(v)),
      ),
    ];

    const hasRanks = ranked.length > 0;
    const pipeline = [
      { key: 'gates', label: 'Gate Filter' },
      { key: 'score', label: 'Composite Scores' },
      { key: 'weights', label: 'Weighted Model' },
      { key: 'diversity', label: 'Portfolio Diversity' },
      { key: 'constraints', label: 'Budget / Schedule / Resources' },
      { key: 'tiebreak', label: 'Tie-break Logic' },
      { key: 'rank', label: 'Assign Final Rank' },
      { key: 'explain', label: 'Explainability' },
      { key: 'rerank', label: 'Auto Re-rank' },
      { key: 'forward', label: 'Decision Register' },
    ].map((item, index) => {
      let state: 'pending' | 'active' | 'done' | 'failed' = 'pending';
      if (recommendedForProduction > 0 && index <= 9) state = 'done';
      else if (hasRanks && index <= 7) state = 'done';
      else if (hasRanks && index === 8) state = 'active';
      else if (qualified.length && index <= 1) state = 'done';
      else if (qualified.length && index === 2) state = 'active';
      else if (rows.length && index === 0) state = 'active';
      return { ...item, state };
    });

    const priorityDistribution = ['P1', 'P2', 'P3', 'P4', 'UNMEASURED'].map((label) => ({
      label,
      count: candidates.filter((c) => c.priorityLevel === label).length,
    }));

    const recommendationDistribution = new Map<string, number>();
    for (const item of candidates) {
      recommendationDistribution.set(
        item.recommendation,
        (recommendationDistribution.get(item.recommendation) ?? 0) + 1,
      );
    }

    const scoreDistribution = [
      {
        label: '90+',
        count: candidates.filter((c) => (c.compositeScore ?? -1) >= 90).length,
      },
      {
        label: '82–89',
        count: candidates.filter(
          (c) => (c.compositeScore ?? -1) >= 82 && (c.compositeScore ?? -1) < 90,
        ).length,
      },
      {
        label: '78–81',
        count: candidates.filter(
          (c) => (c.compositeScore ?? -1) >= 78 && (c.compositeScore ?? -1) < 82,
        ).length,
      },
      {
        label: '<78',
        count: candidates.filter(
          (c) => c.compositeScore != null && c.compositeScore < 78,
        ).length,
      },
      {
        label: 'UNMEASURED',
        count: candidates.filter((c) => c.compositeScore == null).length,
      },
    ];

    const domainDiversity = [...domains.entries()]
      .map(([label, scores]) => ({
        label,
        count: scores.length,
        avgScore: avg(scores.filter((s) => s > 0)),
      }))
      .sort((a, b) => b.count - a.count);

    const rankTimeline = ranked
      .filter((c) => c.finalRank != null)
      .sort((a, b) => (a.finalRank ?? 0) - (b.finalRank ?? 0))
      .slice(0, 20)
      .map((c) => ({
        id: c.id,
        title: c.title,
        rank: c.finalRank!,
        rankedAt: c.rankedAt ?? c.updatedAt,
      }));

    return {
      available: true,
      meta: {
        cycleStatus: cycles[0]?.status ?? 'NOT_STARTED',
        intakeStatus: intakes[0]?.status ?? null,
        modelVersions,
        rankingModel: 'portfolio-aware-v1',
        diversityCap,
      },
      metrics: {
        totalQualifiedIdeas: qualified.length,
        topRankedCandidates,
        productionReady,
        averageQualificationScore: avg(
          qualified
            .map((c) => c.compositeScore)
            .filter((v): v is number => v != null),
        ),
        aiConfidence: avg(
          qualified.map((c) => c.confidence).filter((v): v is number => v != null),
        ),
        portfolioDiversity,
        estimatedRoi,
        recommendedForProduction,
        rankedCount: ranked.length,
        eligibleUnranked,
      },
      pipeline,
      weightModel: (Object.keys(DEFAULT_WEIGHTS) as Array<keyof typeof DEFAULT_WEIGHTS>).map(
        (key) => ({
          key,
          label: WEIGHT_LABELS[key],
          weight: Math.round(DEFAULT_WEIGHTS[key] * 1000) / 10,
        }),
      ),
      candidates,
      comparison: ranked.slice(0, 8).map((c) => ({
        id: c.id,
        title: c.title,
        rank: c.finalRank,
        score: c.compositeScore,
        priority: c.priorityLevel,
      })),
      recommendations,
      analytics: {
        priorityDistribution,
        recommendationDistribution: [...recommendationDistribution.entries()].map(
          ([label, count]) => ({ label, count }),
        ),
        scoreDistribution,
        domainDiversity,
        rankTimeline,
      },
      governance: {
        modelVersions,
        decisionsLogged: Number(decisionCount[0]?.count ?? 0),
        auditEvents: auditRows.length,
        rankingsPersisted: Number(rankingCount[0]?.count ?? 0),
        diversityCap,
      },
      notifications,
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
    return emptyOverview(
      error instanceof Error ? error.message : 'Failed to load qualified ranking',
      'ERROR',
    );
  }
}
