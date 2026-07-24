import { prisma } from '@/lib/db';
import { DEFAULT_WEIGHTS, absoluteGates } from '@/lib/content-intelligence/scoring';

export type ScoringRecommendation =
  | 'immediate_production'
  | 'fast_track'
  | 'research_more'
  | 'needs_verification'
  | 'wait'
  | 'archive'
  | 'reject';

export type OpportunityScoreRecord = {
  id: string;
  scoreId: string | null;
  opportunityId: string;
  title: string;
  summary: string;
  domain: string;
  audience: string | null;
  geography: string | null;
  status: string;
  opportunityScore: number;
  measuredScore: boolean;
  confidence: number | null;
  measuredConfidence: boolean;
  evidenceConfidence: number | null;
  businessImpact: number | null;
  audienceDemand: number | null;
  productionReadiness: number | null;
  strategicAlignment: number | null;
  trend: number | null;
  novelty: number | null;
  competition: number | null;
  seo: number | null;
  evidenceQuality: number | null;
  portfolioFit: number | null;
  productionCost: number | null;
  risk: number | null;
  roi: number | null;
  factors: Record<string, number>;
  weights: Record<string, number>;
  contributions: Array<{ factor: string; weight: number; value: number; contribution: number }>;
  positiveFactors: string[];
  negativeFactors: string[];
  missingEvidence: string[];
  gateStatus: string | null;
  gateFailures: string[];
  explanation: string | null;
  modelVersion: string | null;
  recommendation: ScoringRecommendation;
  recommendationReason: string;
  rankPreview: number | null;
  evidenceCount: number;
  evidenceSubjects: string[];
  verificationPassed: number;
  verificationFailed: number;
  scoredAt: string | null;
  createdAt: string;
  updatedAt: string;
  history: Array<{
    scoreId: string;
    totalScore: number;
    gateStatus: string;
    modelVersion: string;
    scoredAt: string;
    explanation: string | null;
  }>;
};

export type ScoringIssue = {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  code: string;
  message: string;
  opportunityId?: string;
};

export type PipelineNode = {
  key: string;
  label: string;
  recordsProcessed: number;
  durationMs: number | null;
  aiConfidence: number | null;
  successRate: number | null;
  failures: number;
  retries: number | null;
  state: 'pending' | 'active' | 'done' | 'failed';
};

