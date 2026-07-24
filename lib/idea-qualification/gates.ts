import { prisma } from '@/lib/db';
import type { FactorScores } from './contracts';
import { DEFAULT_GATES, evaluateGates, scoreCandidate } from './scoring';

export type GateOutcome = 'Pass' | 'Fail' | 'Review' | 'Pending' | 'Blocked';

export type GateDecision =
  | 'Proceed'
  | 'Halt & Remediate'
  | 'Conditional'
  | 'Blocked'
  | 'Await Evaluation';

export type GateCell = {
  code: string;
  label: string;
  status: GateOutcome;
  actual: number | null;
  required: string | null;
  threshold: number | null;
  blocking: boolean;
  confidence: number | null;
  reasoning: string;
  evidence: string | null;
  remediation: string | null;
  evaluatedAt: string | null;
};

export type GateCandidate = {
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
  overallScore: number | null;
  confidence: number | null;
  measuredConfidence: boolean;
  outcome: GateOutcome;
  recommendation: GateDecision;
  complianceScore: number | null;
  passedCount: number;
  failedCount: number;
  reviewCount: number;
  blockingCount: number;
  failedCriteria: string[];
  remediations: string[];
  explainability: string[];
  aiSummary: string;
  gates: GateCell[];
  dependencies: Array<{ from: string; to: string; label: string }>;
  overrides: Array<{
    route: string;
    reason: string;
    status: string;
    priority: string;
  }>;
  lifecycle: Array<{ key: string; label: string; done: boolean; at: string | null }>;
  policyVersion: string | null;
  modelVersion: string | null;
  factors: Partial<FactorScores> | null;
  thresholds: Record<string, number> | null;
  decisionMs: number | null;
  evaluatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MandatoryGatesOverview = {
  available: boolean;
  reason?: string;
  meta: {
    cycleStatus: string;
    intakeStatus: string | null;
    modelVersions: string[];
    policyVersions: string[];
    ruleProfile: string;
  };
  metrics: {
    totalCandidates: number;
    passedGates: number;
    failedGates: number;
    conditionalApproval: number;
    blockedItems: number;
    complianceScore: number | null;
    governanceHealth: number | null;
    averageDecisionTimeMs: number | null;
    evaluatedCandidates: number;
    proceedCount: number;
  };
  pipeline: Array<{
    key: string;
    label: string;
    state: 'pending' | 'active' | 'done' | 'failed';
  }>;
  ruleCatalog: Array<{
    code: string;
    label: string;
    category: string;
    threshold: number | null;
    required: string;
    blocking: boolean;
    sequence: number;
    dependsOn: string[];
  }>;
  candidates: GateCandidate[];
  recommendations: Array<{
    id: string;
    action: string;
    reason: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    candidateId?: string;
  }>;
  analytics: {
    outcomeDistribution: Array<{ label: string; count: number }>;
    gatePerformance: Array<{
      code: string;
      label: string;
      pass: number;
      fail: number;
      review: number;
      passRate: number | null;
    }>;
    bottlenecks: Array<{ code: string; label: string; failCount: number }>;
    passFailTrend: Array<{ label: string; pass: number; fail: number }>;
  };
  governance: {
    modelVersions: string[];
    policyVersions: string[];
    decisionsLogged: number;
    auditEvents: number;
    gateResults: number;
    overrideRequests: number;
    defaultGates: typeof DEFAULT_GATES;
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

const GATE_CATALOG: Array<{
  code: string;
  label: string;
  category: string;
  thresholdKey: keyof typeof DEFAULT_GATES;
  invert?: boolean;
  sequence: number;
  dependsOn: string[];
  blocking: boolean;
}> = [
  {
    code: 'STRATEGIC_FIT',
    label: 'Strategy Alignment',
    category: 'Governance',
    thresholdKey: 'strategicFit',
    sequence: 1,
    dependsOn: [],
    blocking: true,
  },
  {
    code: 'EVIDENCE',
    label: 'Evidence Quality',
    category: 'Quality',
    thresholdKey: 'evidence',
    sequence: 2,
    dependsOn: ['STRATEGIC_FIT'],
    blocking: true,
  },
  {
    code: 'AUDIENCE_VALUE',
    label: 'Audience Value',
    category: 'Commercial',
    thresholdKey: 'audienceValue',
    sequence: 3,
    dependsOn: ['EVIDENCE'],
    blocking: true,
  },
  {
    code: 'ORIGINALITY',
    label: 'Originality',
    category: 'Quality',
    thresholdKey: 'originality',
    sequence: 4,
    dependsOn: ['EVIDENCE'],
    blocking: true,
  },
  {
    code: 'VISUAL_POTENTIAL',
    label: 'Visual Potential',
    category: 'Production',
    thresholdKey: 'visualPotential',
    sequence: 5,
    dependsOn: ['AUDIENCE_VALUE'],
    blocking: true,
  },
  {
    code: 'FEASIBILITY',
    label: 'Production Feasibility',
    category: 'Production',
    thresholdKey: 'feasibility',
    sequence: 6,
    dependsOn: ['VISUAL_POTENTIAL'],
    blocking: true,
  },
  {
    code: 'SOURCE_AVAILABILITY',
    label: 'Source Availability',
    category: 'Production',
    thresholdKey: 'sourceAvailability',
    sequence: 7,
    dependsOn: ['FEASIBILITY'],
    blocking: true,
  },
  {
    code: 'RISK',
    label: 'Risk Ceiling',
    category: 'Legal / Security',
    thresholdKey: 'maxRisk',
    invert: true,
    sequence: 8,
    dependsOn: ['EVIDENCE'],
    blocking: true,
  },
  {
    code: 'DUPLICATE',
    label: 'Duplicate Similarity',
    category: 'Compliance',
    thresholdKey: 'maxDuplicateSimilarity',
    invert: true,
    sequence: 9,
    dependsOn: ['ORIGINALITY'],
    blocking: true,
  },
  {
    code: 'TOTAL_SCORE',
    label: 'Minimum Total Score',
    category: 'Business',
    thresholdKey: 'minimumTotal',
    sequence: 10,
    dependsOn: [
      'STRATEGIC_FIT',
      'EVIDENCE',
      'AUDIENCE_VALUE',
      'ORIGINALITY',
      'VISUAL_POTENTIAL',
      'FEASIBILITY',
      'SOURCE_AVAILABILITY',
      'RISK',
      'DUPLICATE',
    ],
    blocking: true,
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

function normalizeGateStatus(raw: string | null | undefined): GateOutcome {
  const s = (raw ?? '').toUpperCase();
  if (!s || s === 'NOT_EVALUATED' || s === 'PENDING') return 'Pending';
  if (s.includes('BLOCK')) return 'Blocked';
  if (s.includes('PASS') || s === 'OK' || s === 'CLEARED') return 'Pass';
  if (s.includes('FAIL') || s === 'REJECTED') return 'Fail';
  if (s.includes('REVIEW') || s.includes('CONDITIONAL') || s === 'WARN') return 'Review';
  return 'Pending';
}

function codeFromDb(code: string): string {
  const upper = code.toUpperCase().replace(/[\s-]+/g, '_');
  const aliases: Record<string, string> = {
    STRATEGICFIT: 'STRATEGIC_FIT',
    STRATEGIC_FIT: 'STRATEGIC_FIT',
    EVIDENCE: 'EVIDENCE',
    AUDIENCEVALUE: 'AUDIENCE_VALUE',
    AUDIENCE_VALUE: 'AUDIENCE_VALUE',
    ORIGINALITY: 'ORIGINALITY',
    VISUALPOTENTIAL: 'VISUAL_POTENTIAL',
    VISUAL_POTENTIAL: 'VISUAL_POTENTIAL',
    FEASIBILITY: 'FEASIBILITY',
    SOURCEAVAILABILITY: 'SOURCE_AVAILABILITY',
    SOURCE_AVAILABILITY: 'SOURCE_AVAILABILITY',
    RISK: 'RISK',
    MAXRISK: 'RISK',
    DUPLICATE: 'DUPLICATE',
    DUPLICATESIMILARITY: 'DUPLICATE',
    TOTALSCORE: 'TOTAL_SCORE',
    TOTAL_SCORE: 'TOTAL_SCORE',
    MINIMUMTOTAL: 'TOTAL_SCORE',
  };
  return aliases[upper.replace(/_/g, '')] ?? aliases[upper] ?? upper;
}

function factorForCode(
  code: string,
  factors: Partial<FactorScores> | null,
  totalScore: number | null,
): number | null {
  if (!factors && totalScore == null) return null;
  switch (code) {
    case 'STRATEGIC_FIT':
      return factors?.strategicFit ?? null;
    case 'EVIDENCE':
      return factors?.evidence ?? null;
    case 'AUDIENCE_VALUE':
      return factors?.audienceValue ?? null;
    case 'ORIGINALITY':
      return factors?.originality ?? null;
    case 'VISUAL_POTENTIAL':
      return factors?.visualPotential ?? null;
    case 'FEASIBILITY':
      return factors?.feasibility ?? null;
    case 'SOURCE_AVAILABILITY':
      return factors?.sourceAvailability ?? null;
    case 'RISK':
      return factors?.risk ?? null;
    case 'DUPLICATE':
      return factors?.duplicateSimilarity ?? null;
    case 'TOTAL_SCORE':
      return totalScore;
    default:
      return null;
  }
}

function remediationFor(code: string, actual: number | null, required: string | null): string {
  switch (code) {
    case 'STRATEGIC_FIT':
      return 'Strengthen strategy alignment before re-evaluation';
    case 'EVIDENCE':
      return 'Add corroborating sources and clear failed evidence checks';
    case 'AUDIENCE_VALUE':
      return 'Improve audience value signals or refine target segment';
    case 'ORIGINALITY':
      return 'Differentiate narrative angle to raise originality';
    case 'VISUAL_POTENTIAL':
      return 'Enrich visual treatment / asset plan';
    case 'FEASIBILITY':
      return 'Reduce production complexity or resource gaps';
    case 'SOURCE_AVAILABILITY':
      return 'Secure additional source access / releases';
    case 'RISK':
      return 'Mitigate legal / ethical / privacy risk below ceiling';
    case 'DUPLICATE':
      return 'Resolve near-duplicate similarity with prior works';
    case 'TOTAL_SCORE':
      return `Raise weighted total to satisfy ${required ?? 'minimum threshold'}`;
    default:
      return actual != null
        ? `Remediate ${code} (actual ${actual}, required ${required ?? 'n/a'})`
        : `Await ${code} evaluation`;
  }
}

function decisionFor(
  outcome: GateOutcome,
  blockingFails: number,
  reviewCount: number,
): GateDecision {
  if (outcome === 'Pending') return 'Await Evaluation';
  if (outcome === 'Blocked' || blockingFails > 0) return 'Blocked';
  if (outcome === 'Fail') return 'Halt & Remediate';
  if (outcome === 'Review' || reviewCount > 0) return 'Conditional';
  if (outcome === 'Pass') return 'Proceed';
  return 'Await Evaluation';
}

function emptyOverview(reason: string, cycleStatus = 'UNAVAILABLE'): MandatoryGatesOverview {
  return {
    available: false,
    reason,
    meta: {
      cycleStatus,
      intakeStatus: null,
      modelVersions: [],
      policyVersions: [],
      ruleProfile: 'default',
    },
    metrics: {
      totalCandidates: 0,
      passedGates: 0,
      failedGates: 0,
      conditionalApproval: 0,
      blockedItems: 0,
      complianceScore: null,
      governanceHealth: null,
      averageDecisionTimeMs: null,
      evaluatedCandidates: 0,
      proceedCount: 0,
    },
    pipeline: [],
    ruleCatalog: GATE_CATALOG.map((g) => ({
      code: g.code,
      label: g.label,
      category: g.category,
      threshold: DEFAULT_GATES[g.thresholdKey],
      required: g.invert
        ? `<= ${DEFAULT_GATES[g.thresholdKey]}`
        : g.code === 'DUPLICATE'
          ? `< ${DEFAULT_GATES[g.thresholdKey]}`
          : `>= ${DEFAULT_GATES[g.thresholdKey]}`,
      blocking: g.blocking,
      sequence: g.sequence,
      dependsOn: g.dependsOn,
    })),
    candidates: [],
    recommendations: [],
    analytics: {
      outcomeDistribution: [],
      gatePerformance: [],
      bottlenecks: [],
      passFailTrend: [],
    },
    governance: {
      modelVersions: [],
      policyVersions: [],
      decisionsLogged: 0,
      auditEvents: 0,
      gateResults: 0,
      overrideRequests: 0,
      defaultGates: DEFAULT_GATES,
    },
    notifications: [],
    audit: [],
    lastUpdated: new Date().toISOString(),
  };
}

export async function loadMandatoryGates(): Promise<MandatoryGatesOverview> {
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
        thresholdsJson: string | null;
        totalScore: number | string | null;
        scoreConfidence: number | string | null;
        modelVersion: string | null;
        scoredAt: Date | null;
        policyVersion: string | null;
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
        s.thresholds_json AS thresholdsJson,
        s.total_score AS totalScore,
        s.confidence AS scoreConfidence,
        s.model_version AS modelVersion,
        s.scored_at AS scoredAt,
        (
          SELECT TOP 1 d.policy_version
          FROM iq_decisions d
          WHERE d.candidate_id = c.id
          ORDER BY d.created_at DESC
        ) AS policyVersion
      FROM iq_candidates c
      OUTER APPLY (
        SELECT TOP 1 *
        FROM iq_scores sc
        WHERE sc.candidate_id = c.id
        ORDER BY sc.scored_at DESC
      ) s
      ORDER BY c.updated_at DESC
    `;

    const gateRows = await prisma.$queryRaw<
      Array<{
        id: string;
        candidateId: string;
        gateCode: string;
        actualValue: number | string | null;
        requiredValue: string | null;
        status: string;
        blocking: boolean | number;
        explanation: string | null;
        evaluatedAt: Date;
      }>
    >`
      SELECT TOP 2000
        CONVERT(varchar(36), id) AS id,
        CONVERT(varchar(36), candidate_id) AS candidateId,
        gate_code AS gateCode,
        actual_value AS actualValue,
        required_value AS requiredValue,
        status,
        blocking,
        explanation,
        evaluated_at AS evaluatedAt
      FROM iq_gate_results
      ORDER BY evaluated_at DESC
    `;

    const decisionCount = await prisma.$queryRaw<Array<{ count: number | bigint }>>`
      SELECT COUNT(*) AS count FROM iq_decisions
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
      SELECT TOP 50
        CONVERT(varchar(36), id) AS id,
        action,
        actor_type AS actorType,
        created_at AS createdAt,
        reason
      FROM iq_audit_events
      WHERE action LIKE '%GATE%'
         OR action LIKE '%OVERRIDE%'
         OR action LIKE '%POLICY%'
         OR action LIKE '%COMPLI%'
         OR action LIKE '%QUALIF%'
         OR action LIKE '%BLOCK%'
      ORDER BY created_at DESC
    `;

    const gatesByCandidate = new Map<string, typeof gateRows>();
    for (const row of gateRows) {
      const list = gatesByCandidate.get(row.candidateId) ?? [];
      list.push(row);
      gatesByCandidate.set(row.candidateId, list);
    }

    const thresholdsDefault = { ...DEFAULT_GATES };

    const candidates: GateCandidate[] = rows.map((row) => {
      const factors = parseFactors(row.factorsJson);
      const thresholds = parseNumberMap(row.thresholdsJson);
      const thresholdMap = { ...thresholdsDefault, ...(thresholds ?? {}) };
      const confidence = num(row.scoreConfidence) ?? num(row.confidence);
      const measuredConfidence = confidence != null && confidence >= 1;

      let overallScore = num(row.totalScore);
      if (
        overallScore == null &&
        factors &&
        (
          [
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
          ] as const
        ).every((key) => factors[key] != null)
      ) {
        overallScore = scoreCandidate(factors as FactorScores);
      }

      const persisted = gatesByCandidate.get(row.id) ?? [];
      const latestByCode = new Map<string, (typeof gateRows)[number]>();
      for (const g of persisted) {
        const code = codeFromDb(g.gateCode);
        if (!latestByCode.has(code)) latestByCode.set(code, g);
      }

      // Derive missing cells from persisted factors when no gate row exists
      const derivedFailures =
        factors &&
        (
          [
            'strategicFit',
            'evidence',
            'audienceValue',
            'originality',
            'visualPotential',
            'feasibility',
            'sourceAvailability',
            'risk',
            'duplicateSimilarity',
          ] as const
        ).every((key) => factors[key] != null)
          ? evaluateGates(factors as FactorScores, thresholdMap)
          : null;

      const derivedFailSet = new Set(derivedFailures?.failures.map((f) => f.code) ?? []);

      const gates: GateCell[] = GATE_CATALOG.map((meta) => {
        const persistedRow = latestByCode.get(meta.code);
        const threshold = thresholdMap[meta.thresholdKey];
        const requiredDefault = meta.invert
          ? meta.code === 'DUPLICATE'
            ? `< ${threshold}`
            : `<= ${threshold}`
          : `>= ${threshold}`;

        if (persistedRow) {
          const status = normalizeGateStatus(persistedRow.status);
          const actual = num(persistedRow.actualValue);
          return {
            code: meta.code,
            label: meta.label,
            status,
            actual,
            required: persistedRow.requiredValue ?? requiredDefault,
            threshold,
            blocking: Boolean(persistedRow.blocking) || meta.blocking,
            confidence,
            reasoning:
              persistedRow.explanation ??
              `${meta.label}: ${status} (actual ${actual ?? 'n/a'}, required ${persistedRow.requiredValue ?? requiredDefault})`,
            evidence: `iq_gate_results.${meta.code}`,
            remediation:
              status === 'Fail' || status === 'Blocked'
                ? remediationFor(meta.code, actual, persistedRow.requiredValue ?? requiredDefault)
                : null,
            evaluatedAt: persistedRow.evaluatedAt.toISOString(),
          };
        }

        const actual = factorForCode(meta.code, factors, overallScore);
        if (actual == null && !derivedFailures) {
          return {
            code: meta.code,
            label: meta.label,
            status: 'Pending' as const,
            actual: null,
            required: requiredDefault,
            threshold,
            blocking: meta.blocking,
            confidence: null,
            reasoning: `${meta.label} not yet evaluated — awaiting iq_gate_results or factor scores`,
            evidence: null,
            remediation: remediationFor(meta.code, null, requiredDefault),
            evaluatedAt: null,
          };
        }

        let status: GateOutcome = 'Pending';
        if (actual != null) {
          if (meta.invert) {
            status =
              meta.code === 'DUPLICATE'
                ? actual < threshold
                  ? 'Pass'
                  : 'Fail'
                : actual <= threshold
                  ? 'Pass'
                  : 'Fail';
          } else {
            status = actual >= threshold ? 'Pass' : 'Fail';
          }
        } else if (derivedFailSet.has(meta.code)) {
          status = 'Fail';
        } else if (derivedFailures?.passed) {
          status = 'Pass';
        }

        return {
          code: meta.code,
          label: meta.label,
          status,
          actual,
          required: requiredDefault,
          threshold,
          blocking: meta.blocking,
          confidence: actual != null ? confidence : null,
          reasoning:
            actual != null
              ? `${meta.label} ${status}: actual ${actual} vs ${requiredDefault} (derived from persisted factors)`
              : `${meta.label} pending factor persistence`,
          evidence: actual != null ? 'iq_scores.factors_json / total_score' : null,
          remediation:
            status === 'Fail'
              ? remediationFor(meta.code, actual, requiredDefault)
              : null,
          evaluatedAt: row.scoredAt?.toISOString() ?? null,
        };
      });

      const passedCount = gates.filter((g) => g.status === 'Pass').length;
      const failedCount = gates.filter((g) => g.status === 'Fail').length;
      const reviewCount = gates.filter((g) => g.status === 'Review').length;
      const blockingCount = gates.filter(
        (g) => g.blocking && (g.status === 'Fail' || g.status === 'Blocked'),
      ).length;
      const pendingCount = gates.filter((g) => g.status === 'Pending').length;

      let outcome: GateOutcome = normalizeGateStatus(row.gateStatus);
      if (persisted.length || factors) {
        if (blockingCount > 0 || row.status.toUpperCase() === 'BLOCKED') {
          outcome = 'Blocked';
        } else if (failedCount > 0) {
          outcome = 'Fail';
        } else if (reviewCount > 0 || (passedCount > 0 && pendingCount > 0)) {
          outcome = 'Review';
        } else if (pendingCount === 0 && passedCount === gates.length) {
          outcome = 'Pass';
        } else if (pendingCount === gates.length) {
          outcome = 'Pending';
        }
      }

      const decision = (row.decision ?? '').toUpperCase();
      if (decision === 'BLOCK') outcome = 'Blocked';
      if (decision === 'REJECT') outcome = 'Fail';
      if (decision === 'QUALIFY' && failedCount === 0 && blockingCount === 0) {
        outcome = pendingCount === 0 ? 'Pass' : outcome;
      }

      const recommendation = decisionFor(outcome, blockingCount, reviewCount);
      const complianceScore = pct(passedCount, gates.length);
      const failedCriteria = gates
        .filter((g) => g.status === 'Fail' || g.status === 'Blocked')
        .map((g) => g.code);
      const remediations = gates
        .map((g) => g.remediation)
        .filter((v): v is string => Boolean(v))
        .slice(0, 8);

      const explainability: string[] = [];
      explainability.push(`Overall gate outcome: ${outcome}`);
      if (overallScore != null) explainability.push(`Weighted score ${overallScore}`);
      if (complianceScore != null) explainability.push(`Compliance ${complianceScore}%`);
      for (const fail of gates.filter((g) => g.status === 'Fail').slice(0, 4)) {
        explainability.push(`${fail.label}: ${fail.reasoning}`);
      }
      if (recommendation === 'Proceed') {
        explainability.push('All mandatory gates satisfied — eligible for Qualified Ranking');
      }
      if (!failedCriteria.length && pendingCount) {
        explainability.push(`${pendingCount} gate(s) still pending evaluation`);
      }

      const dependencies = GATE_CATALOG.flatMap((g) =>
        g.dependsOn.map((from) => ({
          from,
          to: g.code,
          label: `${from} → ${g.code}`,
        })),
      );

      const overrides =
        recommendation === 'Blocked' || recommendation === 'Halt & Remediate'
          ? [
              {
                route: 'Governance Override (observe-only)',
                reason: `Requested only if policy exception approved for ${row.title}`,
                status: 'OBSERVE_ONLY',
                priority: 'HIGH',
              },
              {
                route: 'Compliance Review (observe-only)',
                reason: failedCriteria.join(', ') || 'Gate failures',
                status: 'OBSERVE_ONLY',
                priority: 'MEDIUM',
              },
            ]
          : recommendation === 'Conditional'
            ? [
                {
                  route: 'Conditional Approval Board (observe-only)',
                  reason: 'Non-blocking review gates require documented acceptance',
                  status: 'OBSERVE_ONLY',
                  priority: 'MEDIUM',
                },
              ]
            : [];

      const createdAt = row.createdAt.toISOString();
      const updatedAt = row.updatedAt.toISOString();
      const evaluatedAt =
        gates.map((g) => g.evaluatedAt).find((v) => v != null) ??
        row.scoredAt?.toISOString() ??
        null;

      let decisionMs: number | null = null;
      if (row.scoredAt && evaluatedAt) {
        const ms = new Date(evaluatedAt).getTime() - row.scoredAt.getTime();
        if (Number.isFinite(ms) && ms >= 0) decisionMs = ms;
      }

      const aiSummary =
        recommendation === 'Await Evaluation'
          ? `${row.title} awaits mandatory gate evaluation from the autonomous cycle.`
          : `${row.title} · ${outcome} · ${recommendation}. ${
              remediations[0] ?? 'No remediation required.'
            }`;

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
        overallScore,
        confidence,
        measuredConfidence,
        outcome,
        recommendation,
        complianceScore,
        passedCount,
        failedCount,
        reviewCount,
        blockingCount,
        failedCriteria,
        remediations,
        explainability,
        aiSummary,
        gates,
        dependencies,
        overrides,
        lifecycle: [
          {
            key: 'score',
            label: 'Score available',
            done: overallScore != null,
            at: row.scoredAt?.toISOString() ?? null,
          },
          {
            key: 'rules',
            label: 'Rule catalog applied',
            done: Boolean(thresholds) || overallScore != null || persisted.length > 0,
            at: evaluatedAt,
          },
          {
            key: 'sequence',
            label: 'Gate sequencing',
            done: passedCount + failedCount > 0,
            at: evaluatedAt,
          },
          {
            key: 'validate',
            label: 'Real-time validation',
            done: pendingCount < gates.length,
            at: evaluatedAt,
          },
          {
            key: 'decision',
            label: 'Gate decision',
            done: recommendation !== 'Await Evaluation',
            at: recommendation !== 'Await Evaluation' ? updatedAt : null,
          },
          {
            key: 'route',
            label: 'Proceed / Halt / Remediate',
            done: recommendation !== 'Await Evaluation',
            at: recommendation !== 'Await Evaluation' ? updatedAt : null,
          },
        ],
        policyVersion: row.policyVersion,
        modelVersion: row.modelVersion,
        factors,
        thresholds,
        decisionMs,
        evaluatedAt,
        createdAt,
        updatedAt,
      };
    });

    const passedGates = candidates.filter((c) => c.outcome === 'Pass').length;
    const failedGates = candidates.filter((c) => c.outcome === 'Fail').length;
    const conditionalApproval = candidates.filter((c) => c.outcome === 'Review').length;
    const blockedItems = candidates.filter((c) => c.outcome === 'Blocked').length;
    const evaluatedCandidates = candidates.filter((c) => c.outcome !== 'Pending').length;
    const proceedCount = candidates.filter((c) => c.recommendation === 'Proceed').length;

    const allCells = candidates.flatMap((c) => c.gates);
    const cellPass = allCells.filter((g) => g.status === 'Pass').length;
    const complianceScore = pct(cellPass, allCells.length);

    const governanceHealth = pct(
      candidates.filter((c) => c.gates.every((g) => g.status !== 'Pending')).length +
        (auditRows.length > 0 ? 1 : 0),
      candidates.length + 1,
    );

    const averageDecisionTimeMs = avg(
      candidates.map((c) => c.decisionMs).filter((v): v is number => v != null),
    );

    const gatePerformance = GATE_CATALOG.map((meta) => {
      const cells = allCells.filter((g) => g.code === meta.code);
      const pass = cells.filter((g) => g.status === 'Pass').length;
      const fail = cells.filter((g) => g.status === 'Fail' || g.status === 'Blocked').length;
      const review = cells.filter((g) => g.status === 'Review').length;
      return {
        code: meta.code,
        label: meta.label,
        pass,
        fail,
        review,
        passRate: pct(pass, cells.filter((g) => g.status !== 'Pending').length),
      };
    });

    const bottlenecks = [...gatePerformance]
      .filter((g) => g.fail > 0)
      .sort((a, b) => b.fail - a.fail)
      .slice(0, 6)
      .map((g) => ({ code: g.code, label: g.label, failCount: g.fail }));

    const recommendations: MandatoryGatesOverview['recommendations'] = [];
    for (const item of candidates.slice(0, 14)) {
      recommendations.push({
        id: `gate-${item.id}`,
        action: item.recommendation,
        reason: `${item.title} · ${item.outcome} · compliance ${item.complianceScore ?? 'UNMEAS.'}%`,
        priority:
          item.recommendation === 'Blocked' || item.recommendation === 'Halt & Remediate'
            ? 'HIGH'
            : item.recommendation === 'Conditional'
              ? 'MEDIUM'
              : 'LOW',
        candidateId: item.id,
      });
      for (const tip of item.remediations.slice(0, 1)) {
        recommendations.push({
          id: `rem-${item.id}`,
          action: tip,
          reason: `Remediation for ${item.title}`,
          priority: 'HIGH',
          candidateId: item.id,
        });
      }
    }

    const notifications: MandatoryGatesOverview['notifications'] = [];
    for (const item of candidates.slice(0, 12)) {
      if (item.recommendation === 'Proceed') {
        notifications.push({
          id: `ok-${item.id}`,
          severity: 'INFO',
          message: `All mandatory gates passed: ${item.title}`,
        });
      }
      if (item.recommendation === 'Halt & Remediate') {
        notifications.push({
          id: `halt-${item.id}`,
          severity: 'WARNING',
          message: `Halted for remediation: ${item.title} (${item.failedCriteria.join(', ')})`,
        });
      }
      if (item.recommendation === 'Blocked') {
        notifications.push({
          id: `block-${item.id}`,
          severity: 'CRITICAL',
          message: `Blocked by mandatory gate(s): ${item.title}`,
        });
      }
      if (item.recommendation === 'Conditional') {
        notifications.push({
          id: `cond-${item.id}`,
          severity: 'WARNING',
          message: `Conditional approval path: ${item.title}`,
        });
      }
    }

    const modelVersions = [
      ...new Set(
        candidates.map((c) => c.modelVersion).filter((v): v is string => Boolean(v)),
      ),
    ];
    const policyVersions = [
      ...new Set(
        candidates.map((c) => c.policyVersion).filter((v): v is string => Boolean(v)),
      ),
    ];

    const hasEval = evaluatedCandidates > 0;
    const pipeline = [
      { key: 'score', label: 'Score Ready' },
      { key: 'rules', label: 'Load Rule Catalog' },
      { key: 'sequence', label: 'Gate Sequencing' },
      { key: 'validate', label: 'Validate Thresholds' },
      { key: 'explain', label: 'Explain Decisions' },
      { key: 'alerts', label: 'Validation Alerts' },
      { key: 'decision', label: 'Pass / Fail / Review' },
      { key: 'route', label: 'Proceed or Remediate' },
      { key: 'audit', label: 'Immutable Audit' },
      { key: 'advance', label: 'Advance to Ranking' },
    ].map((item, index) => {
      let state: 'pending' | 'active' | 'done' | 'failed' = 'pending';
      if ((failedGates > 0 || blockedItems > 0) && item.key === 'decision') state = 'failed';
      else if (proceedCount > 0 && index <= 9) state = 'done';
      else if (hasEval && index <= 6) state = 'done';
      else if (hasEval && index === 7) state = 'active';
      else if (rows.length && index === 0) state = 'active';
      return { ...item, state };
    });

    const outcomeDistribution = [
      { label: 'Pass', count: passedGates },
      { label: 'Fail', count: failedGates },
      { label: 'Review', count: conditionalApproval },
      { label: 'Blocked', count: blockedItems },
      {
        label: 'Pending',
        count: candidates.filter((c) => c.outcome === 'Pending').length,
      },
    ];

    const overrideRequests = candidates.reduce((sum, c) => sum + c.overrides.length, 0);

    return {
      available: true,
      meta: {
        cycleStatus: cycles[0]?.status ?? 'NOT_STARTED',
        intakeStatus: intakes[0]?.status ?? null,
        modelVersions,
        policyVersions,
        ruleProfile: candidates.some((c) => c.thresholds) ? 'persisted' : 'default',
      },
      metrics: {
        totalCandidates: candidates.length,
        passedGates,
        failedGates,
        conditionalApproval,
        blockedItems,
        complianceScore,
        governanceHealth,
        averageDecisionTimeMs,
        evaluatedCandidates,
        proceedCount,
      },
      pipeline,
      ruleCatalog: GATE_CATALOG.map((g) => ({
        code: g.code,
        label: g.label,
        category: g.category,
        threshold: thresholdsDefault[g.thresholdKey],
        required: g.invert
          ? g.code === 'DUPLICATE'
            ? `< ${thresholdsDefault[g.thresholdKey]}`
            : `<= ${thresholdsDefault[g.thresholdKey]}`
          : `>= ${thresholdsDefault[g.thresholdKey]}`,
        blocking: g.blocking,
        sequence: g.sequence,
        dependsOn: g.dependsOn,
      })),
      candidates,
      recommendations,
      analytics: {
        outcomeDistribution,
        gatePerformance,
        bottlenecks,
        passFailTrend: gatePerformance.map((g) => ({
          label: g.label,
          pass: g.pass,
          fail: g.fail,
        })),
      },
      governance: {
        modelVersions,
        policyVersions,
        decisionsLogged: Number(decisionCount[0]?.count ?? 0),
        auditEvents: auditRows.length,
        gateResults: Number(gateCount[0]?.count ?? 0),
        overrideRequests,
        defaultGates: DEFAULT_GATES,
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
      error instanceof Error ? error.message : 'Failed to load mandatory gates',
      'ERROR',
    );
  }
}
