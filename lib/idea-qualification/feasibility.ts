import { prisma } from '@/lib/db';
import type { FactorScores } from './contracts';

export type FeasibilityRecommendation =
  | 'Proceed'
  | 'Revise Scope'
  | 'Increase Budget'
  | 'Delay Production'
  | 'Reject'
  | 'Await Scoring';

export type FeasibilityCandidate = {
  id: string;
  title: string;
  summary: string;
  domain: string;
  audience: string | null;
  geography: string | null;
  formatHint: string | null;
  candidateStatus: string;
  gateStatus: string;
  decision: string | null;
  productionReadiness: number | null;
  estimatedBudget: number | null;
  estimatedDurationDays: number | null;
  resourceAvailability: number | null;
  confidence: number | null;
  measuredConfidence: boolean;
  technicalComplexity: number | null;
  legalReadiness: number | null;
  researchCompletion: number | null;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMEASURED';
  staffingAvailability: number | null;
  recommendation: FeasibilityRecommendation;
  readinessBand: 'EXCELLENT' | 'GOOD' | 'MARGINAL' | 'NOT_READY' | 'PENDING';
  explainability: string[];
  aiSummary: string;
  readinessBreakdown: Array<{ label: string; value: number | null }>;
  budgetLines: Array<{ label: string; amount: number | null }>;
  timeline: Array<{ label: string; days: number | null }>;
  resources: Array<{ label: string; status: string; detail: string }>;
  technical: Array<{ label: string; value: number | null }>;
  legal: Array<{ label: string; status: string; detail: string }>;
  research: Array<{ label: string; status: string; detail: string }>;
  contentAvailability: Array<{ label: string; status: string; detail: string }>;
  simulation: Array<{ label: string; value: string | null }>;
  bottlenecks: string[];
  riskMatrix: Array<{ area: string; risk: string; score: number | null }>;
  equipment: Array<{ label: string; status: string; detail: string }>;
  externalDependencies: Array<{ label: string; status: string; detail: string }>;
  humanResources: Array<{ role: string; needed: number | null; status: string }>;
  pipelineCompatibility: Array<{ stage: string; status: string }>;
  gantt: Array<{ label: string; days: number | null }>;
  financial: Array<{ label: string; value: string | null }>;
  scenarios: Array<{ label: string; readiness: number | null; note: string }>;
  optimization: string[];
  dependencies: Array<{
    label: string;
    status: string;
    criticality: string;
    detail: string;
  }>;
  lifecycle: Array<{ key: string; label: string; done: boolean; at: string | null }>;
  factors: Partial<FactorScores> | null;
  modelVersion: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductionFeasibilityOverview = {
  available: boolean;
  reason?: string;
  meta: {
    cycleStatus: string;
    intakeStatus: string | null;
    modelVersions: string[];
  };
  metrics: {
    averageReadiness: number | null;
    estimatedBudget: number | null;
    estimatedDurationDays: number | null;
    resourceAvailability: number | null;
    aiConfidence: number | null;
    technicalComplexity: number | null;
    legalReadiness: number | null;
    researchCompletion: number | null;
    highRiskCount: number;
    staffingAvailability: number | null;
    proceedRate: number | null;
    totalCandidates: number;
    readyCount: number;
    reviseCount: number;
    rejectCount: number;
  };
  pipeline: Array<{
    key: string;
    label: string;
    state: 'pending' | 'active' | 'done' | 'failed';
  }>;
  candidates: FeasibilityCandidate[];
  recommendations: Array<{
    id: string;
    action: string;
    reason: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    candidateId?: string;
  }>;
  analytics: {
    readinessDistribution: Array<{ label: string; count: number }>;
    riskDistribution: Array<{ label: string; count: number }>;
    recommendationDistribution: Array<{ label: string; count: number }>;
    domainReadiness: Array<{ label: string; avgScore: number | null; count: number }>;
  };
  governance: {
    modelVersions: string[];
    decisionsLogged: number;
    auditEvents: number;
    riskAssessments: number;
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

const BUDGET_LINES = [
  'Research Cost',
  'Script Development',
  'Narration',
  'Voice Talent',
  'AI Image Generation',
  'Animation',
  'Stock Footage',
  'Travel',
  'Interviews',
  'Licensing',
  'Music',
  'Sound Design',
  'Editing',
  'Rendering',
  'Quality Assurance',
  'Publishing',
  'Marketing',
  'Contingency',
] as const;

const TIMELINE_STAGES = [
  'Research',
  'Script',
  'Storyboard',
  'Images',
  'Animation',
  'Narration',
  'Video Production',
  'Editing',
  'QA',
  'Publishing',
] as const;

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

function parseMeta(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const nested =
      (parsed.feasibility as Record<string, unknown> | undefined) ??
      (parsed.production as Record<string, unknown> | undefined) ??
      (parsed.budget as Record<string, unknown> | undefined);
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested;
    return parsed;
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

function riskLevelFrom(
  riskScore: number | null,
  readiness: number | null,
): FeasibilityCandidate['riskLevel'] {
  if (riskScore == null && readiness == null) return 'UNMEASURED';
  if (riskScore != null) {
    if (riskScore >= 70) return 'HIGH';
    if (riskScore >= 40) return 'MEDIUM';
    return 'LOW';
  }
  if (readiness != null) {
    if (readiness < 60) return 'HIGH';
    if (readiness < 80) return 'MEDIUM';
    return 'LOW';
  }
  return 'UNMEASURED';
}

function readinessBand(
  score: number | null,
): FeasibilityCandidate['readinessBand'] {
  if (score == null) return 'PENDING';
  if (score >= 90) return 'EXCELLENT';
  if (score >= 75) return 'GOOD';
  if (score >= 60) return 'MARGINAL';
  return 'NOT_READY';
}

function recommendationFor(
  band: FeasibilityCandidate['readinessBand'],
  risk: FeasibilityCandidate['riskLevel'],
  legal: number | null,
): FeasibilityRecommendation {
  if (band === 'PENDING') return 'Await Scoring';
  if (band === 'NOT_READY' || risk === 'HIGH') return 'Reject';
  if (legal != null && legal < 60) return 'Revise Scope';
  if (band === 'MARGINAL') return 'Revise Scope';
  if (band === 'GOOD' && risk === 'MEDIUM') return 'Increase Budget';
  if (band === 'EXCELLENT' || band === 'GOOD') return 'Proceed';
  return 'Delay Production';
}

function statusFromScore(value: number | null, highIsGood = true): string {
  if (value == null) return 'UNMEASURED';
  if (highIsGood) {
    if (value >= 80) return 'READY';
    if (value >= 60) return 'PARTIAL';
    return 'BLOCKED';
  }
  if (value >= 70) return 'HIGH_RISK';
  if (value >= 40) return 'ELEVATED';
  return 'LOW';
}

function budgetLinesFrom(meta: Record<string, unknown>): Array<{
  label: string;
  amount: number | null;
}> {
  const budgetObj =
    (meta.budgetLines as Record<string, unknown> | undefined) ??
    (meta.costs as Record<string, unknown> | undefined);
  return BUDGET_LINES.map((label) => {
    const key = label.replace(/\s+/g, '');
    const fromObj =
      budgetObj && typeof budgetObj === 'object'
        ? num(budgetObj[label] ?? budgetObj[key] ?? budgetObj[label.toLowerCase()])
        : null;
    return {
      label,
      amount:
        fromObj ??
        nestedNum(meta, [
          label,
          key,
          label.toLowerCase().replace(/\s+/g, ''),
        ]),
    };
  });
}

function timelineFrom(meta: Record<string, unknown>): Array<{
  label: string;
  days: number | null;
}> {
  const timelineObj =
    (meta.timeline as Record<string, unknown> | undefined) ??
    (meta.schedule as Record<string, unknown> | undefined);
  return TIMELINE_STAGES.map((label) => {
    const key = label.replace(/\s+/g, '');
    const fromObj =
      timelineObj && typeof timelineObj === 'object'
        ? num(timelineObj[label] ?? timelineObj[key])
        : null;
    return {
      label,
      days:
        fromObj ??
        nestedNum(meta, [`${key}Days`, `${label.toLowerCase()}Days`, key]),
    };
  });
}

function optimizationHints(input: {
  readiness: number | null;
  budget: number | null;
  legal: number | null;
  research: number | null;
  risk: FeasibilityCandidate['riskLevel'];
}): string[] {
  const tips: string[] = [];
  if (input.budget == null) tips.push('Persist budget model outputs for cost forecasting');
  if (input.readiness != null && input.readiness < 85) tips.push('Reduce scope');
  if (input.legal != null && input.legal < 75) tips.push('Acquire additional licensing clearances');
  if (input.research != null && input.research < 75) tips.push('Acquire additional sources');
  if (input.risk === 'HIGH' || input.risk === 'MEDIUM') tips.push('Delay production one week');
  tips.push('Use public domain images');
  tips.push('Use AI narration');
  tips.push('Replace paid footage');
  return [...new Set(tips)].slice(0, 8);
}

export async function loadProductionFeasibility(): Promise<ProductionFeasibilityOverview> {
  try {
    const intakes = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT TOP 1 status
      FROM iq_intake_packages
      WHERE status = 'ACKNOWLEDGED'
      ORDER BY acknowledged_at DESC
    `;

    const cycles = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT TOP 1 status FROM iq_cycles ORDER BY created_at DESC
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
        confidence: number | string;
        createdAt: Date;
        updatedAt: Date;
        factorsJson: string | null;
        totalScore: number | string | null;
        modelVersion: string | null;
        evidencePassed: number | bigint;
        evidenceFailed: number | bigint;
        avgRiskScore: number | string | null;
        riskCount: number | bigint;
      }>
    >`
      SELECT TOP 100
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
        s.total_score AS totalScore,
        s.model_version AS modelVersion,
        (
          SELECT COUNT(*) FROM iq_evidence_checks e
          WHERE e.candidate_id = c.id AND e.status IN ('PASSED','PASS','OK','CLEARED','COMPLETE')
        ) AS evidencePassed,
        (
          SELECT COUNT(*) FROM iq_evidence_checks e
          WHERE e.candidate_id = c.id AND e.status IN ('FAILED','FAIL','REJECTED','INSUFFICIENT','MISSING')
        ) AS evidenceFailed,
        (
          SELECT AVG(CAST(risk_score AS float)) FROM iq_risk_assessments rk
          WHERE rk.candidate_id = c.id
        ) AS avgRiskScore,
        (
          SELECT COUNT(*) FROM iq_risk_assessments rk WHERE rk.candidate_id = c.id
        ) AS riskCount
      FROM iq_candidates c
      OUTER APPLY (
        SELECT TOP 1 *
        FROM iq_scores sc
        WHERE sc.candidate_id = c.id
        ORDER BY sc.scored_at DESC
      ) s
      ORDER BY
        COALESCE(
          TRY_CONVERT(float, JSON_VALUE(s.factors_json, '$.feasibility')),
          s.total_score,
          c.score
        ) DESC,
        c.updated_at DESC
    `;

    const riskRows = await prisma.$queryRaw<
      Array<{
        candidateId: string;
        category: string;
        severity: string;
        score: number | string;
      }>
    >`
      SELECT TOP 500
        CONVERT(varchar(36), candidate_id) AS candidateId,
        category,
        severity,
        risk_score AS score
      FROM iq_risk_assessments
      ORDER BY assessed_at DESC
    `;

    const decisionCount = await prisma.$queryRaw<Array<{ count: number | bigint }>>`
      SELECT COUNT(*) AS count FROM iq_decisions
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
      WHERE action LIKE '%FEASIB%'
         OR action LIKE '%PRODUC%'
         OR action LIKE '%BUDGET%'
         OR action LIKE '%SCORE%'
         OR action LIKE '%RISK%'
         OR action LIKE '%QUALIF%'
      ORDER BY created_at DESC
    `;

    const risksByCandidate = new Map<
      string,
      Array<{ category: string; severity: string; score: number }>
    >();
    for (const row of riskRows) {
      const list = risksByCandidate.get(row.candidateId) ?? [];
      if (list.length < 10) {
        list.push({
          category: row.category,
          severity: row.severity,
          score: Math.round(Number(row.score)),
        });
      }
      risksByCandidate.set(row.candidateId, list);
    }

    const domainBuckets = new Map<string, number[]>();

    const candidates: FeasibilityCandidate[] = rows.map((row) => {
      const factors = parseFactors(row.factorsJson);
      const meta = parseMeta(row.factorsJson);
      const productionReadiness = factors?.feasibility ?? null;
      const estimatedBudget = nestedNum(meta, [
        'estimatedBudget',
        'totalCost',
        'budgetTotal',
      ]);
      const timeline = timelineFrom(meta);
      const timelineDays = timeline
        .map((item) => item.days)
        .filter((v): v is number => v != null);
      const estimatedDurationDays =
        nestedNum(meta, ['estimatedDurationDays', 'totalDays', 'durationDays']) ??
        (timelineDays.length ? timelineDays.reduce((a, b) => a + b, 0) : null);
      const resourceAvailability =
        nestedNum(meta, ['resourceAvailability', 'resources']) ??
        factors?.sourceAvailability ??
        null;
      const technicalComplexity =
        nestedNum(meta, ['technicalComplexity', 'complexity']) ?? null;
      const legalRisks = (risksByCandidate.get(row.id) ?? []).filter((r) =>
        /copy|right|legal|license|ip|privacy|gdpr|trade/i.test(r.category),
      );
      const legalReadiness =
        nestedNum(meta, ['legalReadiness', 'legal']) ??
        (legalRisks.length
          ? Math.max(0, 100 - Math.round(avg(legalRisks.map((r) => r.score)) ?? 0))
          : null);
      const evidencePassed = Number(row.evidencePassed);
      const evidenceFailed = Number(row.evidenceFailed);
      const evidenceTotal = evidencePassed + evidenceFailed;
      const researchCompletion =
        nestedNum(meta, ['researchCompletion', 'research']) ??
        factors?.evidence ??
        (evidenceTotal > 0
          ? Math.round((evidencePassed / evidenceTotal) * 100)
          : null);
      const avgRisk = num(row.avgRiskScore) ?? factors?.risk ?? null;
      const riskLevel = riskLevelFrom(avgRisk, productionReadiness);
      const staffingAvailability =
        nestedNum(meta, ['staffingAvailability', 'staffing']) ?? null;
      const confidence = num(row.confidence);
      const measuredConfidence = confidence != null && confidence >= 1;
      const band = readinessBand(productionReadiness);
      const recommendation = recommendationFor(band, riskLevel, legalReadiness);

      if (productionReadiness != null) {
        const bucket = domainBuckets.get(row.domain) ?? [];
        bucket.push(productionReadiness);
        domainBuckets.set(row.domain, bucket);
      }

      const budgetLines = budgetLinesFrom(meta);
      const budgetMeasured = budgetLines
        .map((l) => l.amount)
        .filter((v): v is number => v != null);
      const totalBudget =
        estimatedBudget ??
        (budgetMeasured.length
          ? Math.round(budgetMeasured.reduce((a, b) => a + b, 0))
          : null);

      const explainability: string[] = [];
      if (productionReadiness != null) {
        explainability.push(
          `Production readiness ${productionReadiness}% (${band.toLowerCase().replaceAll('_', ' ')})`,
        );
      }
      if (researchCompletion != null) {
        explainability.push(`Research completion ${researchCompletion}%`);
      }
      if (resourceAvailability != null) {
        explainability.push(`Resource / source availability ${resourceAvailability}%`);
      }
      if (legalReadiness != null) {
        explainability.push(`Legal readiness ${legalReadiness}%`);
      }
      if (totalBudget != null) {
        explainability.push(`Estimated budget ${totalBudget}`);
      }
      if (estimatedDurationDays != null) {
        explainability.push(`Estimated duration ${estimatedDurationDays} days`);
      }
      if (riskLevel !== 'UNMEASURED') {
        explainability.push(`Risk level ${riskLevel}`);
      }
      if (!explainability.length) {
        explainability.push('No feasibility factor or production meta persisted yet');
      }

      const createdAt = row.createdAt.toISOString();
      const updatedAt = row.updatedAt.toISOString();
      const candidateRisks = risksByCandidate.get(row.id) ?? [];

      const riskMatrixDefaults = [
        { area: 'Budget', key: /budget|cost|financ/i },
        { area: 'Schedule', key: /sched|time|delay/i },
        { area: 'Copyright', key: /copy|right|ip|license/i },
        { area: 'Interviews', key: /interview|expert|talent/i },
        { area: 'AI Generation', key: /ai|generat|render/i },
        { area: 'Publishing', key: /publish|distrib/i },
      ];

      const riskMatrix = riskMatrixDefaults.map((item) => {
        const match = candidateRisks.find((r) => item.key.test(r.category));
        if (match) {
          const level =
            match.score >= 70 ? 'High' : match.score >= 40 ? 'Medium' : 'Low';
          return { area: item.area, risk: level, score: match.score };
        }
        if (item.area === 'Budget' && totalBudget == null && productionReadiness != null) {
          return { area: item.area, risk: 'UNMEASURED', score: null };
        }
        if (item.area === 'Copyright' && legalReadiness != null) {
          return {
            area: item.area,
            risk:
              legalReadiness >= 80 ? 'Low' : legalReadiness >= 60 ? 'Medium' : 'High',
            score: Math.max(0, 100 - legalReadiness),
          };
        }
        return { area: item.area, risk: 'UNMEASURED', score: null };
      });

      const bottlenecks: string[] = [];
      if (researchCompletion != null && researchCompletion < 70) {
        bottlenecks.push('Missing sources / incomplete research');
      }
      if (legalReadiness != null && legalReadiness < 70) {
        bottlenecks.push('Legal / rights constraints');
      }
      if (resourceAvailability != null && resourceAvailability < 70) {
        bottlenecks.push('Resource availability constraints');
      }
      if (totalBudget == null) bottlenecks.push('Budget model not persisted');
      if (estimatedDurationDays == null) bottlenecks.push('Schedule model not persisted');
      if (technicalComplexity != null && technicalComplexity >= 75) {
        bottlenecks.push('High technical / compute complexity');
      }
      if (!bottlenecks.length && productionReadiness != null) {
        bottlenecks.push('No critical bottlenecks flagged from persisted signals');
      }
      if (!bottlenecks.length) {
        bottlenecks.push('Await feasibility scoring before bottleneck analysis');
      }

      return {
        id: row.id,
        title: row.title,
        summary: row.summary,
        domain: row.domain,
        audience: row.audience,
        geography: row.geography,
        formatHint: row.formatHint,
        candidateStatus: row.status,
        gateStatus: row.gateStatus,
        decision: row.decision,
        productionReadiness,
        estimatedBudget: totalBudget,
        estimatedDurationDays,
        resourceAvailability,
        confidence,
        measuredConfidence,
        technicalComplexity,
        legalReadiness,
        researchCompletion,
        riskLevel,
        staffingAvailability,
        recommendation,
        readinessBand: band,
        explainability,
        aiSummary:
          productionReadiness != null
            ? `${row.title} scores ${productionReadiness}% production readiness (${band.replaceAll('_', ' ').toLowerCase()}). Recommendation: ${recommendation}.`
            : `${row.title} awaits persisted feasibility scoring from the qualification cycle.`,
        readinessBreakdown: [
          { label: 'Research', value: researchCompletion },
          {
            label: 'Budget',
            value: nestedNum(meta, ['budgetReadiness']) ?? (totalBudget != null ? productionReadiness : null),
          },
          { label: 'Resources', value: resourceAvailability },
          { label: 'Legal', value: legalReadiness },
          {
            label: 'Technology',
            value:
              nestedNum(meta, ['technologyReadiness']) ??
              (technicalComplexity != null ? Math.max(0, 100 - technicalComplexity) : null),
          },
          {
            label: 'Scheduling',
            value:
              nestedNum(meta, ['scheduleReadiness']) ??
              (estimatedDurationDays != null ? productionReadiness : null),
          },
          {
            label: 'Quality',
            value: nestedNum(meta, ['qualityReadiness']) ?? productionReadiness,
          },
        ],
        budgetLines: [
          ...budgetLines,
          { label: 'Total Estimated Cost', amount: totalBudget },
        ],
        timeline: [
          ...timeline,
          { label: 'Total', days: estimatedDurationDays },
        ],
        resources: [
          {
            label: 'Researchers',
            status: statusFromScore(researchCompletion),
            detail:
              researchCompletion != null
                ? `Research ${researchCompletion}%`
                : 'No research availability payload',
          },
          {
            label: 'Writers / Script',
            status: nestedNum(meta, ['writers']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['writers']) != null
                ? `Score ${nestedNum(meta, ['writers'])}`
                : 'No writer capacity payload',
          },
          {
            label: 'AI Agents',
            status: nestedNum(meta, ['aiAgents']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['aiAgents']) != null
                ? `Score ${nestedNum(meta, ['aiAgents'])}`
                : 'No AI agent capacity payload',
          },
          {
            label: 'Voice / Image / Video models',
            status:
              nestedNum(meta, ['modelCapacity']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['modelCapacity']) != null
                ? `Score ${nestedNum(meta, ['modelCapacity'])}`
                : 'No model capacity payload',
          },
          {
            label: 'Editors / Fact checkers',
            status: staffingAvailability != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              staffingAvailability != null
                ? `Staffing ${staffingAvailability}%`
                : 'No staffing payload',
          },
          {
            label: 'Subject experts',
            status: nestedNum(meta, ['subjectExperts']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['subjectExperts']) != null
                ? `Score ${nestedNum(meta, ['subjectExperts'])}`
                : 'No expert availability payload',
          },
          {
            label: 'GPU / servers / storage / bandwidth',
            status:
              nestedNum(meta, ['infraCapacity', 'gpuCapacity']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail:
              nestedNum(meta, ['infraCapacity', 'gpuCapacity']) != null
                ? `Score ${nestedNum(meta, ['infraCapacity', 'gpuCapacity'])}`
                : 'No infrastructure capacity payload',
          },
          {
            label: 'Source availability',
            status: statusFromScore(factors?.sourceAvailability ?? null),
            detail:
              factors?.sourceAvailability != null
                ? `sourceAvailability ${factors.sourceAvailability}`
                : 'No sourceAvailability factor',
          },
        ],
        technical: [
          {
            label: 'AI Compute',
            value: nestedNum(meta, ['aiCompute', 'compute']),
          },
          {
            label: 'Rendering Time',
            value: nestedNum(meta, ['renderingTime', 'renderHours']),
          },
          {
            label: 'Storage Requirements',
            value: nestedNum(meta, ['storageRequirements', 'storage']),
          },
          {
            label: 'GPU Hours',
            value: nestedNum(meta, ['gpuHours']),
          },
          {
            label: 'Inference Cost',
            value: nestedNum(meta, ['inferenceCost']),
          },
          {
            label: 'Processing Complexity',
            value: technicalComplexity,
          },
          {
            label: 'Memory Usage',
            value: nestedNum(meta, ['memoryUsage']),
          },
        ],
        legal: [
          {
            label: 'Copyright',
            status: statusFromScore(legalReadiness),
            detail:
              legalReadiness != null
                ? `Legal readiness ${legalReadiness}`
                : 'No copyright readiness signal',
          },
          {
            label: 'Licensing',
            status: legalRisks.some((r) => /licen/i.test(r.category))
              ? 'EVALUATED'
              : 'UNMEASURED',
            detail: 'From iq_risk_assessments when present',
          },
          {
            label: 'Image / Music rights',
            status:
              nestedNum(meta, ['mediaRights']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['mediaRights']) != null
                ? `Score ${nestedNum(meta, ['mediaRights'])}`
                : 'No media-rights payload',
          },
          {
            label: 'Fair use / interview permissions',
            status:
              nestedNum(meta, ['fairUse', 'interviewPermissions']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail: 'Nested feasibility meta when present',
          },
          {
            label: 'Privacy / GDPR',
            status: legalRisks.some((r) => /privacy|gdpr/i.test(r.category))
              ? 'EVALUATED'
              : 'UNMEASURED',
            detail: 'From risk assessments when category matches',
          },
          {
            label: 'Regional / trademark / government',
            status:
              nestedNum(meta, ['regionalRestrictions']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail:
              nestedNum(meta, ['regionalRestrictions']) != null
                ? `Score ${nestedNum(meta, ['regionalRestrictions'])}`
                : 'No regional restriction payload',
          },
        ],
        research: [
          {
            label: 'Available sources',
            status: statusFromScore(researchCompletion),
            detail:
              evidenceTotal > 0
                ? `${evidencePassed} passed / ${evidenceFailed} failed evidence checks`
                : researchCompletion != null
                  ? `Research ${researchCompletion}%`
                  : 'No evidence checks',
          },
          {
            label: 'Missing evidence',
            status: evidenceFailed > 0 ? 'GAPS' : evidenceTotal > 0 ? 'CLEAR' : 'UNMEASURED',
            detail:
              evidenceFailed > 0
                ? `${evidenceFailed} failed checks`
                : 'No failed checks observed',
          },
          {
            label: 'Expert interviews needed',
            status:
              nestedNum(meta, ['interviewsNeeded']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['interviewsNeeded']) != null
                ? `Score ${nestedNum(meta, ['interviewsNeeded'])}`
                : 'No interview-need payload',
          },
          {
            label: 'Archives / records / papers',
            status: statusFromScore(factors?.sourceAvailability ?? null),
            detail:
              factors?.sourceAvailability != null
                ? `sourceAvailability ${factors.sourceAvailability}`
                : 'UNMEASURED',
          },
          {
            label: 'Exclusive material needed',
            status:
              nestedNum(meta, ['exclusiveMaterial']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['exclusiveMaterial']) != null
                ? `Score ${nestedNum(meta, ['exclusiveMaterial'])}`
                : 'No exclusive-material payload',
          },
        ],
        contentAvailability: [
          {
            label: 'Existing images / footage',
            status:
              nestedNum(meta, ['existingFootage', 'images']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail:
              nestedNum(meta, ['existingFootage', 'images']) != null
                ? `Score ${nestedNum(meta, ['existingFootage', 'images'])}`
                : 'No footage inventory payload',
          },
          {
            label: 'Maps / charts / animations',
            status: statusFromScore(factors?.visualPotential ?? null),
            detail:
              factors?.visualPotential != null
                ? `visualPotential ${factors.visualPotential}`
                : 'UNMEASURED',
          },
          {
            label: 'AI-generated assets',
            status:
              nestedNum(meta, ['aiAssets']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['aiAssets']) != null
                ? `Score ${nestedNum(meta, ['aiAssets'])}`
                : 'No AI asset readiness payload',
          },
          {
            label: 'Archive material',
            status: statusFromScore(factors?.sourceAvailability ?? null),
            detail:
              factors?.sourceAvailability != null
                ? `sourceAvailability ${factors.sourceAvailability}`
                : 'UNMEASURED',
          },
        ],
        simulation: [
          {
            label: 'Total Cost',
            value: totalBudget != null ? String(totalBudget) : null,
          },
          {
            label: 'Expected Quality',
            value:
              nestedNum(meta, ['expectedQuality']) != null
                ? `${nestedNum(meta, ['expectedQuality'])}%`
                : productionReadiness != null
                  ? `${productionReadiness}%`
                  : null,
          },
          {
            label: 'Production Time',
            value:
              estimatedDurationDays != null ? `${estimatedDurationDays} days` : null,
          },
          {
            label: 'Failure Probability',
            value:
              nestedNum(meta, ['failureProbability']) != null
                ? `${nestedNum(meta, ['failureProbability'])}%`
                : null,
          },
          {
            label: 'Human Review Points',
            value:
              nestedNum(meta, ['humanReviewPoints']) != null
                ? String(nestedNum(meta, ['humanReviewPoints']))
                : null,
          },
        ],
        bottlenecks,
        riskMatrix,
        equipment: [
          {
            label: 'GPU Cluster / Render Servers',
            status:
              nestedNum(meta, ['gpuCapacity', 'renderServers']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail:
              nestedNum(meta, ['gpuCapacity', 'renderServers']) != null
                ? `Score ${nestedNum(meta, ['gpuCapacity', 'renderServers'])}`
                : 'No GPU / render payload',
          },
          {
            label: 'Cloud Credits / Storage / Backup',
            status:
              nestedNum(meta, ['cloudCredits', 'storage']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail: 'Nested infrastructure meta when present',
          },
          {
            label: 'Production APIs',
            status:
              nestedNum(meta, ['productionApis']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['productionApis']) != null
                ? `Score ${nestedNum(meta, ['productionApis'])}`
                : 'No API readiness payload',
          },
          {
            label: 'Voice / Image / Video models',
            status:
              nestedNum(meta, ['modelCapacity']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['modelCapacity']) != null
                ? `Score ${nestedNum(meta, ['modelCapacity'])}`
                : 'No model capacity payload',
          },
        ],
        externalDependencies: [
          {
            label: 'Google APIs',
            status: nestedNum(meta, ['googleApis']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail: 'Dependency payload when present',
          },
          {
            label: 'OpenAI / LLM providers',
            status: nestedNum(meta, ['llmProviders']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail: 'Dependency payload when present',
          },
          {
            label: 'Image / Voice / Video providers',
            status:
              nestedNum(meta, ['mediaProviders']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail: 'Dependency payload when present',
          },
          {
            label: 'Cloud storage / translation / publishing',
            status:
              nestedNum(meta, ['cloudPublishing']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail: 'Dependency payload when present',
          },
          {
            label: 'Social platforms',
            status:
              nestedNum(meta, ['socialPlatforms']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail: 'Dependency payload when present',
          },
        ],
        humanResources: [
          {
            role: 'Researchers',
            needed: nestedNum(meta, ['researchersNeeded']),
            status: researchCompletion != null ? 'PLANNED' : 'UNMEASURED',
          },
          {
            role: 'Editors',
            needed: nestedNum(meta, ['editorsNeeded']),
            status:
              nestedNum(meta, ['editorsNeeded']) != null ? 'PLANNED' : 'UNMEASURED',
          },
          {
            role: 'Reviewers / QA',
            needed: nestedNum(meta, ['reviewersNeeded', 'qaNeeded']),
            status:
              nestedNum(meta, ['reviewersNeeded', 'qaNeeded']) != null
                ? 'PLANNED'
                : 'UNMEASURED',
          },
          {
            role: 'Subject Experts',
            needed: nestedNum(meta, ['expertsNeeded']),
            status:
              nestedNum(meta, ['expertsNeeded']) != null ? 'PLANNED' : 'UNMEASURED',
          },
          {
            role: 'Legal Reviewers',
            needed: nestedNum(meta, ['legalReviewersNeeded']),
            status: legalReadiness != null ? 'PLANNED' : 'UNMEASURED',
          },
          {
            role: 'Narrators / Translators',
            needed: nestedNum(meta, ['narratorsNeeded', 'translatorsNeeded']),
            status:
              nestedNum(meta, ['narratorsNeeded', 'translatorsNeeded']) != null
                ? 'PLANNED'
                : 'UNMEASURED',
          },
        ],
        pipelineCompatibility: [
          'Research',
          'Script',
          'Storyboard',
          'Image Generation',
          'Animation',
          'Narration',
          'Timeline Assembly',
          'Rendering',
          'QA',
          'Publishing',
        ].map((stage) => ({
          stage,
          status:
            productionReadiness == null
              ? 'UNMEASURED'
              : productionReadiness >= 70
                ? 'COMPATIBLE'
                : 'AT_RISK',
        })),
        gantt: timeline,
        financial: [
          {
            label: 'Expected Cost',
            value: totalBudget != null ? String(totalBudget) : null,
          },
          {
            label: 'Actual Budget',
            value:
              nestedNum(meta, ['actualBudget']) != null
                ? String(nestedNum(meta, ['actualBudget']))
                : null,
          },
          {
            label: 'Variance',
            value:
              nestedNum(meta, ['budgetVariance']) != null
                ? String(nestedNum(meta, ['budgetVariance']))
                : null,
          },
          {
            label: 'Cost per Minute',
            value:
              nestedNum(meta, ['costPerMinute']) != null
                ? String(nestedNum(meta, ['costPerMinute']))
                : null,
          },
          {
            label: 'Cost per Scene',
            value:
              nestedNum(meta, ['costPerScene']) != null
                ? String(nestedNum(meta, ['costPerScene']))
                : null,
          },
          {
            label: 'AI Cost',
            value:
              nestedNum(meta, ['aiCost']) != null
                ? String(nestedNum(meta, ['aiCost']))
                : null,
          },
          {
            label: 'Human Cost',
            value:
              nestedNum(meta, ['humanCost']) != null
                ? String(nestedNum(meta, ['humanCost']))
                : null,
          },
          {
            label: 'Cloud Cost',
            value:
              nestedNum(meta, ['cloudCost']) != null
                ? String(nestedNum(meta, ['cloudCost']))
                : null,
          },
        ],
        scenarios: [
          {
            label: 'Best Case',
            readiness: nestedNum(meta, ['bestCaseReadiness']),
            note: 'Persisted scenario only',
          },
          {
            label: 'Expected Case',
            readiness: productionReadiness,
            note: 'Current feasibility score',
          },
          {
            label: 'Worst Case',
            readiness: nestedNum(meta, ['worstCaseReadiness']),
            note: 'Persisted scenario only',
          },
          {
            label: 'Budget Increase',
            readiness: nestedNum(meta, ['budgetIncreaseReadiness']),
            note: 'UNMEASURED unless scenario payload written',
          },
          {
            label: 'Budget Reduction',
            readiness: nestedNum(meta, ['budgetReductionReadiness']),
            note: 'UNMEASURED unless scenario payload written',
          },
          {
            label: 'Schedule Compression',
            readiness: nestedNum(meta, ['scheduleCompressionReadiness']),
            note: 'UNMEASURED unless scenario payload written',
          },
        ],
        optimization: optimizationHints({
          readiness: productionReadiness,
          budget: totalBudget,
          legal: legalReadiness,
          research: researchCompletion,
          risk: riskLevel,
        }),
        dependencies: [
          {
            label: 'Research',
            status: researchCompletion != null ? 'TRACKED' : 'UNMEASURED',
            criticality: 'HIGH',
            detail:
              researchCompletion != null
                ? `${researchCompletion}% complete`
                : 'No research completion signal',
          },
          {
            label: 'Legal approvals',
            status: legalReadiness != null ? 'TRACKED' : 'UNMEASURED',
            criticality: 'HIGH',
            detail:
              legalReadiness != null
                ? `${legalReadiness}% ready`
                : 'No legal readiness signal',
          },
          {
            label: 'Script / Storyboard',
            status: 'UNMEASURED',
            criticality: 'MEDIUM',
            detail: 'Downstream Stage 05 dependency not scored here',
          },
          {
            label: 'Image / Narration / Editing',
            status: factors?.visualPotential != null ? 'TRACKED' : 'UNMEASURED',
            criticality: 'MEDIUM',
            detail:
              factors?.visualPotential != null
                ? `visualPotential ${factors.visualPotential}`
                : 'No visual production signal',
          },
          {
            label: 'QA / Publishing',
            status: productionReadiness != null ? 'TRACKED' : 'UNMEASURED',
            criticality: 'MEDIUM',
            detail:
              productionReadiness != null
                ? `Readiness ${productionReadiness}%`
                : 'Await feasibility score',
          },
        ],
        lifecycle: [
          { key: 'research', label: 'Research assessment', done: researchCompletion != null, at: researchCompletion != null ? updatedAt : null },
          { key: 'resources', label: 'Resource analysis', done: resourceAvailability != null, at: resourceAvailability != null ? updatedAt : null },
          { key: 'budget', label: 'Budget prediction', done: totalBudget != null, at: totalBudget != null ? updatedAt : null },
          { key: 'timeline', label: 'Timeline forecast', done: estimatedDurationDays != null, at: estimatedDurationDays != null ? updatedAt : null },
          { key: 'legal', label: 'Legal verification', done: legalReadiness != null, at: legalReadiness != null ? updatedAt : null },
          { key: 'risk', label: 'Risk assessment', done: riskLevel !== 'UNMEASURED', at: riskLevel !== 'UNMEASURED' ? updatedAt : null },
          { key: 'readiness', label: 'Production readiness', done: productionReadiness != null, at: productionReadiness != null ? updatedAt : null },
          {
            key: 'decision',
            label: 'Proceed / Revise / Reject',
            done: recommendation !== 'Await Scoring',
            at: recommendation !== 'Await Scoring' ? updatedAt : null,
          },
        ],
        factors,
        modelVersion: row.modelVersion,
        createdAt,
        updatedAt,
      };
    });

    const readyCount = candidates.filter(
      (c) => c.readinessBand === 'EXCELLENT' || c.readinessBand === 'GOOD',
    ).length;
    const reviseCount = candidates.filter(
      (c) =>
        c.recommendation === 'Revise Scope' ||
        c.recommendation === 'Increase Budget' ||
        c.recommendation === 'Delay Production',
    ).length;
    const rejectCount = candidates.filter((c) => c.recommendation === 'Reject').length;
    const highRiskCount = candidates.filter((c) => c.riskLevel === 'HIGH').length;

    const readinessScores = candidates
      .map((c) => c.productionReadiness)
      .filter((v): v is number => v != null);
    const budgetScores = candidates
      .map((c) => c.estimatedBudget)
      .filter((v): v is number => v != null);
    const durationScores = candidates
      .map((c) => c.estimatedDurationDays)
      .filter((v): v is number => v != null);
    const resourceScores = candidates
      .map((c) => c.resourceAvailability)
      .filter((v): v is number => v != null);
    const confidenceScores = candidates
      .filter((c) => c.measuredConfidence)
      .map((c) => c.confidence)
      .filter((v): v is number => v != null);
    const complexityScores = candidates
      .map((c) => c.technicalComplexity)
      .filter((v): v is number => v != null);
    const legalScores = candidates
      .map((c) => c.legalReadiness)
      .filter((v): v is number => v != null);
    const researchScores = candidates
      .map((c) => c.researchCompletion)
      .filter((v): v is number => v != null);
    const staffingScores = candidates
      .map((c) => c.staffingAvailability)
      .filter((v): v is number => v != null);

    const recommendations: ProductionFeasibilityOverview['recommendations'] = [];
    for (const item of candidates.slice(0, 12)) {
      recommendations.push({
        id: `pf-${item.id}`,
        action: item.recommendation,
        reason: `${item.title} · ${item.readinessBand} · readiness ${item.productionReadiness ?? 'UNMEAS.'}`,
        priority:
          item.recommendation === 'Reject' || item.riskLevel === 'HIGH'
            ? 'HIGH'
            : item.recommendation === 'Proceed'
              ? 'LOW'
              : 'MEDIUM',
        candidateId: item.id,
      });
      for (const tip of item.optimization.slice(0, 1)) {
        recommendations.push({
          id: `opt-${item.id}`,
          action: tip,
          reason: `Cost / scope optimizer for ${item.title}`,
          priority: 'MEDIUM',
          candidateId: item.id,
        });
      }
    }

    const notifications: ProductionFeasibilityOverview['notifications'] = [];
    for (const item of candidates.slice(0, 10)) {
      if (item.recommendation === 'Proceed') {
        notifications.push({
          id: `ok-${item.id}`,
          severity: 'INFO',
          message: `Production ready: ${item.title}`,
        });
      }
      if (item.riskLevel === 'HIGH' || item.recommendation === 'Reject') {
        notifications.push({
          id: `risk-${item.id}`,
          severity: 'CRITICAL',
          message: `Feasibility blocked: ${item.title}`,
        });
      }
      if (
        item.recommendation === 'Revise Scope' ||
        item.recommendation === 'Increase Budget' ||
        item.recommendation === 'Delay Production'
      ) {
        notifications.push({
          id: `rev-${item.id}`,
          severity: 'WARNING',
          message: `${item.recommendation}: ${item.title}`,
        });
      }
    }

    const modelVersions = [
      ...new Set(
        candidates.map((c) => c.modelVersion).filter((v): v is string => Boolean(v)),
      ),
    ];

    const hasScores = readinessScores.length > 0;
    const pipeline = [
      { key: 'research', label: 'Research Assessment' },
      { key: 'resources', label: 'Resource Analysis' },
      { key: 'budget', label: 'Budget Prediction' },
      { key: 'timeline', label: 'Timeline Forecast' },
      { key: 'legal', label: 'Legal Verification' },
      { key: 'risk', label: 'Risk Assessment' },
      { key: 'readiness', label: 'Production Readiness' },
      { key: 'decision', label: 'Proceed / Revise / Reject' },
    ].map((item, index) => {
      let state: 'pending' | 'active' | 'done' | 'failed' = 'pending';
      if (rejectCount > 0 && item.key === 'readiness') state = 'failed';
      else if (readyCount > 0 && index <= 7) state = 'done';
      else if (hasScores && index <= 4) state = 'done';
      else if (hasScores && index === 5) state = 'active';
      else if (rows.length && index === 0) state = 'active';
      return { ...item, state };
    });

    const recommendationDistribution = new Map<string, number>();
    for (const item of candidates) {
      recommendationDistribution.set(
        item.recommendation,
        (recommendationDistribution.get(item.recommendation) ?? 0) + 1,
      );
    }

    return {
      available: true,
      meta: {
        cycleStatus: cycles[0]?.status ?? 'NOT_STARTED',
        intakeStatus: intakes[0]?.status ?? null,
        modelVersions,
      },
      metrics: {
        averageReadiness: avg(readinessScores),
        estimatedBudget: avg(budgetScores),
        estimatedDurationDays: avg(durationScores),
        resourceAvailability: avg(resourceScores),
        aiConfidence: avg(confidenceScores),
        technicalComplexity: avg(complexityScores),
        legalReadiness: avg(legalScores),
        researchCompletion: avg(researchScores),
        highRiskCount,
        staffingAvailability: avg(staffingScores),
        proceedRate: pct(
          candidates.filter((c) => c.recommendation === 'Proceed').length,
          candidates.length,
        ),
        totalCandidates: candidates.length,
        readyCount,
        reviseCount,
        rejectCount,
      },
      pipeline,
      candidates,
      recommendations,
      analytics: {
        readinessDistribution: [
          {
            label: 'EXCELLENT',
            count: candidates.filter((c) => c.readinessBand === 'EXCELLENT').length,
          },
          {
            label: 'GOOD',
            count: candidates.filter((c) => c.readinessBand === 'GOOD').length,
          },
          {
            label: 'MARGINAL',
            count: candidates.filter((c) => c.readinessBand === 'MARGINAL').length,
          },
          {
            label: 'NOT_READY',
            count: candidates.filter((c) => c.readinessBand === 'NOT_READY').length,
          },
          {
            label: 'PENDING',
            count: candidates.filter((c) => c.readinessBand === 'PENDING').length,
          },
        ],
        riskDistribution: [
          { label: 'HIGH', count: candidates.filter((c) => c.riskLevel === 'HIGH').length },
          {
            label: 'MEDIUM',
            count: candidates.filter((c) => c.riskLevel === 'MEDIUM').length,
          },
          { label: 'LOW', count: candidates.filter((c) => c.riskLevel === 'LOW').length },
          {
            label: 'UNMEASURED',
            count: candidates.filter((c) => c.riskLevel === 'UNMEASURED').length,
          },
        ],
        recommendationDistribution: [...recommendationDistribution.entries()].map(
          ([label, count]) => ({ label, count }),
        ),
        domainReadiness: [...domainBuckets.entries()]
          .map(([label, scores]) => ({
            label,
            avgScore: avg(scores),
            count: scores.length,
          }))
          .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0)),
      },
      governance: {
        modelVersions,
        decisionsLogged: Number(decisionCount[0]?.count ?? 0),
        auditEvents: auditRows.length,
        riskAssessments: riskRows.length,
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
          ? error.message.replace(/password|secret|token/gi, '[redacted]')
          : 'Production Feasibility unavailable',
      meta: {
        cycleStatus: 'UNAVAILABLE',
        intakeStatus: null,
        modelVersions: [],
      },
      metrics: {
        averageReadiness: null,
        estimatedBudget: null,
        estimatedDurationDays: null,
        resourceAvailability: null,
        aiConfidence: null,
        technicalComplexity: null,
        legalReadiness: null,
        researchCompletion: null,
        highRiskCount: 0,
        staffingAvailability: null,
        proceedRate: null,
        totalCandidates: 0,
        readyCount: 0,
        reviseCount: 0,
        rejectCount: 0,
      },
      pipeline: [],
      candidates: [],
      recommendations: [],
      analytics: {
        readinessDistribution: [],
        riskDistribution: [],
        recommendationDistribution: [],
        domainReadiness: [],
      },
      governance: {
        modelVersions: [],
        decisionsLogged: 0,
        auditEvents: 0,
        riskAssessments: 0,
      },
      notifications: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