export type OpportunityScoringOverview = {
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
  meta: {
    lastScoringCycle: string | null;
    avgConfidence: number | null;
    scoringModelVersion: string | null;
    aiModel: string | null;
    processingRate: number | null;
    queueStatus: string;
  };
  metrics: {
    awaitingScoring: number;
    scored: number;
    avgOpportunityScore: number | null;
    highestScore: number | null;
    lowestScore: number | null;
    aiConfidence: number | null;
    measuredAiConfidence: number;
    evidenceConfidence: number | null;
    measuredEvidenceConfidence: number;
    businessImpact: number | null;
    measuredBusinessImpact: number;
    audienceDemand: number | null;
    measuredAudienceDemand: number;
    productionReadiness: number | null;
    measuredProductionReadiness: number;
    strategicAlignment: number | null;
    measuredStrategicAlignment: number;
    readyForRanking: number;
  };
  thresholds: {
    minimumScore: number;
    minimumConfidence: number;
    minimumEvidence: number;
    maximumRisk: number;
    minimumAudienceDemand: number;
    maximumCompetition: number;
    minimumStrategicFit: number;
    minimumBusinessImpact: number;
    minimumRoi: number;
    source: 'platform_defaults';
  };
  formulaFactors: string[];
  defaultWeights: Record<string, number>;
  pipeline: PipelineNode[];
  scoreDistribution: Array<{ band: string; label: string; min: number; max: number; count: number }>;
  records: OpportunityScoreRecord[];
  issues: ScoringIssue[];
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
  score: number | string;
  confidence: number | string;
  riskScore: number | string | null;
  scoreExplanationJson: string | null;
  createdAt: Date;
  updatedAt: Date;
  evidenceCount: number | bigint;
  verificationPassed: number | bigint;
  verificationFailed: number | bigint;
  rankPreview: number | string | null;
  scoreId: string | null;
  modelVersion: string | null;
  factorsJson: string | null;
  weightsJson: string | null;
  totalScore: number | string | null;
  gateStatus: string | null;
  explanation: string | null;
  scoredAt: Date | null;
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

function factorMap(raw: string | null): Record<string, number> {
  const obj = parseJson(raw);
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(obj)) {
    const n = Number(value);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

function weightMap(raw: string | null): Record<string, number> {
  const parsed = factorMap(raw);
  if (Object.keys(parsed).length) return parsed;
  return { ...DEFAULT_WEIGHTS };
}

function pickFactor(
  factors: Record<string, number>,
  explanation: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    if (factors[key] != null) return factors[key];
    const fromExplanation = numOrNull(explanation[key]);
    if (fromExplanation != null) return fromExplanation;
  }
  return null;
}

function contributionsFrom(
  factors: Record<string, number>,
  weights: Record<string, number>,
): Array<{ factor: string; weight: number; value: number; contribution: number }> {
  const rows: Array<{ factor: string; weight: number; value: number; contribution: number }> = [];
  for (const [factor, weight] of Object.entries(weights)) {
    const value = factors[factor];
    if (value == null) continue;
    rows.push({
      factor,
      weight,
      value,
      contribution: Math.round(value * weight * 100) / 100,
    });
  }
  return rows.sort((a, b) => b.contribution - a.contribution);
}

function recommendationFor(
  score: number,
  measured: boolean,
  gateStatus: string | null,
  gateFailures: string[],
  evidenceCount: number,
  verificationFailed: number,
): { recommendation: ScoringRecommendation; reason: string } {
  const gate = (gateStatus ?? '').toUpperCase();
  if (gate === 'FAILED' || gate === 'REJECTED' || gateFailures.length > 0) {
    return {
      recommendation: 'reject',
      reason: `Gate ${gate || 'FAILED'}${gateFailures.length ? ` (${gateFailures.join(', ')})` : ''}.`,
    };
  }
  if (!measured) {
    return {
      recommendation: 'wait',
      reason: 'No measured opportunity score persisted yet.',
    };
  }
  if (verificationFailed > 0) {
    return {
      recommendation: 'needs_verification',
      reason: `${verificationFailed} failed verification check(s).`,
    };
  }
  if (evidenceCount === 0) {
    return {
      recommendation: 'research_more',
      reason: 'No linked evidence signals for this candidate.',
    };
  }
  if (score >= 90) {
    return { recommendation: 'immediate_production', reason: 'Elite score band (90–100).' };
  }
  if (score >= 80) {
    return { recommendation: 'fast_track', reason: 'Excellent score band (80–89).' };
  }
  if (score >= 70) {
    return { recommendation: 'fast_track', reason: 'Good score band (70–79).' };
  }
  if (score >= 60) {
    return { recommendation: 'research_more', reason: 'Moderate score — strengthen evidence before ranking.' };
  }
  if (score >= 40) {
    return { recommendation: 'wait', reason: 'Weak score band (40–59).' };
  }
  return { recommendation: 'archive', reason: 'Below reject threshold (<40).' };
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, n) => sum + n, 0) / values.length);
}

function deriveIssues(records: OpportunityScoreRecord[]): ScoringIssue[] {
  const issues: ScoringIssue[] = [];
  for (const item of records) {
    if (!item.measuredScore) {
      issues.push({
        id: `${item.id}-await`,
        severity: 'INFO',
        code: 'AWAITING_SCORE',
        message: `“${item.title}” is awaiting autonomous scoring.`,
        opportunityId: item.id,
      });
    }
    if (item.gateFailures.length) {
      issues.push({
        id: `${item.id}-gate`,
        severity: 'CRITICAL',
        code: 'THRESHOLD_FAILURE',
        message: `Gate failures on “${item.title}”: ${item.gateFailures.join(', ')}.`,
        opportunityId: item.id,
      });
    }
    if (item.measuredConfidence && (item.confidence ?? 0) < 40) {
      issues.push({
        id: `${item.id}-conf`,
        severity: 'WARNING',
        code: 'LOW_CONFIDENCE',
        message: `Low AI confidence on “${item.title}”.`,
        opportunityId: item.id,
      });
    }
    if (item.evidenceCount === 0 && item.measuredScore) {
      issues.push({
        id: `${item.id}-evidence`,
        severity: 'WARNING',
        code: 'MISSING_EVIDENCE',
        message: `Scored “${item.title}” has no linked evidence signals.`,
        opportunityId: item.id,
      });
    }
    if (item.recommendation === 'immediate_production' || item.recommendation === 'fast_track') {
      issues.push({
        id: `${item.id}-top`,
        severity: 'INFO',
        code: 'TOP_SCORED',
        message: `Top-scored candidate “${item.title}” (${item.opportunityScore}).`,
        opportunityId: item.id,
      });
    }
  }
  return issues.slice(0, 50);
}

