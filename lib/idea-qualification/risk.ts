import { prisma } from '@/lib/db';
import type { FactorScores } from './contracts';

export type RiskRecommendation =
  | 'Proceed'
  | 'Revise'
  | 'Escalate'
  | 'Reject'
  | 'Await Scoring';

export type RiskFinding = {
  id: string;
  category: string;
  severity: string;
  likelihood: number;
  riskScore: number;
  blocking: boolean;
  mitigation: string | null;
  reason: string;
  evidence: string | null;
  policy: string | null;
  confidence: number | null;
  assessedAt: string;
};

export type RiskCandidate = {
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
  overallRiskScore: number | null;
  legalRisk: number | null;
  ethicalRisk: number | null;
  copyrightRisk: number | null;
  privacyRisk: number | null;
  culturalSensitivity: number | null;
  politicalSensitivity: number | null;
  platformCompliance: number | null;
  securityRisk: number | null;
  confidence: number | null;
  measuredConfidence: boolean;
  riskBand: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNMEASURED';
  recommendation: RiskRecommendation;
  explainability: string[];
  aiSummary: string;
  dimensions: Array<{ label: string; score: number | null; level: string }>;
  legal: Array<{ label: string; status: string; detail: string }>;
  ethical: Array<{ label: string; status: string; detail: string }>;
  cultural: Array<{ label: string; status: string; detail: string }>;
  privacy: Array<{ label: string; status: string; detail: string }>;
  platforms: Array<{ platform: string; status: string; detail: string }>;
  copyright: Array<{ label: string; status: string; detail: string }>;
  misinformation: Array<{ label: string; value: number | null }>;
  reputational: Array<{ label: string; status: string; detail: string }>;
  security: Array<{ label: string; status: string; detail: string }>;
  heatMap: Array<{ area: string; level: string; score: number | null }>;
  findings: RiskFinding[];
  mitigations: string[];
  escalations: Array<{
    route: string;
    reason: string;
    priority: string;
    status: string;
  }>;
  predictive: Array<{ label: string; value: number | null }>;
  lifecycle: Array<{ key: string; label: string; done: boolean; at: string | null }>;
  factors: Partial<FactorScores> | null;
  modelVersion: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RiskSensitivityOverview = {
  available: boolean;
  reason?: string;
  meta: {
    cycleStatus: string;
    intakeStatus: string | null;
    modelVersions: string[];
  };
  metrics: {
    overallRiskScore: number | null;
    legalRisk: number | null;
    ethicalRisk: number | null;
    copyrightRisk: number | null;
    privacyRisk: number | null;
    culturalSensitivity: number | null;
    politicalSensitivity: number | null;
    platformCompliance: number | null;
    securityRisk: number | null;
    aiConfidence: number | null;
    proceedRate: number | null;
    totalCandidates: number;
    lowRiskCount: number;
    highRiskCount: number;
    escalateCount: number;
    rejectCount: number;
    blockingFindings: number;
  };
  pipeline: Array<{
    key: string;
    label: string;
    state: 'pending' | 'active' | 'done' | 'failed';
  }>;
  candidates: RiskCandidate[];
  categoryDistribution: Array<{ label: string; count: number; avgScore: number | null }>;
  recommendations: Array<{
    id: string;
    action: string;
    reason: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    candidateId?: string;
  }>;
  analytics: {
    bandDistribution: Array<{ label: string; count: number }>;
    recommendationDistribution: Array<{ label: string; count: number }>;
    severityDistribution: Array<{ label: string; count: number }>;
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

const RISK_DIMENSIONS = [
  { label: 'Legal', match: /legal|law|regulat|court|broadcast/i },
  { label: 'Ethical', match: /ethic|bias|harm|discrimin|harass/i },
  { label: 'Political', match: /politic|government|election/i },
  { label: 'Cultural', match: /cultur|relig|ethnic|regional|custom/i },
  { label: 'Religious', match: /relig|faith|sacred/i },
  { label: 'Privacy', match: /privacy|pii|gdpr|consent|personal/i },
  { label: 'Cybersecurity', match: /cyber|security|infosec/i },
  { label: 'Copyright', match: /copy|right|license|ip\b/i },
  { label: 'Trademark', match: /trade.?mark/i },
  { label: 'Defamation', match: /defam|libel|slander/i },
  { label: 'Misinformation', match: /misinfo|disinfo|hallucin|fact|evidence/i },
  { label: 'Platform Compliance', match: /platform|youtube|policy|community/i },
  { label: 'Public Safety', match: /safety|public.?harm/i },
  { label: 'Operational Risk', match: /operat|product|schedule/i },
  { label: 'Commercial Risk', match: /commerci|sponsor|brand/i },
  { label: 'Reputational Risk', match: /reputat|brand.?trust|public.?trust/i },
  { label: 'International Restrictions', match: /international|jurisdiction|export|sanction/i },
] as const;

const PLATFORMS = [
  'YouTube',
  'Facebook',
  'Instagram',
  'TikTok',
  'LinkedIn',
  'X',
  'Educational platforms',
  'Broadcast television',
  'Corporate publishing',
  'Internal enterprise portals',
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
      (parsed.risk as Record<string, unknown> | undefined) ??
      (parsed.sensitivity as Record<string, unknown> | undefined) ??
      (parsed.governance as Record<string, unknown> | undefined);
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

function parseEvidenceJson(raw: string | null): {
  reason: string | null;
  policy: string | null;
  confidence: number | null;
  evidence: string | null;
} {
  if (!raw) {
    return { reason: null, policy: null, confidence: null, evidence: null };
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      reason:
        typeof parsed.reason === 'string'
          ? parsed.reason
          : typeof parsed.finding === 'string'
            ? parsed.finding
            : null,
      policy:
        typeof parsed.policy === 'string'
          ? parsed.policy
          : typeof parsed.rule === 'string'
            ? parsed.rule
            : null,
      confidence: num(parsed.confidence),
      evidence:
        typeof parsed.evidence === 'string'
          ? parsed.evidence
          : typeof parsed.detail === 'string'
            ? parsed.detail
            : raw.slice(0, 240),
    };
  } catch {
    return { reason: null, policy: null, confidence: null, evidence: raw.slice(0, 240) };
  }
}

function levelFromScore(score: number | null): string {
  if (score == null) return 'UNMEASURED';
  if (score >= 75) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

function riskBandFrom(
  overall: number | null,
  blocking: boolean,
): RiskCandidate['riskBand'] {
  if (blocking && (overall == null || overall >= 40)) return 'CRITICAL';
  if (overall == null) return 'UNMEASURED';
  if (overall >= 75) return 'CRITICAL';
  if (overall >= 55) return 'HIGH';
  if (overall >= 30) return 'MEDIUM';
  return 'LOW';
}

function recommendationFor(
  band: RiskCandidate['riskBand'],
  blocking: boolean,
): RiskRecommendation {
  if (band === 'UNMEASURED') return 'Await Scoring';
  if (band === 'CRITICAL' || blocking) return 'Reject';
  if (band === 'HIGH') return 'Escalate';
  if (band === 'MEDIUM') return 'Revise';
  return 'Proceed';
}

function scoreForCategory(
  risks: Array<{ category: string; score: number }>,
  match: RegExp,
): number | null {
  const subset = risks.filter((item) => match.test(item.category));
  if (!subset.length) return null;
  return avg(subset.map((item) => item.score));
}

function statusFromRisk(score: number | null): string {
  if (score == null) return 'UNMEASURED';
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

function platformStatus(
  score: number | null,
  meta: Record<string, unknown>,
  platform: string,
): { status: string; detail: string } {
  const platforms = meta.platforms;
  if (platforms && typeof platforms === 'object' && !Array.isArray(platforms)) {
    const row = (platforms as Record<string, unknown>)[platform];
    if (typeof row === 'string') {
      return { status: row.toUpperCase(), detail: `Persisted platform status: ${row}` };
    }
    if (row && typeof row === 'object') {
      const obj = row as Record<string, unknown>;
      const status =
        typeof obj.status === 'string' ? obj.status.toUpperCase() : 'EVALUATED';
      const detail =
        typeof obj.detail === 'string' ? obj.detail : `Platform score ${num(obj.score) ?? 'n/a'}`;
      return { status, detail };
    }
  }
  if (score == null) {
    return { status: 'UNMEASURED', detail: 'No platform compliance payload' };
  }
  if (score >= 70) {
    return { status: 'REQUIRES REVIEW', detail: `Elevated compliance risk ${score}` };
  }
  if (score >= 40) {
    return { status: 'RESTRICTED', detail: `Moderate compliance risk ${score}` };
  }
  return { status: 'ALLOWED', detail: `Low compliance risk ${score}` };
}

function mitigationsFrom(
  findings: RiskFinding[],
  recommendation: RiskRecommendation,
): string[] {
  const tips = findings
    .map((item) => item.mitigation)
    .filter((value): value is string => Boolean(value?.trim()))
    .slice(0, 6);
  if (tips.length) return tips;
  if (recommendation === 'Reject') return ['Request legal review', 'Delay publication pending approval'];
  if (recommendation === 'Escalate') {
    return ['Request legal review', 'Add factual disclaimer', 'Provide additional citations'];
  }
  if (recommendation === 'Revise') {
    return [
      'Use public-domain assets',
      'Use neutral language',
      'Blur identifiable individuals',
      'Obtain interview consent',
    ];
  }
  if (recommendation === 'Proceed') {
    return ['Maintain citation discipline', 'Continue dynamic risk monitoring'];
  }
  return ['Await risk scoring before mitigation planning'];
}

export async function loadRiskSensitivity(): Promise<RiskSensitivityOverview> {
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
        avgRiskScore: number | string | null;
        maxRiskScore: number | string | null;
        riskCount: number | bigint;
        blockingCount: number | bigint;
        evidenceFailed: number | bigint;
        evidencePassed: number | bigint;
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
          SELECT AVG(CAST(risk_score AS float)) FROM iq_risk_assessments rk
          WHERE rk.candidate_id = c.id
        ) AS avgRiskScore,
        (
          SELECT MAX(risk_score) FROM iq_risk_assessments rk
          WHERE rk.candidate_id = c.id
        ) AS maxRiskScore,
        (
          SELECT COUNT(*) FROM iq_risk_assessments rk WHERE rk.candidate_id = c.id
        ) AS riskCount,
        (
          SELECT COUNT(*) FROM iq_risk_assessments rk
          WHERE rk.candidate_id = c.id AND rk.blocking = 1
        ) AS blockingCount,
        (
          SELECT COUNT(*) FROM iq_evidence_checks e
          WHERE e.candidate_id = c.id AND e.status IN ('FAILED','FAIL','REJECTED','INSUFFICIENT','MISSING')
        ) AS evidenceFailed,
        (
          SELECT COUNT(*) FROM iq_evidence_checks e
          WHERE e.candidate_id = c.id AND e.status IN ('PASSED','PASS','OK','CLEARED','COMPLETE')
        ) AS evidencePassed
      FROM iq_candidates c
      OUTER APPLY (
        SELECT TOP 1 *
        FROM iq_scores sc
        WHERE sc.candidate_id = c.id
        ORDER BY sc.scored_at DESC
      ) s
      ORDER BY
        COALESCE(
          (
            SELECT MAX(risk_score) FROM iq_risk_assessments rk WHERE rk.candidate_id = c.id
          ),
          TRY_CONVERT(float, JSON_VALUE(s.factors_json, '$.risk')),
          0
        ) DESC,
        c.updated_at DESC
    `;

    const riskRows = await prisma.$queryRaw<
      Array<{
        id: string;
        candidateId: string;
        category: string;
        severity: string;
        likelihood: number | string;
        score: number | string;
        blocking: boolean | number;
        mitigation: string | null;
        evidenceJson: string | null;
        assessedAt: Date;
      }>
    >`
      SELECT TOP 800
        CONVERT(varchar(36), id) AS id,
        CONVERT(varchar(36), candidate_id) AS candidateId,
        category,
        severity,
        likelihood,
        risk_score AS score,
        blocking,
        mitigation,
        evidence_json AS evidenceJson,
        assessed_at AS assessedAt
      FROM iq_risk_assessments
      ORDER BY risk_score DESC, assessed_at DESC
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
      WHERE action LIKE '%RISK%'
         OR action LIKE '%COMPLI%'
         OR action LIKE '%LEGAL%'
         OR action LIKE '%ETHIC%'
         OR action LIKE '%PRIVACY%'
         OR action LIKE '%GATE%'
         OR action LIKE '%QUALIF%'
      ORDER BY created_at DESC
    `;

    const risksByCandidate = new Map<string, typeof riskRows>();
    for (const row of riskRows) {
      const list = risksByCandidate.get(row.candidateId) ?? [];
      if (list.length < 20) list.push(row);
      risksByCandidate.set(row.candidateId, list);
    }

    const categoryBuckets = new Map<string, number[]>();

    const candidates: RiskCandidate[] = rows.map((row) => {
      const factors = parseFactors(row.factorsJson);
      const meta = parseMeta(row.factorsJson);
      const rawRisks = risksByCandidate.get(row.id) ?? [];
      const riskScores = rawRisks.map((item) => ({
        category: item.category,
        score: Math.round(Number(item.score)),
      }));

      for (const item of riskScores) {
        const bucket = categoryBuckets.get(item.category) ?? [];
        bucket.push(item.score);
        categoryBuckets.set(item.category, bucket);
      }

      const overallRiskScore =
        nestedNum(meta, ['overallRisk', 'overallRiskScore']) ??
        factors?.risk ??
        num(row.avgRiskScore) ??
        num(row.maxRiskScore);

      const legalRisk =
        nestedNum(meta, ['legalRisk']) ??
        scoreForCategory(riskScores, /legal|law|regulat|court|broadcast/i);
      const ethicalRisk =
        nestedNum(meta, ['ethicalRisk']) ??
        scoreForCategory(riskScores, /ethic|bias|harm|discrimin/i);
      const copyrightRisk =
        nestedNum(meta, ['copyrightRisk']) ??
        scoreForCategory(riskScores, /copy|right|license|ip\b|trade.?mark/i);
      const privacyRisk =
        nestedNum(meta, ['privacyRisk']) ??
        scoreForCategory(riskScores, /privacy|pii|gdpr|consent|personal/i);
      const culturalSensitivity =
        nestedNum(meta, ['culturalSensitivity', 'culturalRisk']) ??
        scoreForCategory(riskScores, /cultur|relig|ethnic|regional|custom/i);
      const politicalSensitivity =
        nestedNum(meta, ['politicalSensitivity', 'politicalRisk']) ??
        scoreForCategory(riskScores, /politic|government|election|sanction/i);
      const platformCompliance =
        nestedNum(meta, ['platformCompliance', 'platformRisk']) ??
        scoreForCategory(riskScores, /platform|youtube|policy|community/i);
      const securityRisk =
        nestedNum(meta, ['securityRisk']) ??
        scoreForCategory(riskScores, /security|cyber|military|national|ops/i);

      const blocking = Number(row.blockingCount) > 0 || rawRisks.some((item) => Boolean(item.blocking));
      const confidence = num(row.confidence);
      const measuredConfidence = confidence != null && confidence >= 1;
      const riskBand = riskBandFrom(overallRiskScore, blocking);
      const recommendation = recommendationFor(riskBand, blocking);

      const findings: RiskFinding[] = rawRisks.map((item) => {
        const evidence = parseEvidenceJson(item.evidenceJson);
        return {
          id: item.id,
          category: item.category,
          severity: item.severity,
          likelihood: Math.round(Number(item.likelihood)),
          riskScore: Math.round(Number(item.score)),
          blocking: Boolean(item.blocking),
          mitigation: item.mitigation,
          reason:
            evidence.reason ??
            item.mitigation ??
            `${item.category} assessed at ${Math.round(Number(item.score))}`,
          evidence: evidence.evidence,
          policy: evidence.policy,
          confidence: evidence.confidence,
          assessedAt: item.assessedAt.toISOString(),
        };
      });

      const explainability: string[] = [];
      if (overallRiskScore != null) {
        explainability.push(`Overall risk ${overallRiskScore}% (${riskBand})`);
      }
      if (blocking) explainability.push('Blocking risk findings present');
      if (legalRisk != null) explainability.push(`Legal risk ${legalRisk}`);
      if (copyrightRisk != null) explainability.push(`Copyright risk ${copyrightRisk}`);
      if (privacyRisk != null) explainability.push(`Privacy risk ${privacyRisk}`);
      if (politicalSensitivity != null) {
        explainability.push(`Political sensitivity ${politicalSensitivity}`);
      }
      if (Number(row.evidenceFailed) > 0) {
        explainability.push(`${Number(row.evidenceFailed)} failed evidence checks (fact risk signal)`);
      }
      if (!explainability.length) {
        explainability.push('No risk assessments or risk factor persisted yet');
      }

      const createdAt = row.createdAt.toISOString();
      const updatedAt = row.updatedAt.toISOString();
      const evidencePassed = Number(row.evidencePassed);
      const evidenceFailed = Number(row.evidenceFailed);
      const evidenceTotal = evidencePassed + evidenceFailed;

      const dimensions = RISK_DIMENSIONS.map((dim) => {
        const score = scoreForCategory(riskScores, dim.match);
        return {
          label: dim.label,
          score,
          level: levelFromScore(score),
        };
      });

      const heatMap = [
        { area: 'Copyright', score: copyrightRisk },
        { area: 'Privacy', score: privacyRisk },
        { area: 'Ethics', score: ethicalRisk },
        { area: 'Political', score: politicalSensitivity },
        { area: 'Security', score: securityRisk },
        { area: 'Platform Policy', score: platformCompliance },
        { area: 'Cultural', score: culturalSensitivity },
        { area: 'Legal', score: legalRisk },
      ].map((item) => ({
        area: item.area,
        level: levelFromScore(item.score),
        score: item.score,
      }));

      const mitigations = mitigationsFrom(findings, recommendation);

      const escalations =
        recommendation === 'Escalate' || recommendation === 'Reject'
          ? [
              {
                route: 'Legal',
                reason: 'Elevated legal / compliance risk',
                priority: riskBand === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
                status: 'OBSERVE_ONLY',
              },
              {
                route: 'Editorial Board',
                reason: 'Editorial / sensitivity review recommended',
                priority: 'HIGH',
                status: 'OBSERVE_ONLY',
              },
              {
                route: 'Risk Committee',
                reason: 'Enterprise risk acceptance may be required',
                priority: 'MEDIUM',
                status: 'OBSERVE_ONLY',
              },
            ]
          : recommendation === 'Revise'
            ? [
                {
                  route: 'Compliance',
                  reason: 'Mitigation before progression',
                  priority: 'MEDIUM',
                  status: 'OBSERVE_ONLY',
                },
              ]
            : [
                {
                  route: 'None',
                  reason: 'No escalation required from persisted signals',
                  priority: 'LOW',
                  status: 'CLEAR',
                },
              ];

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
        overallRiskScore,
        legalRisk,
        ethicalRisk,
        copyrightRisk,
        privacyRisk,
        culturalSensitivity,
        politicalSensitivity,
        platformCompliance,
        securityRisk,
        confidence,
        measuredConfidence,
        riskBand,
        recommendation,
        explainability,
        aiSummary:
          overallRiskScore != null
            ? `${row.title} scores ${overallRiskScore}% overall risk (${riskBand}). Recommendation: ${recommendation}.`
            : `${row.title} awaits persisted risk assessments / risk factor scoring.`,
        dimensions,
        legal: [
          {
            label: 'Copyright ownership / licensing / fair use',
            status: statusFromRisk(copyrightRisk),
            detail:
              copyrightRisk != null
                ? `Copyright risk ${copyrightRisk}`
                : 'No copyright risk assessment',
          },
          {
            label: 'Image / music / interview permissions',
            status: scoreForCategory(riskScores, /image|music|interview|release/i) != null
              ? 'EVALUATED'
              : 'UNMEASURED',
            detail: 'From iq_risk_assessments when category matches',
          },
          {
            label: 'Trademark / government / broadcast regulations',
            status: statusFromRisk(legalRisk),
            detail:
              legalRisk != null ? `Legal risk ${legalRisk}` : 'No legal risk assessment',
          },
          {
            label: 'Regional laws / court reporting limits',
            status:
              nestedNum(meta, ['regionalLegal']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['regionalLegal']) != null
                ? `Score ${nestedNum(meta, ['regionalLegal'])}`
                : 'No regional legal payload',
          },
        ],
        ethical: [
          {
            label: 'Bias / fair representation / balanced viewpoints',
            status: statusFromRisk(ethicalRisk),
            detail:
              ethicalRisk != null
                ? `Ethical risk ${ethicalRisk}`
                : 'No ethical risk assessment',
          },
          {
            label: 'Harm / discrimination / sensitive populations',
            status: scoreForCategory(riskScores, /harm|discrimin|child|medical/i) != null
              ? 'EVALUATED'
              : 'UNMEASURED',
            detail: 'From risk assessments when present',
          },
          {
            label: 'Scientific integrity / manipulated media / AI disclosure',
            status:
              nestedNum(meta, ['aiDisclosure', 'manipulatedMedia']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail: 'Nested ethics meta when present',
          },
        ],
        cultural: [
          {
            label: 'Religious / regional / ethnic sensitivity',
            status: statusFromRisk(culturalSensitivity),
            detail:
              culturalSensitivity != null
                ? `Cultural sensitivity ${culturalSensitivity}`
                : row.geography?.trim() || 'No cultural risk assessment',
          },
          {
            label: 'Historical disputes / language / symbols',
            status:
              nestedNum(meta, ['historicalDisputes', 'symbolUsage']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail: 'Nested cultural meta when present',
          },
          {
            label: 'Cross-border implications',
            status:
              nestedNum(meta, ['crossBorder']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['crossBorder']) != null
                ? `Score ${nestedNum(meta, ['crossBorder'])}`
                : 'No cross-border payload',
          },
        ],
        privacy: [
          {
            label: 'PII / face / voice / location exposure',
            status: statusFromRisk(privacyRisk),
            detail:
              privacyRisk != null
                ? `Privacy risk ${privacyRisk}`
                : 'No privacy risk assessment',
          },
          {
            label: 'Confidential documents / correspondence',
            status: scoreForCategory(riskScores, /confidential|document|correspond/i) != null
              ? 'EVALUATED'
              : 'UNMEASURED',
            detail: 'From risk assessments when present',
          },
          {
            label: 'Consent / retention / data protection',
            status:
              nestedNum(meta, ['consent', 'retention']) != null
                ? 'EVALUATED'
                : privacyRisk != null
                  ? 'SCORED'
                  : 'UNMEASURED',
            detail: 'Nested privacy meta or privacy risk score',
          },
        ],
        platforms: PLATFORMS.map((platform) => {
          const result = platformStatus(platformCompliance, meta, platform);
          return { platform, ...result };
        }),
        copyright: [
          {
            label: 'Potential infringement / protected works',
            status: statusFromRisk(copyrightRisk),
            detail:
              copyrightRisk != null
                ? `Copyright risk ${copyrightRisk}`
                : 'No copyright assessment',
          },
          {
            label: 'Archive licensing / derivative works',
            status:
              nestedNum(meta, ['archiveLicensing', 'derivativeWorks']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail: 'Nested copyright meta when present',
          },
          {
            label: 'Public domain opportunities',
            status:
              nestedNum(meta, ['publicDomain']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['publicDomain']) != null
                ? `Score ${nestedNum(meta, ['publicDomain'])}`
                : 'No public-domain payload',
          },
        ],
        misinformation: [
          {
            label: 'Unsupported claims / weak evidence',
            value:
              nestedNum(meta, ['unsupportedClaims']) ??
              (evidenceTotal > 0
                ? Math.round((evidenceFailed / evidenceTotal) * 100)
                : null),
          },
          {
            label: 'Conflicting / outdated sources',
            value: nestedNum(meta, ['conflictingSources', 'outdatedInformation']),
          },
          {
            label: 'AI hallucination risk',
            value: nestedNum(meta, ['hallucinationRisk']),
          },
          {
            label: 'Unverified statistics / scientific uncertainty',
            value: nestedNum(meta, ['unverifiedStatistics', 'scientificUncertainty']),
          },
          {
            label: 'Evidence confidence',
            value:
              nestedNum(meta, ['factConfidence']) ??
              (evidenceTotal > 0
                ? Math.round((evidencePassed / evidenceTotal) * 100)
                : factors?.evidence ?? null),
          },
        ],
        reputational: [
          {
            label: 'Organization / clients / partners',
            status: statusFromRisk(
              scoreForCategory(riskScores, /reputat|brand|sponsor|partner/i),
            ),
            detail: 'From reputational risk assessments when present',
          },
          {
            label: 'Governments / communities / individuals',
            status: statusFromRisk(politicalSensitivity),
            detail:
              politicalSensitivity != null
                ? `Political sensitivity ${politicalSensitivity}`
                : 'UNMEASURED',
          },
          {
            label: 'Educational institutions / public trust',
            status:
              nestedNum(meta, ['publicTrust']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['publicTrust']) != null
                ? `Score ${nestedNum(meta, ['publicTrust'])}`
                : 'No public-trust payload',
          },
        ],
        security: [
          {
            label: 'Sensitive infrastructure / military / national security',
            status: statusFromRisk(securityRisk),
            detail:
              securityRisk != null
                ? `Security risk ${securityRisk}`
                : 'No security risk assessment',
          },
          {
            label: 'Operational / cybersecurity exposure',
            status: scoreForCategory(riskScores, /cyber|ops|operational/i) != null
              ? 'EVALUATED'
              : 'UNMEASURED',
            detail: 'From risk assessments when present',
          },
          {
            label: 'Confidential business processes',
            status:
              nestedNum(meta, ['confidentialProcesses']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail: 'Nested security meta when present',
          },
        ],
        heatMap,
        findings,
        mitigations,
        escalations,
        predictive: [
          {
            label: 'Likelihood of legal challenges',
            value: nestedNum(meta, ['legalChallengeLikelihood']) ?? legalRisk,
          },
          {
            label: 'Probability of platform rejection',
            value: nestedNum(meta, ['platformRejectionProbability']) ?? platformCompliance,
          },
          {
            label: 'Expected copyright claims',
            value: nestedNum(meta, ['copyrightClaimProbability']) ?? copyrightRisk,
          },
          {
            label: 'Viewer complaints',
            value: nestedNum(meta, ['viewerComplaintProbability']),
          },
          {
            label: 'Fact-check disputes',
            value:
              nestedNum(meta, ['factCheckDisputeProbability']) ??
              (evidenceTotal > 0
                ? Math.round((evidenceFailed / evidenceTotal) * 100)
                : null),
          },
          {
            label: 'Approval-driven delays',
            value: nestedNum(meta, ['approvalDelayProbability']),
          },
        ],
        lifecycle: [
          {
            key: 'legal',
            label: 'Legal review',
            done: legalRisk != null || copyrightRisk != null,
            at: legalRisk != null || copyrightRisk != null ? updatedAt : null,
          },
          {
            key: 'ethical',
            label: 'Ethical review',
            done: ethicalRisk != null,
            at: ethicalRisk != null ? updatedAt : null,
          },
          {
            key: 'privacy',
            label: 'Privacy assessment',
            done: privacyRisk != null,
            at: privacyRisk != null ? updatedAt : null,
          },
          {
            key: 'platform',
            label: 'Platform compliance',
            done: platformCompliance != null,
            at: platformCompliance != null ? updatedAt : null,
          },
          {
            key: 'security',
            label: 'Security review',
            done: securityRisk != null,
            at: securityRisk != null ? updatedAt : null,
          },
          {
            key: 'mitigation',
            label: 'Risk mitigation',
            done: mitigations.length > 0 && recommendation !== 'Await Scoring',
            at:
              mitigations.length > 0 && recommendation !== 'Await Scoring'
                ? updatedAt
                : null,
          },
          {
            key: 'score',
            label: 'Overall risk score',
            done: overallRiskScore != null,
            at: overallRiskScore != null ? updatedAt : null,
          },
          {
            key: 'decision',
            label: 'Proceed / Revise / Escalate / Reject',
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

    const lowRiskCount = candidates.filter((c) => c.riskBand === 'LOW').length;
    const highRiskCount = candidates.filter(
      (c) => c.riskBand === 'HIGH' || c.riskBand === 'CRITICAL',
    ).length;
    const escalateCount = candidates.filter((c) => c.recommendation === 'Escalate').length;
    const rejectCount = candidates.filter((c) => c.recommendation === 'Reject').length;
    const blockingFindings = candidates.reduce(
      (sum, c) => sum + c.findings.filter((f) => f.blocking).length,
      0,
    );

    const recommendations: RiskSensitivityOverview['recommendations'] = [];
    for (const item of candidates.slice(0, 12)) {
      recommendations.push({
        id: `rk-${item.id}`,
        action: item.recommendation,
        reason: `${item.title} · ${item.riskBand} · risk ${item.overallRiskScore ?? 'UNMEAS.'}`,
        priority:
          item.recommendation === 'Reject' || item.recommendation === 'Escalate'
            ? 'HIGH'
            : item.recommendation === 'Proceed'
              ? 'LOW'
              : 'MEDIUM',
        candidateId: item.id,
      });
      for (const tip of item.mitigations.slice(0, 1)) {
        recommendations.push({
          id: `mit-${item.id}`,
          action: tip,
          reason: `Mitigation for ${item.title}`,
          priority: 'MEDIUM',
          candidateId: item.id,
        });
      }
    }

    const notifications: RiskSensitivityOverview['notifications'] = [];
    for (const item of candidates.slice(0, 10)) {
      if (item.recommendation === 'Proceed') {
        notifications.push({
          id: `ok-${item.id}`,
          severity: 'INFO',
          message: `Low risk candidate: ${item.title}`,
        });
      }
      if (item.recommendation === 'Escalate') {
        notifications.push({
          id: `esc-${item.id}`,
          severity: 'WARNING',
          message: `Escalate risk review: ${item.title}`,
        });
      }
      if (item.recommendation === 'Reject' || item.riskBand === 'CRITICAL') {
        notifications.push({
          id: `crit-${item.id}`,
          severity: 'CRITICAL',
          message: `Critical / reject risk: ${item.title}`,
        });
      }
      if (item.recommendation === 'Revise') {
        notifications.push({
          id: `rev-${item.id}`,
          severity: 'WARNING',
          message: `Revise for risk mitigation: ${item.title}`,
        });
      }
    }

    const modelVersions = [
      ...new Set(
        candidates.map((c) => c.modelVersion).filter((v): v is string => Boolean(v)),
      ),
    ];

    const hasScores = candidates.some((c) => c.overallRiskScore != null || c.findings.length);
    const pipeline = [
      { key: 'legal', label: 'Legal Review' },
      { key: 'ethical', label: 'Ethical Review' },
      { key: 'privacy', label: 'Privacy Assessment' },
      { key: 'platform', label: 'Platform Compliance' },
      { key: 'security', label: 'Security Review' },
      { key: 'mitigation', label: 'Risk Mitigation' },
      { key: 'score', label: 'Overall Risk Score' },
      { key: 'decision', label: 'Proceed / Revise / Escalate / Reject' },
    ].map((item, index) => {
      let state: 'pending' | 'active' | 'done' | 'failed' = 'pending';
      if ((rejectCount > 0 || blockingFindings > 0) && item.key === 'score') state = 'failed';
      else if (lowRiskCount > 0 && index <= 7) state = 'done';
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

    const severityDistribution = new Map<string, number>();
    for (const row of riskRows) {
      severityDistribution.set(
        row.severity,
        (severityDistribution.get(row.severity) ?? 0) + 1,
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
        overallRiskScore: avg(
          candidates
            .map((c) => c.overallRiskScore)
            .filter((v): v is number => v != null),
        ),
        legalRisk: avg(
          candidates.map((c) => c.legalRisk).filter((v): v is number => v != null),
        ),
        ethicalRisk: avg(
          candidates.map((c) => c.ethicalRisk).filter((v): v is number => v != null),
        ),
        copyrightRisk: avg(
          candidates
            .map((c) => c.copyrightRisk)
            .filter((v): v is number => v != null),
        ),
        privacyRisk: avg(
          candidates.map((c) => c.privacyRisk).filter((v): v is number => v != null),
        ),
        culturalSensitivity: avg(
          candidates
            .map((c) => c.culturalSensitivity)
            .filter((v): v is number => v != null),
        ),
        politicalSensitivity: avg(
          candidates
            .map((c) => c.politicalSensitivity)
            .filter((v): v is number => v != null),
        ),
        platformCompliance: avg(
          candidates
            .map((c) => c.platformCompliance)
            .filter((v): v is number => v != null),
        ),
        securityRisk: avg(
          candidates
            .map((c) => c.securityRisk)
            .filter((v): v is number => v != null),
        ),
        aiConfidence: avg(
          candidates
            .filter((c) => c.measuredConfidence)
            .map((c) => c.confidence)
            .filter((v): v is number => v != null),
        ),
        proceedRate: pct(
          candidates.filter((c) => c.recommendation === 'Proceed').length,
          candidates.length,
        ),
        totalCandidates: candidates.length,
        lowRiskCount,
        highRiskCount,
        escalateCount,
        rejectCount,
        blockingFindings,
      },
      pipeline,
      candidates,
      categoryDistribution: [...categoryBuckets.entries()]
        .map(([label, scores]) => ({
          label,
          count: scores.length,
          avgScore: avg(scores),
        }))
        .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0)),
      recommendations,
      analytics: {
        bandDistribution: [
          { label: 'LOW', count: candidates.filter((c) => c.riskBand === 'LOW').length },
          {
            label: 'MEDIUM',
            count: candidates.filter((c) => c.riskBand === 'MEDIUM').length,
          },
          { label: 'HIGH', count: candidates.filter((c) => c.riskBand === 'HIGH').length },
          {
            label: 'CRITICAL',
            count: candidates.filter((c) => c.riskBand === 'CRITICAL').length,
          },
          {
            label: 'UNMEASURED',
            count: candidates.filter((c) => c.riskBand === 'UNMEASURED').length,
          },
        ],
        recommendationDistribution: [...recommendationDistribution.entries()].map(
          ([label, count]) => ({ label, count }),
        ),
        severityDistribution: [...severityDistribution.entries()].map(([label, count]) => ({
          label,
          count,
        })),
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
          : 'Risk & Sensitivity unavailable',
      meta: {
        cycleStatus: 'UNAVAILABLE',
        intakeStatus: null,
        modelVersions: [],
      },
      metrics: {
        overallRiskScore: null,
        legalRisk: null,
        ethicalRisk: null,
        copyrightRisk: null,
        privacyRisk: null,
        culturalSensitivity: null,
        politicalSensitivity: null,
        platformCompliance: null,
        securityRisk: null,
        aiConfidence: null,
        proceedRate: null,
        totalCandidates: 0,
        lowRiskCount: 0,
        highRiskCount: 0,
        escalateCount: 0,
        rejectCount: 0,
        blockingFindings: 0,
      },
      pipeline: [],
      candidates: [],
      categoryDistribution: [],
      recommendations: [],
      analytics: {
        bandDistribution: [],
        recommendationDistribution: [],
        severityDistribution: [],
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
