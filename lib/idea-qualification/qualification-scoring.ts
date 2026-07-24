import { prisma } from '@/lib/db';
import type { FactorScores } from './contracts';
import { DEFAULT_GATES, DEFAULT_WEIGHTS, scoreCandidate } from './scoring';

export type ScoringRecommendation =
  | 'Qualified'
  | 'Review Required'
  | 'Rejected'
  | 'Await Scoring';

export type ScoringMatrixRow = {
  key: string;
  label: string;
  weight: number | null;
  rawScore: number | null;
  normalizedScore: number | null;
  contribution: number | null;
  confidence: number | null;
  threshold: number | null;
  trend: 'up' | 'down' | 'flat' | 'unmeasured';
  explanation: string;
  gated: boolean;
  gateStatus: 'PASS' | 'FAIL' | 'N/A' | 'UNMEASURED';
};

export type ScoringCandidate = {
  id: string;
  scoreId: string | null;
  title: string;
  summary: string;
  domain: string;
  audience: string | null;
  geography: string | null;
  formatHint: string | null;
  candidateStatus: string;
  gateStatus: string;
  decision: string | null;
  overallScore: number | null;
  confidence: number | null;
  measuredConfidence: boolean;
  productionReadiness: number | null;
  riskScore: number | null;
  strategicFit: number | null;
  evidenceQuality: number | null;
  audienceValue: number | null;
  originality: number | null;
  visualPotential: number | null;
  feasibility: number | null;
  recommendation: ScoringRecommendation;
  scoreBand: 'EXCELLENT' | 'STRONG' | 'MARGINAL' | 'WEAK' | 'UNMEASURED';
  explainability: string[];
  aiSummary: string;
  matrix: ScoringMatrixRow[];
  radar: Array<{ key: string; label: string; value: number | null }>;
  improvements: string[];
  thresholdAlerts: Array<{ code: string; message: string; severity: string }>;
  gateResults: Array<{
    code: string;
    actual: number | null;
    required: string | null;
    status: string;
    blocking: boolean;
    explanation: string | null;
  }>;
  versionHistory: Array<{
    scoreId: string;
    modelVersion: string;
    totalScore: number;
    confidence: number;
    scoredAt: string;
  }>;
  lifecycle: Array<{ key: string; label: string; done: boolean; at: string | null }>;
  factors: Partial<FactorScores> | null;
  weights: Record<string, number> | null;
  thresholds: Record<string, number> | null;
  explanation: string | null;
  modelVersion: string | null;
  scoredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QualificationScoringOverview = {
  available: boolean;
  reason?: string;
  meta: {
    cycleStatus: string;
    intakeStatus: string | null;
    modelVersions: string[];
    weightProfile: string;
  };
  metrics: {
    overallQualificationScore: number | null;
    aiConfidence: number | null;
    productionReadiness: number | null;
    riskScore: number | null;
    strategyAlignment: number | null;
    evidenceQuality: number | null;
    audienceValue: number | null;
    originality: number | null;
    visualPotential: number | null;
    finalRecommendation: ScoringRecommendation | 'UNMEASURED';
    totalCandidates: number;
    scoredCandidates: number;
    qualifiedCount: number;
    reviewCount: number;
    rejectedCount: number;
    gatePassRate: number | null;
  };
  pipeline: Array<{
    key: string;
    label: string;
    state: 'pending' | 'active' | 'done' | 'failed';
  }>;
  scoringCriteria: ScoringMatrixRow[];
  candidates: ScoringCandidate[];
  recommendations: Array<{
    id: string;
    action: string;
    reason: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    candidateId?: string;
  }>;
  analytics: {
    scoreDistribution: Array<{ label: string; count: number }>;
    recommendationDistribution: Array<{ label: string; count: number }>;
    factorContribution: Array<{ label: string; weight: number; avgScore: number | null }>;
    rankingPreview: Array<{
      id: string;
      title: string;
      score: number | null;
      recommendation: ScoringRecommendation;
    }>;
  };
  governance: {
    modelVersions: string[];
    decisionsLogged: number;
    auditEvents: number;
    scoresPersisted: number;
    gateResults: number;
    defaultMinimumTotal: number;
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

const FACTOR_META: Array<{
  key: keyof typeof DEFAULT_WEIGHTS | 'risk' | 'duplicateSimilarity';
  label: string;
  weightKey?: keyof typeof DEFAULT_WEIGHTS;
  thresholdKey?: keyof typeof DEFAULT_GATES;
  gated?: boolean;
  invertGate?: boolean;
}> = [
  { key: 'strategicFit', label: 'Strategy Alignment', weightKey: 'strategicFit', thresholdKey: 'strategicFit' },
  { key: 'evidence', label: 'Evidence Quality', weightKey: 'evidence', thresholdKey: 'evidence' },
  { key: 'audienceValue', label: 'Audience Value', weightKey: 'audienceValue', thresholdKey: 'audienceValue' },
  { key: 'originality', label: 'Originality', weightKey: 'originality', thresholdKey: 'originality' },
  { key: 'timeliness', label: 'Timeliness', weightKey: 'timeliness' },
  { key: 'educationalValue', label: 'Educational Value', weightKey: 'educationalValue' },
  { key: 'regionalRelevance', label: 'Regional Relevance', weightKey: 'regionalRelevance' },
  {
    key: 'visualPotential',
    label: 'Visual Potential',
    weightKey: 'visualPotential',
    thresholdKey: 'visualPotential',
  },
  { key: 'feasibility', label: 'Production Feasibility', weightKey: 'feasibility', thresholdKey: 'feasibility' },
  {
    key: 'sourceAvailability',
    label: 'Source Availability',
    weightKey: 'sourceAvailability',
    thresholdKey: 'sourceAvailability',
  },
  { key: 'risk', label: 'Risk Score', thresholdKey: 'maxRisk', gated: true, invertGate: true },
  {
    key: 'duplicateSimilarity',
    label: 'Duplicate Similarity',
    thresholdKey: 'maxDuplicateSimilarity',
    gated: true,
    invertGate: true,
  },
];

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

function parseNumberMap(raw: string | null): Record<string, number> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const n = num(value);
      if (n != null) out[key] = n;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

function scoreBandFrom(score: number | null): ScoringCandidate['scoreBand'] {
  if (score == null) return 'UNMEASURED';
  if (score >= 90) return 'EXCELLENT';
  if (score >= 78) return 'STRONG';
  if (score >= 65) return 'MARGINAL';
  return 'WEAK';
}

function recommendationFor(
  score: number | null,
  gateStatus: string,
  decision: string | null,
  blockingFails: number,
): ScoringRecommendation {
  const gate = gateStatus.toUpperCase();
  const dec = (decision ?? '').toUpperCase();
  if (score == null) return 'Await Scoring';
  if (dec === 'REJECT' || dec === 'REJECTED' || gate === 'REJECTED') return 'Rejected';
  if (blockingFails > 0 || gate === 'FAILED' || gate === 'FAIL') return 'Review Required';
  if (gate === 'PASSED' || gate === 'PASS' || dec === 'QUALIFY' || dec === 'QUALIFIED') {
    return score >= DEFAULT_GATES.minimumTotal ? 'Qualified' : 'Review Required';
  }
  if (score >= DEFAULT_GATES.minimumTotal) return 'Qualified';
  if (score < 55) return 'Rejected';
  return 'Review Required';
}

function buildMatrix(
  factors: Partial<FactorScores> | null,
  weights: Record<string, number> | null,
  thresholds: Record<string, number> | null,
  confidence: number | null,
): ScoringMatrixRow[] {
  const weightMap = weights ?? { ...DEFAULT_WEIGHTS };
  const thresholdMap = thresholds ?? { ...DEFAULT_GATES };

  return FACTOR_META.map((meta) => {
    const rawScore = factors?.[meta.key as keyof FactorScores] ?? null;
    const weight =
      meta.weightKey != null
        ? num(weightMap[meta.weightKey]) ?? DEFAULT_WEIGHTS[meta.weightKey]
        : null;
    const threshold =
      meta.thresholdKey != null
        ? num(thresholdMap[meta.thresholdKey]) ?? DEFAULT_GATES[meta.thresholdKey]
        : null;
    const contribution =
      rawScore != null && weight != null
        ? Math.round(rawScore * weight * 100) / 100
        : null;

    let gateStatus: ScoringMatrixRow['gateStatus'] = 'N/A';
    if (threshold != null) {
      if (rawScore == null) gateStatus = 'UNMEASURED';
      else if (meta.invertGate) gateStatus = rawScore <= threshold ? 'PASS' : 'FAIL';
      else gateStatus = rawScore >= threshold ? 'PASS' : 'FAIL';
    }

    const explanation =
      rawScore == null
        ? `${meta.label} not yet persisted on iq_scores.factors_json`
        : weight != null
          ? `${meta.label} ${rawScore} × weight ${Math.round(weight * 1000) / 10}% → contribution ${contribution}`
          : `${meta.label} ${rawScore} (gate factor; excluded from weighted total)`;

    return {
      key: meta.key,
      label: meta.label,
      weight: weight != null ? Math.round(weight * 1000) / 10 : null,
      rawScore,
      normalizedScore: rawScore,
      contribution,
      confidence: rawScore != null ? confidence : null,
      threshold,
      trend: rawScore == null ? 'unmeasured' : 'flat',
      explanation,
      gated: Boolean(meta.gated || meta.thresholdKey),
      gateStatus,
    };
  });
}

function improvementsFor(
  matrix: ScoringMatrixRow[],
  recommendation: ScoringRecommendation,
): string[] {
  const tips: string[] = [];
  for (const row of matrix) {
    if (row.gateStatus === 'FAIL') {
      tips.push(
        row.key === 'risk' || row.key === 'duplicateSimilarity'
          ? `Reduce ${row.label} below ${row.threshold}`
          : `Raise ${row.label} to at least ${row.threshold}`,
      );
    }
  }
  if (recommendation === 'Review Required' && !tips.length) {
    tips.push('Re-run qualification cycle after upstream factor updates');
  }
  if (recommendation === 'Await Scoring') {
    tips.push('Await autonomous scoring persistence before mandatory gates');
  }
  if (!tips.length && recommendation === 'Qualified') {
    tips.push('Ready for Mandatory Gates — no mandatory score improvements');
  }
  return tips.slice(0, 8);
}

export async function loadQualificationScoring(): Promise<QualificationScoringOverview> {
  try {
    await prisma.$queryRaw`SELECT TOP 1 id FROM iq_candidates`;
  } catch {
    return {
      available: false,
      reason: 'Idea Qualification tables unavailable. Run the Stage 03 migration.',
      meta: {
        cycleStatus: 'UNAVAILABLE',
        intakeStatus: null,
        modelVersions: [],
        weightProfile: 'default',
      },
      metrics: {
        overallQualificationScore: null,
        aiConfidence: null,
        productionReadiness: null,
        riskScore: null,
        strategyAlignment: null,
        evidenceQuality: null,
        audienceValue: null,
        originality: null,
        visualPotential: null,
        finalRecommendation: 'UNMEASURED',
        totalCandidates: 0,
        scoredCandidates: 0,
        qualifiedCount: 0,
        reviewCount: 0,
        rejectedCount: 0,
        gatePassRate: null,
      },
      pipeline: [],
      scoringCriteria: buildMatrix(null, null, null, null),
      candidates: [],
      recommendations: [],
      analytics: {
        scoreDistribution: [],
        recommendationDistribution: [],
        factorContribution: [],
        rankingPreview: [],
      },
      governance: {
        modelVersions: [],
        decisionsLogged: 0,
        auditEvents: 0,
        scoresPersisted: 0,
        gateResults: 0,
        defaultMinimumTotal: DEFAULT_GATES.minimumTotal,
      },
      notifications: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
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
        scoreId: string | null;
        factorsJson: string | null;
        weightsJson: string | null;
        thresholdsJson: string | null;
        totalScore: number | string | null;
        scoreConfidence: number | string | null;
        explanation: string | null;
        modelVersion: string | null;
        scoredAt: Date | null;
        gateFailCount: number | bigint;
        gatePassCount: number | bigint;
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
        CONVERT(varchar(36), s.id) AS scoreId,
        s.factors_json AS factorsJson,
        s.weights_json AS weightsJson,
        s.thresholds_json AS thresholdsJson,
        s.total_score AS totalScore,
        s.confidence AS scoreConfidence,
        s.explanation,
        s.model_version AS modelVersion,
        s.scored_at AS scoredAt,
        (
          SELECT COUNT(*) FROM iq_gate_results g
          WHERE g.candidate_id = c.id AND g.status IN ('FAILED','FAIL','BLOCKED')
        ) AS gateFailCount,
        (
          SELECT COUNT(*) FROM iq_gate_results g
          WHERE g.candidate_id = c.id AND g.status IN ('PASSED','PASS','OK')
        ) AS gatePassCount
      FROM iq_candidates c
      OUTER APPLY (
        SELECT TOP 1 *
        FROM iq_scores sc
        WHERE sc.candidate_id = c.id
        ORDER BY sc.scored_at DESC
      ) s
      ORDER BY
        COALESCE(s.total_score, 0) DESC,
        c.updated_at DESC
    `;

    const scoreHistory = await prisma.$queryRaw<
      Array<{
        id: string;
        candidateId: string;
        modelVersion: string;
        totalScore: number | string;
        confidence: number | string;
        scoredAt: Date;
      }>
    >`
      SELECT TOP 400
        CONVERT(varchar(36), id) AS id,
        CONVERT(varchar(36), candidate_id) AS candidateId,
        model_version AS modelVersion,
        total_score AS totalScore,
        confidence,
        scored_at AS scoredAt
      FROM iq_scores
      ORDER BY scored_at DESC
    `;

    const gateRows = await prisma.$queryRaw<
      Array<{
        candidateId: string;
        gateCode: string;
        actualValue: number | string | null;
        requiredValue: string | null;
        status: string;
        blocking: boolean | number;
        explanation: string | null;
      }>
    >`
      SELECT TOP 800
        CONVERT(varchar(36), candidate_id) AS candidateId,
        gate_code AS gateCode,
        actual_value AS actualValue,
        required_value AS requiredValue,
        status,
        blocking,
        explanation
      FROM iq_gate_results
      ORDER BY evaluated_at DESC
    `;

    const decisionCount = await prisma.$queryRaw<Array<{ count: number | bigint }>>`
      SELECT COUNT(*) AS count FROM iq_decisions
    `;

    const scoreCount = await prisma.$queryRaw<Array<{ count: number | bigint }>>`
      SELECT COUNT(*) AS count FROM iq_scores
    `;

    const gateCount = await prisma.$queryRaw<Array<{ count: number | bigint }>>`
      SELECT COUNT(*) AS count FROM iq_gate_results
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
      SELECT TOP 40
        CONVERT(varchar(36), id) AS id,
        action,
        actor_type AS actorType,
        created_at AS createdAt,
        reason
      FROM iq_audit_events
      WHERE action LIKE '%SCORE%'
         OR action LIKE '%GATE%'
         OR action LIKE '%QUALIF%'
         OR action LIKE '%WEIGHT%'
         OR action LIKE '%THRESH%'
      ORDER BY created_at DESC
    `;

    const historyByCandidate = new Map<string, typeof scoreHistory>();
    for (const row of scoreHistory) {
      const list = historyByCandidate.get(row.candidateId) ?? [];
      if (list.length < 8) list.push(row);
      historyByCandidate.set(row.candidateId, list);
    }

    const gatesByCandidate = new Map<string, typeof gateRows>();
    for (const row of gateRows) {
      const list = gatesByCandidate.get(row.candidateId) ?? [];
      if (list.length < 20) list.push(row);
      gatesByCandidate.set(row.candidateId, list);
    }

    const candidates: ScoringCandidate[] = rows.map((row) => {
      const factors = parseFactors(row.factorsJson);
      const weights = parseNumberMap(row.weightsJson);
      const thresholds = parseNumberMap(row.thresholdsJson);
      const confidence = num(row.scoreConfidence) ?? num(row.confidence);
      const measuredConfidence = confidence != null && confidence >= 1;

      let overallScore = num(row.totalScore);
      if (
        overallScore == null &&
        factors &&
        (Object.keys(DEFAULT_WEIGHTS) as Array<keyof typeof DEFAULT_WEIGHTS>).every(
          (key) => factors[key] != null,
        )
      ) {
        const mergedWeights: Record<keyof typeof DEFAULT_WEIGHTS, number> = {
          ...DEFAULT_WEIGHTS,
        };
        for (const key of Object.keys(DEFAULT_WEIGHTS) as Array<
          keyof typeof DEFAULT_WEIGHTS
        >) {
          const w = weights?.[key];
          if (w != null) mergedWeights[key] = w;
        }
        overallScore = scoreCandidate(factors as FactorScores, mergedWeights);
      }

      const matrix = buildMatrix(factors, weights, thresholds, confidence);
      const blockingFails = Number(row.gateFailCount);
      const recommendation = recommendationFor(
        overallScore,
        row.gateStatus,
        row.decision,
        blockingFails,
      );
      const band = scoreBandFrom(overallScore);

      const productionReadiness = avg(
        [factors?.feasibility, factors?.sourceAvailability, factors?.visualPotential].filter(
          (v): v is number => v != null,
        ),
      );

      const explainability: string[] = [];
      if (overallScore != null) {
        explainability.push(`Overall qualification score ${overallScore} (${band})`);
      }
      if (confidence != null) explainability.push(`AI confidence ${confidence}%`);
      for (const rowMatrix of matrix.filter((m) => m.contribution != null).slice(0, 5)) {
        explainability.push(
          `${rowMatrix.label} contributes ${rowMatrix.contribution} (weight ${rowMatrix.weight}%)`,
        );
      }
      for (const fail of matrix.filter((m) => m.gateStatus === 'FAIL').slice(0, 3)) {
        explainability.push(`${fail.label} below/above gate threshold ${fail.threshold}`);
      }
      if (row.explanation) explainability.push(row.explanation.slice(0, 240));
      if (!explainability.length) {
        explainability.push('No persisted iq_scores row yet for this candidate');
      }

      const gateResults = (gatesByCandidate.get(row.id) ?? []).map((g) => ({
        code: g.gateCode,
        actual: num(g.actualValue),
        required: g.requiredValue,
        status: g.status,
        blocking: Boolean(g.blocking),
        explanation: g.explanation,
      }));

      const thresholdAlerts = matrix
        .filter((m) => m.gateStatus === 'FAIL')
        .map((m) => ({
          code: m.key.toUpperCase(),
          message: `${m.label}: ${m.rawScore} vs threshold ${m.threshold}`,
          severity: m.key === 'risk' || m.key === 'duplicateSimilarity' ? 'CRITICAL' : 'WARNING',
        }));

      const versionHistory = (historyByCandidate.get(row.id) ?? []).map((h) => ({
        scoreId: h.id,
        modelVersion: h.modelVersion,
        totalScore: Math.round(Number(h.totalScore) * 100) / 100,
        confidence: Math.round(Number(h.confidence) * 100) / 100,
        scoredAt: h.scoredAt.toISOString(),
      }));

      const improvements = improvementsFor(matrix, recommendation);
      const createdAt = row.createdAt.toISOString();
      const updatedAt = row.updatedAt.toISOString();
      const scoredAt = row.scoredAt?.toISOString() ?? null;

      const aiSummary =
        overallScore != null
          ? `${row.title} scores ${overallScore} with recommendation ${recommendation}. ${
              improvements[0] ?? 'No mandatory improvements.'
            }`
          : `${row.title} awaits persisted qualification scoring from the autonomous cycle.`;

      return {
        id: row.id,
        scoreId: row.scoreId,
        title: row.title,
        summary: row.summary,
        domain: row.domain,
        audience: row.audience,
        geography: row.geography,
        formatHint: row.formatHint,
        candidateStatus: row.status,
        gateStatus: row.gateStatus,
        decision: row.decision,
        overallScore,
        confidence,
        measuredConfidence,
        productionReadiness,
        riskScore: factors?.risk ?? null,
        strategicFit: factors?.strategicFit ?? null,
        evidenceQuality: factors?.evidence ?? null,
        audienceValue: factors?.audienceValue ?? null,
        originality: factors?.originality ?? null,
        visualPotential: factors?.visualPotential ?? null,
        feasibility: factors?.feasibility ?? null,
        recommendation,
        scoreBand: band,
        explainability,
        aiSummary,
        matrix,
        radar: FACTOR_META.filter((f) => f.weightKey).map((f) => ({
          key: f.key,
          label: f.label,
          value: factors?.[f.key as keyof FactorScores] ?? null,
        })),
        improvements,
        thresholdAlerts,
        gateResults,
        versionHistory,
        lifecycle: [
          {
            key: 'factors',
            label: 'Factor collection',
            done: factors != null && Object.keys(factors).length > 0,
            at: factors ? updatedAt : null,
          },
          {
            key: 'weights',
            label: 'Weight application',
            done: weights != null,
            at: weights ? scoredAt : null,
          },
          {
            key: 'normalize',
            label: 'Normalization',
            done: overallScore != null,
            at: scoredAt,
          },
          {
            key: 'score',
            label: 'Score calculation',
            done: overallScore != null,
            at: scoredAt,
          },
          {
            key: 'gates',
            label: 'Gate evaluation',
            done: gateResults.length > 0 || row.gateStatus !== 'PENDING',
            at: gateResults.length ? updatedAt : null,
          },
          {
            key: 'explain',
            label: 'Explainability',
            done: Boolean(row.explanation) || overallScore != null,
            at: scoredAt,
          },
          {
            key: 'alerts',
            label: 'Threshold alerts',
            done: thresholdAlerts.length > 0 || recommendation === 'Qualified',
            at: thresholdAlerts.length || recommendation === 'Qualified' ? updatedAt : null,
          },
          {
            key: 'decision',
            label: 'Final recommendation',
            done: recommendation !== 'Await Scoring',
            at: recommendation !== 'Await Scoring' ? updatedAt : null,
          },
        ],
        factors,
        weights,
        thresholds,
        explanation: row.explanation,
        modelVersion: row.modelVersion,
        scoredAt,
        createdAt,
        updatedAt,
      };
    });

    const scoredCandidates = candidates.filter((c) => c.overallScore != null);
    const qualifiedCount = candidates.filter((c) => c.recommendation === 'Qualified').length;
    const reviewCount = candidates.filter((c) => c.recommendation === 'Review Required').length;
    const rejectedCount = candidates.filter((c) => c.recommendation === 'Rejected').length;

    const scoringCriteria = buildMatrix(
      scoredCandidates[0]?.factors ?? null,
      scoredCandidates[0]?.weights ?? null,
      scoredCandidates[0]?.thresholds ?? null,
      avg(
        scoredCandidates
          .map((c) => c.confidence)
          .filter((v): v is number => v != null),
      ),
    );

    // Portfolio-level criteria: average raw scores across scored candidates
    const portfolioCriteria = FACTOR_META.map((meta, index) => {
      const base = scoringCriteria[index];
      const values = scoredCandidates
        .map((c) => c.factors?.[meta.key as keyof FactorScores])
        .filter((v): v is number => v != null);
      const rawScore = avg(values);
      const weight = base.weight;
      const contribution =
        rawScore != null && weight != null
          ? Math.round(rawScore * (weight / 100) * 100) / 100
          : null;
      return {
        ...base,
        rawScore,
        normalizedScore: rawScore,
        contribution,
        explanation:
          rawScore == null
            ? `${meta.label} unmeasured across portfolio`
            : `Portfolio avg ${rawScore} across ${values.length} scored candidates`,
        gateStatus:
          rawScore == null
            ? 'UNMEASURED'
            : base.threshold == null
              ? 'N/A'
              : meta.invertGate
                ? rawScore <= base.threshold
                  ? 'PASS'
                  : 'FAIL'
                : rawScore >= base.threshold
                  ? 'PASS'
                  : 'FAIL',
      } satisfies ScoringMatrixRow;
    });

    const recommendations: QualificationScoringOverview['recommendations'] = [];
    for (const item of candidates.slice(0, 12)) {
      recommendations.push({
        id: `rec-${item.id}`,
        action: item.recommendation,
        reason: `${item.title} · score ${item.overallScore ?? 'UNMEAS.'} · ${item.scoreBand}`,
        priority:
          item.recommendation === 'Rejected'
            ? 'HIGH'
            : item.recommendation === 'Review Required'
              ? 'MEDIUM'
              : item.recommendation === 'Qualified'
                ? 'LOW'
                : 'MEDIUM',
        candidateId: item.id,
      });
      for (const tip of item.improvements.slice(0, 1)) {
        if (item.recommendation !== 'Qualified') {
          recommendations.push({
            id: `imp-${item.id}`,
            action: tip,
            reason: `Mandatory improvement for ${item.title}`,
            priority: 'HIGH',
            candidateId: item.id,
          });
        }
      }
    }

    const notifications: QualificationScoringOverview['notifications'] = [];
    for (const item of candidates.slice(0, 12)) {
      if (item.recommendation === 'Qualified') {
        notifications.push({
          id: `ok-${item.id}`,
          severity: 'INFO',
          message: `Qualified for Mandatory Gates: ${item.title}`,
        });
      }
      if (item.recommendation === 'Review Required') {
        notifications.push({
          id: `rev-${item.id}`,
          severity: 'WARNING',
          message: `Review required before gates: ${item.title}`,
        });
      }
      if (item.recommendation === 'Rejected') {
        notifications.push({
          id: `rej-${item.id}`,
          severity: 'CRITICAL',
          message: `Scoring rejected: ${item.title}`,
        });
      }
      for (const alert of item.thresholdAlerts.slice(0, 1)) {
        notifications.push({
          id: `thr-${item.id}-${alert.code}`,
          severity: alert.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
          message: `${item.title}: ${alert.message}`,
        });
      }
    }

    const modelVersions = [
      ...new Set(
        candidates.map((c) => c.modelVersion).filter((v): v is string => Boolean(v)),
      ),
    ];

    const hasScores = scoredCandidates.length > 0;
    const pipeline = [
      { key: 'factors', label: 'Factor Collection' },
      { key: 'weights', label: 'Weight Application' },
      { key: 'normalize', label: 'Normalization' },
      { key: 'score', label: 'Score Calculation' },
      { key: 'gates', label: 'Gate Evaluation' },
      { key: 'explain', label: 'Explainability' },
      { key: 'alerts', label: 'Threshold Alerts' },
      { key: 'decision', label: 'Final Recommendation' },
      { key: 'recalc', label: 'Continuous Recalculation' },
      { key: 'advance', label: 'Advance to Mandatory Gates' },
    ].map((item, index) => {
      let state: 'pending' | 'active' | 'done' | 'failed' = 'pending';
      if (rejectedCount > 0 && item.key === 'decision') state = 'failed';
      else if (qualifiedCount > 0 && index <= 9) state = 'done';
      else if (hasScores && index <= 5) state = 'done';
      else if (hasScores && index === 6) state = 'active';
      else if (rows.length && index === 0) state = 'active';
      return { ...item, state };
    });

    const scoreDistribution = [
      { label: 'EXCELLENT', count: candidates.filter((c) => c.scoreBand === 'EXCELLENT').length },
      { label: 'STRONG', count: candidates.filter((c) => c.scoreBand === 'STRONG').length },
      { label: 'MARGINAL', count: candidates.filter((c) => c.scoreBand === 'MARGINAL').length },
      { label: 'WEAK', count: candidates.filter((c) => c.scoreBand === 'WEAK').length },
      { label: 'UNMEASURED', count: candidates.filter((c) => c.scoreBand === 'UNMEASURED').length },
    ];

    const recommendationDistribution = new Map<string, number>();
    for (const item of candidates) {
      recommendationDistribution.set(
        item.recommendation,
        (recommendationDistribution.get(item.recommendation) ?? 0) + 1,
      );
    }

    const factorContribution = portfolioCriteria
      .filter((row) => row.weight != null)
      .map((row) => ({
        label: row.label,
        weight: row.weight ?? 0,
        avgScore: row.rawScore,
      }));

    const finalRecommendation: ScoringRecommendation | 'UNMEASURED' =
      candidates.length === 0
        ? 'UNMEASURED'
        : qualifiedCount >= reviewCount && qualifiedCount >= rejectedCount && qualifiedCount > 0
          ? 'Qualified'
          : rejectedCount > qualifiedCount
            ? 'Rejected'
            : scoredCandidates.length
              ? 'Review Required'
              : 'Await Scoring';

    return {
      available: true,
      meta: {
        cycleStatus: cycles[0]?.status ?? 'NOT_STARTED',
        intakeStatus: intakes[0]?.status ?? null,
        modelVersions,
        weightProfile: scoredCandidates[0]?.weights ? 'persisted' : 'default',
      },
      metrics: {
        overallQualificationScore: avg(
          scoredCandidates.map((c) => c.overallScore!).filter((v) => v != null),
        ),
        aiConfidence: avg(
          scoredCandidates
            .map((c) => c.confidence)
            .filter((v): v is number => v != null),
        ),
        productionReadiness: avg(
          candidates
            .map((c) => c.productionReadiness)
            .filter((v): v is number => v != null),
        ),
        riskScore: avg(
          candidates.map((c) => c.riskScore).filter((v): v is number => v != null),
        ),
        strategyAlignment: avg(
          candidates.map((c) => c.strategicFit).filter((v): v is number => v != null),
        ),
        evidenceQuality: avg(
          candidates
            .map((c) => c.evidenceQuality)
            .filter((v): v is number => v != null),
        ),
        audienceValue: avg(
          candidates
            .map((c) => c.audienceValue)
            .filter((v): v is number => v != null),
        ),
        originality: avg(
          candidates.map((c) => c.originality).filter((v): v is number => v != null),
        ),
        visualPotential: avg(
          candidates
            .map((c) => c.visualPotential)
            .filter((v): v is number => v != null),
        ),
        finalRecommendation,
        totalCandidates: candidates.length,
        scoredCandidates: scoredCandidates.length,
        qualifiedCount,
        reviewCount,
        rejectedCount,
        gatePassRate: pct(
          candidates.filter((c) => /PASS/i.test(c.gateStatus)).length,
          candidates.length,
        ),
      },
      pipeline,
      scoringCriteria: portfolioCriteria,
      candidates,
      recommendations,
      analytics: {
        scoreDistribution,
        recommendationDistribution: [...recommendationDistribution.entries()].map(
          ([label, count]) => ({ label, count }),
        ),
        factorContribution,
        rankingPreview: [...scoredCandidates]
          .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))
          .slice(0, 10)
          .map((c) => ({
            id: c.id,
            title: c.title,
            score: c.overallScore,
            recommendation: c.recommendation,
          })),
      },
      governance: {
        modelVersions,
        decisionsLogged: Number(decisionCount[0]?.count ?? 0),
        auditEvents: auditRows.length,
        scoresPersisted: Number(scoreCount[0]?.count ?? 0),
        gateResults: Number(gateCount[0]?.count ?? 0),
        defaultMinimumTotal: DEFAULT_GATES.minimumTotal,
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
    return {
      available: false,
      reason:
        error instanceof Error
          ? error.message
          : 'Failed to load qualification scoring overview',
      meta: {
        cycleStatus: 'ERROR',
        intakeStatus: null,
        modelVersions: [],
        weightProfile: 'default',
      },
      metrics: {
        overallQualificationScore: null,
        aiConfidence: null,
        productionReadiness: null,
        riskScore: null,
        strategyAlignment: null,
        evidenceQuality: null,
        audienceValue: null,
        originality: null,
        visualPotential: null,
        finalRecommendation: 'UNMEASURED',
        totalCandidates: 0,
        scoredCandidates: 0,
        qualifiedCount: 0,
        reviewCount: 0,
        rejectedCount: 0,
        gatePassRate: null,
      },
      pipeline: [],
      scoringCriteria: buildMatrix(null, null, null, null),
      candidates: [],
      recommendations: [],
      analytics: {
        scoreDistribution: [],
        recommendationDistribution: [],
        factorContribution: [],
        rankingPreview: [],
      },
      governance: {
        modelVersions: [],
        decisionsLogged: 0,
        auditEvents: 0,
        scoresPersisted: 0,
        gateResults: 0,
        defaultMinimumTotal: DEFAULT_GATES.minimumTotal,
      },
      notifications: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