const FORMULA_FACTORS = [
  'audienceDemand',
  'searchVolume',
  'trendVelocity',
  'competition',
  'novelty',
  'evidence',
  'strategicFit',
  'productionCost',
  'productionDifficulty',
  'commercialPotential',
  'educationalValue',
  'brandAlignment',
  'authority',
  'evergreenPotential',
  'virality',
  'seoOpportunity',
  'engagementPrediction',
  'completionPrediction',
  'knowledgeGapScore',
  'portfolioBalance',
  'resourceAvailability',
  'expectedRoi',
  'legalRisk',
  'sensitivityRisk',
  'contentSafety',
  'regionalRelevance',
  'freshness',
  'recency',
  'sourceReliability',
  'socialInterest',
  'historicalPerformance',
  'aiConfidence',
  'originality',
  'timeliness',
  'visualPotential',
  'feasibility',
  'risk',
];

export async function loadOpportunityScoring(): Promise<OpportunityScoringOverview> {
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
        o.score,
        o.confidence,
        o.risk_score AS riskScore,
        o.score_explanation_json AS scoreExplanationJson,
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
        ) AS rankPreview,
        CONVERT(varchar(36), s.id) AS scoreId,
        s.model_version AS modelVersion,
        s.factors_json AS factorsJson,
        s.weights_json AS weightsJson,
        s.total_score AS totalScore,
        s.gate_status AS gateStatus,
        s.explanation,
        s.scored_at AS scoredAt
      FROM ci_opportunities o
      OUTER APPLY (
        SELECT TOP 1 *
        FROM ci_scores sc
        WHERE sc.opportunity_id = o.id
        ORDER BY sc.scored_at DESC
      ) s
      WHERE o.status <> 'ARCHIVED'
      ORDER BY
        CASE WHEN s.total_score IS NULL THEN 0 ELSE s.total_score END DESC,
        o.updated_at DESC
    `;

    const historyRows = await prisma.$queryRaw<
      Array<{
        scoreId: string;
        opportunityId: string;
        totalScore: number | string;
        gateStatus: string;
        modelVersion: string;
        scoredAt: Date;
        explanation: string | null;
      }>
    >`
      SELECT TOP 400
        CONVERT(varchar(36), id) AS scoreId,
        CONVERT(varchar(36), opportunity_id) AS opportunityId,
        total_score AS totalScore,
        gate_status AS gateStatus,
        model_version AS modelVersion,
        scored_at AS scoredAt,
        explanation
      FROM ci_scores
      ORDER BY scored_at DESC
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
         OR action LIKE '%SCORE%'
         OR action LIKE '%RANK%'
         OR opportunity_id IS NOT NULL
      ORDER BY created_at DESC
    `;

    const subjectsByOpportunity = new Map<string, string[]>();
    for (const row of signalRows) {
      const list = subjectsByOpportunity.get(row.opportunityId) ?? [];
      if (list.length < 8) list.push(row.subject);
      subjectsByOpportunity.set(row.opportunityId, list);
    }

    const historyByOpportunity = new Map<
      string,
      OpportunityScoreRecord['history']
    >();
    for (const row of historyRows) {
      const list = historyByOpportunity.get(row.opportunityId) ?? [];
      if (list.length < 12) {
        list.push({
          scoreId: row.scoreId,
          totalScore: Number(row.totalScore),
          gateStatus: row.gateStatus,
          modelVersion: row.modelVersion,
          scoredAt: row.scoredAt.toISOString(),
          explanation: row.explanation,
        });
      }
      historyByOpportunity.set(row.opportunityId, list);
    }

    const records: OpportunityScoreRecord[] = rows.map((row) => {
      const explanationObj = parseJson(row.scoreExplanationJson);
      const factors = factorMap(row.factorsJson);
      const weights = weightMap(row.weightsJson);
      const opportunityScore =
        numOrNull(row.totalScore) ?? Number(row.score) ?? 0;
      const measuredScore =
        row.scoreId != null && Number.isFinite(opportunityScore) && opportunityScore > 0;
      const confidence = numOrNull(row.confidence);
      const measuredConfidence = confidence != null && confidence >= 1;
      const evidenceQuality = pickFactor(factors, explanationObj, [
        'evidence',
        'evidenceQuality',
        'sourceReliability',
      ]);
      const risk =
        pickFactor(factors, explanationObj, ['risk', 'legalRisk', 'sensitivityRisk']) ??
        (row.riskScore != null ? Number(row.riskScore) : null);
      const strategicFit = pickFactor(factors, explanationObj, [
        'strategicFit',
        'strategicAlignment',
      ]);
      const audienceDemand = pickFactor(factors, explanationObj, [
        'audienceDemand',
        'demand',
        'searchVolume',
      ]);

      const gateFailures: string[] = [];
      if (
        factors.strategicFit != null &&
        factors.evidence != null &&
        factors.duplicateSimilarity != null &&
        factors.risk != null
      ) {
        const gates = absoluteGates({
          strategicFit: factors.strategicFit,
          evidence: factors.evidence,
          audienceDemand: factors.audienceDemand ?? 0,
          originality: factors.originality ?? 0,
          timeliness: factors.timeliness ?? 0,
          visualPotential: factors.visualPotential ?? 0,
          feasibility: factors.feasibility ?? 0,
          regionalRelevance: factors.regionalRelevance ?? 0,
          risk: factors.risk,
          duplicateSimilarity: factors.duplicateSimilarity,
        });
        if (!gates.passed) gateFailures.push(...gates.failures);
      }
      if ((row.gateStatus ?? '').toUpperCase() === 'FAILED') {
        if (!gateFailures.length) gateFailures.push('GATE_FAILED');
      }

      const contributions = contributionsFrom(factors, weights);
      const positiveFactors = contributions
        .filter((item) => item.contribution > 0)
        .slice(0, 6)
        .map((item) => `${item.factor} (+${item.contribution})`);
      const negativeFactors = Object.entries(factors)
        .filter(([key, value]) => {
          const lower = key.toLowerCase();
          return (
            (lower.includes('risk') || lower.includes('competition') || lower.includes('cost')) &&
            value >= 60
          );
        })
        .slice(0, 6)
        .map(([key, value]) => `${key} (${value})`);

      const missingEvidence: string[] = [];
      if (Number(row.evidenceCount ?? 0) === 0) missingEvidence.push('linked_signals');
      for (const required of ['evidence', 'audienceDemand', 'strategicFit'] as const) {
        if (factors[required] == null && pickFactor(factors, explanationObj, [required]) == null) {
          missingEvidence.push(required);
        }
      }

      const { recommendation, reason } = recommendationFor(
        opportunityScore,
        measuredScore,
        row.gateStatus,
        gateFailures,
        Number(row.evidenceCount ?? 0),
        Number(row.verificationFailed ?? 0),
      );

      return {
        id: row.id,
        scoreId: row.scoreId,
        opportunityId: row.id,
        title: row.title,
        summary: row.summary,
        domain: row.domain,
        audience: row.audience,
        geography: row.geography,
        status: row.status,
        opportunityScore,
        measuredScore,
        confidence,
        measuredConfidence,
        evidenceConfidence: evidenceQuality,
        businessImpact: pickFactor(factors, explanationObj, [
          'businessImpact',
          'commercialPotential',
          'expectedRoi',
          'predictedPerformance',
        ]),
        audienceDemand,
        productionReadiness: pickFactor(factors, explanationObj, [
          'feasibility',
          'productionReadiness',
          'visualPotential',
        ]),
        strategicAlignment: strategicFit,
        trend: pickFactor(factors, explanationObj, ['trendStrength', 'timeliness', 'trendVelocity']),
        novelty: pickFactor(factors, explanationObj, ['novelty', 'originality']),
        competition: pickFactor(factors, explanationObj, [
          'competition',
          'competitorSaturation',
        ]),
        seo: pickFactor(factors, explanationObj, ['seoOpportunity', 'seo']),
        evidenceQuality,
        portfolioFit: pickFactor(factors, explanationObj, [
          'portfolioFit',
          'portfolioBalance',
        ]),
        productionCost: pickFactor(factors, explanationObj, [
          'productionCost',
          'resourceAvailability',
        ]),
        risk,
        roi: pickFactor(factors, explanationObj, ['expectedRoi', 'roi']),
        factors,
        weights,
        contributions,
        positiveFactors,
        negativeFactors,
        missingEvidence,
        gateStatus: row.gateStatus,
        gateFailures,
        explanation: row.explanation,
        modelVersion: row.modelVersion,
        recommendation,
        recommendationReason: reason,
        rankPreview: row.rankPreview != null ? Number(row.rankPreview) : null,
        evidenceCount: Number(row.evidenceCount ?? 0),
        evidenceSubjects: subjectsByOpportunity.get(row.id) ?? [],
        verificationPassed: Number(row.verificationPassed ?? 0),
        verificationFailed: Number(row.verificationFailed ?? 0),
        scoredAt: row.scoredAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        history: historyByOpportunity.get(row.id) ?? [],
      };
    });

    const scored = records.filter((item) => item.measuredScore);
    const awaiting = records.filter((item) => !item.measuredScore);
    const scoreValues = scored.map((item) => item.opportunityScore);
    const confValues = records
      .filter((item) => item.measuredConfidence && item.confidence != null)
      .map((item) => item.confidence as number);
    const evidenceConf = records
      .map((item) => item.evidenceConfidence)
      .filter((value): value is number => value != null);
    const businessImpact = records
      .map((item) => item.businessImpact)
      .filter((value): value is number => value != null);
    const audienceDemand = records
      .map((item) => item.audienceDemand)
      .filter((value): value is number => value != null);
    const productionReadiness = records
      .map((item) => item.productionReadiness)
      .filter((value): value is number => value != null);
    const strategicAlignment = records
      .map((item) => item.strategicAlignment)
      .filter((value): value is number => value != null);

    const readyForRanking = records.filter(
      (item) =>
        item.measuredScore &&
        item.opportunityScore >= 60 &&
        item.gateFailures.length === 0 &&
        (item.recommendation === 'immediate_production' ||
          item.recommendation === 'fast_track' ||
          item.recommendation === 'research_more'),
    ).length;

    const modelVersions = [
      ...new Set(scored.map((item) => item.modelVersion).filter(Boolean) as string[]),
    ];
    const lastCycle =
      scored
        .map((item) => item.scoredAt)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

    const run = runs[0];
    const runStatus = run?.status ?? 'IDLE';
    const systemActive = runStatus === 'RUNNING' || runStatus === 'QUEUED';
    const packageRow = packages[0];

    const pipelineBase: Array<Omit<PipelineNode, 'state'>> = [
      {
        key: 'candidate',
        label: 'Candidate',
        recordsProcessed: records.length,
        durationMs: null,
        aiConfidence: avg(confValues),
        successRate: records.length ? Math.round((scored.length / records.length) * 100) : null,
        failures: awaiting.length,
        retries: null,
      },
      {
        key: 'evidence',
        label: 'Evidence Aggregation',
        recordsProcessed: records.filter((item) => item.evidenceCount > 0).length,
        durationMs: null,
        aiConfidence: avg(evidenceConf),
        successRate: records.length
          ? Math.round(
              (records.filter((item) => item.evidenceCount > 0).length / records.length) * 100,
            )
          : null,
        failures: records.filter((item) => item.evidenceCount === 0).length,
        retries: null,
      },
      {
        key: 'features',
        label: 'Feature Engineering',
        recordsProcessed: scored.filter((item) => Object.keys(item.factors).length > 0).length,
        durationMs: null,
        aiConfidence: avg(confValues),
        successRate: scored.length
          ? Math.round(
              (scored.filter((item) => Object.keys(item.factors).length > 0).length /
                scored.length) *
                100,
            )
          : null,
        failures: scored.filter((item) => Object.keys(item.factors).length === 0).length,
        retries: null,
      },
      {
        key: 'extract',
        label: 'AI Feature Extraction',
        recordsProcessed: scored.length,
        durationMs: null,
        aiConfidence: avg(confValues),
        successRate: records.length ? Math.round((scored.length / records.length) * 100) : null,
        failures: awaiting.length,
        retries: null,
      },
      {
        key: 'weighted',
        label: 'Weighted Multi-Factor Scoring',
        recordsProcessed: scored.length,
        durationMs: null,
        aiConfidence: avg(scoreValues),
        successRate: scored.length
          ? Math.round(
              (scored.filter((item) => item.contributions.length > 0).length / scored.length) * 100,
            )
          : null,
        failures: scored.filter((item) => item.contributions.length === 0).length,
        retries: null,
      },
      {
        key: 'risk',
        label: 'Risk Adjustment',
        recordsProcessed: records.filter((item) => item.risk != null).length,
        durationMs: null,
        aiConfidence: avg(
          records.map((item) => item.risk).filter((value): value is number => value != null),
        ),
        successRate: scored.length
          ? Math.round(
              (scored.filter((item) => item.risk != null).length / Math.max(1, scored.length)) * 100,
            )
          : null,
        failures: scored.filter((item) => (item.risk ?? 0) >= 70).length,
        retries: null,
      },
      {
        key: 'confidence',
        label: 'Confidence Calibration',
        recordsProcessed: confValues.length,
        durationMs: null,
        aiConfidence: avg(confValues),
        successRate: scored.length
          ? Math.round((confValues.length / scored.length) * 100)
          : null,
        failures: scored.filter((item) => !item.measuredConfidence).length,
        retries: null,
      },
      {
        key: 'portfolio',
        label: 'Portfolio Optimization',
        recordsProcessed: records.filter((item) => item.portfolioFit != null).length,
        durationMs: null,
        aiConfidence: avg(
          records
            .map((item) => item.portfolioFit)
            .filter((value): value is number => value != null),
        ),
        successRate: null,
        failures: 0,
        retries: null,
      },
      {
        key: 'score',
        label: 'Opportunity Score',
        recordsProcessed: scored.length,
        durationMs: null,
        aiConfidence: avg(scoreValues),
        successRate: records.length ? Math.round((scored.length / records.length) * 100) : null,
        failures: awaiting.length,
        retries: null,
      },
      {
        key: 'recommend',
        label: 'Recommendation',
        recordsProcessed: scored.length,
        durationMs: null,
        aiConfidence: avg(confValues),
        successRate: scored.length
          ? Math.round(
              (scored.filter(
                (item) =>
                  item.recommendation === 'immediate_production' ||
                  item.recommendation === 'fast_track',
              ).length /
                scored.length) *
                100,
            )
          : null,
        failures: scored.filter((item) => item.recommendation === 'reject').length,
        retries: null,
      },
      {
        key: 'queue',
        label: 'Ranking Queue',
        recordsProcessed: readyForRanking,
        durationMs: null,
        aiConfidence: avg(confValues),
        successRate: scored.length
          ? Math.round((readyForRanking / scored.length) * 100)
          : null,
        failures: scored.filter((item) => item.gateFailures.length > 0).length,
        retries: null,
      },
    ];

    const activeIndex = !packageRow
      ? -1
      : records.length === 0
        ? 0
        : scored.length === 0
          ? systemActive
            ? 3
            : 0
          : readyForRanking > 0
            ? 10
            : 8;

    const pipeline: PipelineNode[] = pipelineBase.map((node, index) => ({
      ...node,
      state:
        runStatus === 'FAILED' && index === activeIndex
          ? 'failed'
          : activeIndex < 0
            ? 'pending'
            : index < activeIndex
              ? 'done'
              : index === activeIndex
                ? 'active'
                : 'pending',
    }));

    const bands = [
      { band: '90-100', label: 'Elite', min: 90, max: 101 },
      { band: '80-89', label: 'Excellent', min: 80, max: 90 },
      { band: '70-79', label: 'Good', min: 70, max: 80 },
      { band: '60-69', label: 'Moderate', min: 60, max: 70 },
      { band: '40-59', label: 'Weak', min: 40, max: 60 },
      { band: '0-39', label: 'Reject', min: 0, max: 40 },
    ];

    const scoreDistribution = bands.map((band) => ({
      ...band,
      count: scored.filter(
        (item) => item.opportunityScore >= band.min && item.opportunityScore < band.max,
      ).length,
    }));

    let processingRate: number | null = null;
    if (run?.started_at && scored.length > 0) {
      const end = run.completed_at ? run.completed_at.getTime() : Date.now();
      const hours = Math.max(0.01, (end - run.started_at.getTime()) / 3_600_000);
      processingRate = Math.round((scored.length / hours) * 10) / 10;
    }

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
      meta: {
        lastScoringCycle: lastCycle,
        avgConfidence: avg(confValues),
        scoringModelVersion: modelVersions[0] ?? null,
        aiModel: modelVersions[0] ?? null,
        processingRate,
        queueStatus: awaiting.length
          ? `${awaiting.length} awaiting`
          : scored.length
            ? 'Clear'
            : packageRow
              ? 'Idle'
              : 'Blocked',
      },
      metrics: {
        awaitingScoring: awaiting.length,
        scored: scored.length,
        avgOpportunityScore: avg(scoreValues),
        highestScore: scoreValues.length ? Math.max(...scoreValues) : null,
        lowestScore: scoreValues.length ? Math.min(...scoreValues) : null,
        aiConfidence: avg(confValues),
        measuredAiConfidence: confValues.length,
        evidenceConfidence: avg(evidenceConf),
        measuredEvidenceConfidence: evidenceConf.length,
        businessImpact: avg(businessImpact),
        measuredBusinessImpact: businessImpact.length,
        audienceDemand: avg(audienceDemand),
        measuredAudienceDemand: audienceDemand.length,
        productionReadiness: avg(productionReadiness),
        measuredProductionReadiness: productionReadiness.length,
        strategicAlignment: avg(strategicAlignment),
        measuredStrategicAlignment: strategicAlignment.length,
        readyForRanking,
      },
      thresholds: {
        minimumScore: 60,
        minimumConfidence: 40,
        minimumEvidence: 80,
        maximumRisk: 30,
        minimumAudienceDemand: 50,
        maximumCompetition: 80,
        minimumStrategicFit: 80,
        minimumBusinessImpact: 50,
        minimumRoi: 40,
        source: 'platform_defaults',
      },
      formulaFactors: FORMULA_FACTORS,
      defaultWeights: { ...DEFAULT_WEIGHTS },
      pipeline,
      scoreDistribution,
      records,
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
          : 'Opportunity scoring unavailable. Run the Content Intelligence migration.',
      meta: {
        lastScoringCycle: null,
        avgConfidence: null,
        scoringModelVersion: null,
        aiModel: null,
        processingRate: null,
        queueStatus: 'Unavailable',
      },
      metrics: {
        awaitingScoring: 0,
        scored: 0,
        avgOpportunityScore: null,
        highestScore: null,
        lowestScore: null,
        aiConfidence: null,
        measuredAiConfidence: 0,
        evidenceConfidence: null,
        measuredEvidenceConfidence: 0,
        businessImpact: null,
        measuredBusinessImpact: 0,
        audienceDemand: null,
        measuredAudienceDemand: 0,
        productionReadiness: null,
        measuredProductionReadiness: 0,
        strategicAlignment: null,
        measuredStrategicAlignment: 0,
        readyForRanking: 0,
      },
      thresholds: {
        minimumScore: 60,
        minimumConfidence: 40,
        minimumEvidence: 80,
        maximumRisk: 30,
        minimumAudienceDemand: 50,
        maximumCompetition: 80,
        minimumStrategicFit: 80,
        minimumBusinessImpact: 50,
        minimumRoi: 40,
        source: 'platform_defaults',
      },
      formulaFactors: FORMULA_FACTORS,
      defaultWeights: { ...DEFAULT_WEIGHTS },
      pipeline: [],
      scoreDistribution: [],
      records: [],
      issues: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
