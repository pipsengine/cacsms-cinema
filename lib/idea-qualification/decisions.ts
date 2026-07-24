import { prisma } from '@/lib/db';
import type { FactorScores } from './contracts';
import { DEFAULT_WEIGHTS, scoreCandidate } from './scoring';

export type DecisionCode = 'QUALIFY' | 'REJECT' | 'BLOCK' | 'REASSESS' | 'UNDECIDED';

export type ApprovalStatus =
  | 'Approved'
  | 'Rejected'
  | 'Deferred'
  | 'Escalated'
  | 'Pending'
  | 'Overridden';

export type DecisionRecord = {
  id: string;
  candidateId: string;
  title: string;
  summary: string;
  domain: string;
  audience: string | null;
  geography: string | null;
  candidateStatus: string;
  gateStatus: string;
  finalDecision: DecisionCode;
  qualificationScore: number | null;
  confidence: number | null;
  measuredConfidence: boolean;
  approvalStatus: ApprovalStatus;
  decisionReason: string;
  explainableSummary: string;
  supportingEvidence: Array<{ label: string; status: string; detail: string }>;
  riskAssessment: {
    score: number | null;
    band: string;
    blocking: number;
    detail: string;
  };
  decisionVersion: number;
  timestamp: string;
  modelVersion: string | null;
  policyVersion: string | null;
  decisionSource: string;
  workflowStage: string;
  factorContribution: Array<{
    label: string;
    value: number | null;
    weight: number | null;
    contribution: number | null;
  }>;
  scoreBreakdown: Array<{ label: string; value: number | null }>;
  governanceRules: Array<{ code: string; result: string; detail: string }>;
  policyReferences: string[];
  overrideLogs: Array<{
    actor: string;
    action: string;
    reason: string;
    at: string;
    status: string;
  }>;
  approvalChain: Array<{
    step: string;
    actor: string;
    status: string;
    at: string | null;
  }>;
  digitalSignature: string | null;
  history: Array<{
    id: string;
    decision: string;
    reason: string;
    source: string;
    policyVersion: string | null;
    createdAt: string;
  }>;
  versionComparison: Array<{
    version: number;
    decision: string;
    score: number | null;
    source: string;
    at: string;
    changed: boolean;
  }>;
  explainability: string[];
  lifecycle: Array<{ key: string; label: string; done: boolean; at: string | null }>;
  factors: Partial<FactorScores> | null;
  rankPosition: number | null;
  createdAt: string;
  updatedAt: string;
};

export type DecisionRegisterOverview = {
  available: boolean;
  reason?: string;
  meta: {
    cycleStatus: string;
    intakeStatus: string | null;
    modelVersions: string[];
    policyVersions: string[];
  };
  metrics: {
    approvedIdeas: number;
    rejectedIdeas: number;
    deferredReviews: number;
    escalatedDecisions: number;
    aiConfidence: number | null;
    governanceCompliance: number | null;
    overrideRequests: number;
    decisionAccuracy: number | null;
    totalDecisions: number;
    decidedCandidates: number;
  };
  pipeline: Array<{
    key: string;
    label: string;
    state: 'pending' | 'active' | 'done' | 'failed';
  }>;
  records: DecisionRecord[];
  recommendations: Array<{
    id: string;
    action: string;
    reason: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    candidateId?: string;
  }>;
  analytics: {
    decisionDistribution: Array<{ label: string; count: number }>;
    sourceDistribution: Array<{ label: string; count: number }>;
    approvalTrends: Array<{ label: string; approved: number; rejected: number }>;
    complianceDashboard: Array<{ label: string; value: number | null }>;
  };
  governance: {
    modelVersions: string[];
    policyVersions: string[];
    decisionsLogged: number;
    auditEvents: number;
    overrideCount: number;
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

function asDecision(raw: string | null | undefined): DecisionCode {
  const s = (raw ?? '').toUpperCase();
  if (s === 'QUALIFY' || s === 'QUALIFIED') return 'QUALIFY';
  if (s === 'REJECT' || s === 'REJECTED') return 'REJECT';
  if (s === 'BLOCK' || s === 'BLOCKED') return 'BLOCK';
  if (s === 'REASSESS') return 'REASSESS';
  return 'UNDECIDED';
}

function approvalFrom(
  decision: DecisionCode,
  source: string,
): ApprovalStatus {
  const src = source.toUpperCase();
  if (src.includes('HUMAN') || src.includes('OVERRIDE') || src === 'MANUAL') {
    return 'Overridden';
  }
  switch (decision) {
    case 'QUALIFY':
      return 'Approved';
    case 'REJECT':
      return 'Rejected';
    case 'REASSESS':
      return 'Deferred';
    case 'BLOCK':
      return 'Escalated';
    default:
      return 'Pending';
  }
}

function workflowStage(decision: DecisionCode, candidateStatus: string): string {
  const status = candidateStatus.toUpperCase();
  if (status === 'SELECTED' || status === 'HANDED_OFF') return 'Selected Ideas / Handoff';
  if (decision === 'QUALIFY') return 'Route to Selected Ideas';
  if (decision === 'REJECT') return 'Closed — Rejected';
  if (decision === 'BLOCK') return 'Escalation / Blocked';
  if (decision === 'REASSESS') return 'Reassessment Queue';
  if (status === 'QUALIFIED') return 'Qualified — awaiting register';
  return 'Decision pending';
}

function riskBand(score: number | null): string {
  if (score == null) return 'UNMEASURED';
  if (score >= 75) return 'CRITICAL';
  if (score >= 55) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

function emptyOverview(reason: string, cycleStatus = 'UNAVAILABLE'): DecisionRegisterOverview {
  return {
    available: false,
    reason,
    meta: {
      cycleStatus,
      intakeStatus: null,
      modelVersions: [],
      policyVersions: [],
    },
    metrics: {
      approvedIdeas: 0,
      rejectedIdeas: 0,
      deferredReviews: 0,
      escalatedDecisions: 0,
      aiConfidence: null,
      governanceCompliance: null,
      overrideRequests: 0,
      decisionAccuracy: null,
      totalDecisions: 0,
      decidedCandidates: 0,
    },
    pipeline: [],
    records: [],
    recommendations: [],
    analytics: {
      decisionDistribution: [],
      sourceDistribution: [],
      approvalTrends: [],
      complianceDashboard: [],
    },
    governance: {
      modelVersions: [],
      policyVersions: [],
      decisionsLogged: 0,
      auditEvents: 0,
      overrideCount: 0,
    },
    notifications: [],
    audit: [],
    lastUpdated: new Date().toISOString(),
  };
}

export async function loadDecisionRegister(): Promise<DecisionRegisterOverview> {
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

    const decisionRows = await prisma.$queryRaw<
      Array<{
        id: string;
        candidateId: string;
        decision: string;
        reason: string;
        source: string;
        policyVersion: string | null;
        scoreId: string | null;
        createdAt: Date;
      }>
    >`
      SELECT TOP 800
        CONVERT(varchar(36), id) AS id,
        CONVERT(varchar(36), candidate_id) AS candidateId,
        decision,
        reason,
        decision_source AS source,
        policy_version AS policyVersion,
        CONVERT(varchar(36), score_id) AS scoreId,
        created_at AS createdAt
      FROM iq_decisions
      ORDER BY created_at DESC
    `;

    const candidates = await prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        summary: string;
        domain: string;
        audience: string | null;
        geography: string | null;
        status: string;
        gateStatus: string;
        decision: string | null;
        decisionReason: string | null;
        confidence: number | string | null;
        createdAt: Date;
        updatedAt: Date;
        factorsJson: string | null;
        totalScore: number | string | null;
        scoreConfidence: number | string | null;
        explanation: string | null;
        modelVersion: string | null;
        scoredAt: Date | null;
        rankPosition: number | string | null;
        avgRisk: number | string | null;
        blockingRisks: number | bigint;
        evidencePassed: number | bigint;
        evidenceFailed: number | bigint;
      }>
    >`
      SELECT
        CONVERT(varchar(36), c.id) AS id,
        c.title,
        c.summary,
        c.domain,
        c.audience,
        c.geography,
        c.status,
        c.gate_status AS gateStatus,
        c.decision,
        c.decision_reason AS decisionReason,
        c.confidence,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt,
        s.factors_json AS factorsJson,
        s.total_score AS totalScore,
        s.confidence AS scoreConfidence,
        s.explanation,
        s.model_version AS modelVersion,
        s.scored_at AS scoredAt,
        r.rank_position AS rankPosition,
        (
          SELECT AVG(CAST(risk_score AS float)) FROM iq_risk_assessments rk
          WHERE rk.candidate_id = c.id
        ) AS avgRisk,
        (
          SELECT COUNT(*) FROM iq_risk_assessments rk
          WHERE rk.candidate_id = c.id AND rk.blocking = 1
        ) AS blockingRisks,
        (
          SELECT COUNT(*) FROM iq_evidence_checks e
          WHERE e.candidate_id = c.id AND e.status IN ('PASSED','PASS','OK','CLEARED')
        ) AS evidencePassed,
        (
          SELECT COUNT(*) FROM iq_evidence_checks e
          WHERE e.candidate_id = c.id AND e.status IN ('FAILED','FAIL','REJECTED','INSUFFICIENT')
        ) AS evidenceFailed
      FROM iq_candidates c
      OUTER APPLY (
        SELECT TOP 1 *
        FROM iq_scores sc
        WHERE sc.candidate_id = c.id
        ORDER BY sc.scored_at DESC
      ) s
      OUTER APPLY (
        SELECT TOP 1 rank_position
        FROM iq_rankings rk
        WHERE rk.candidate_id = c.id
        ORDER BY rk.ranked_at DESC
      ) r
      ORDER BY c.updated_at DESC
    `;

    const auditRows = await prisma.$queryRaw<
      Array<{
        id: string;
        action: string;
        actorType: string;
        createdAt: Date;
        reason: string | null;
        candidateId: string | null;
      }>
    >`
      SELECT TOP 80
        CONVERT(varchar(36), id) AS id,
        action,
        actor_type AS actorType,
        created_at AS createdAt,
        reason,
        CONVERT(varchar(36), candidate_id) AS candidateId
      FROM iq_audit_events
      WHERE action LIKE '%DECISION%'
         OR action LIKE '%QUALIF%'
         OR action LIKE '%OVERRIDE%'
         OR action LIKE '%APPROV%'
         OR action LIKE '%REJECT%'
         OR action LIKE '%BLOCK%'
         OR action LIKE '%REASSESS%'
         OR action LIKE '%SELECT%'
      ORDER BY created_at DESC
    `;

    const candidateById = new Map(candidates.map((c) => [c.id, c]));
    const decisionsByCandidate = new Map<string, typeof decisionRows>();
    for (const row of decisionRows) {
      const list = decisionsByCandidate.get(row.candidateId) ?? [];
      list.push(row);
      decisionsByCandidate.set(row.candidateId, list);
    }

    const decidedIds = new Set(decisionRows.map((d) => d.candidateId));

    // Build one register row per decided candidate (latest decision), plus
    // candidates with decision column set but no iq_decisions row yet.
    const registerIds = [
      ...decidedIds,
      ...candidates
        .filter((c) => asDecision(c.decision) !== 'UNDECIDED' && !decidedIds.has(c.id))
        .map((c) => c.id),
    ];

    const records: DecisionRecord[] = registerIds.map((candidateId) => {
      const candidate = candidateById.get(candidateId);
      const historyRows = decisionsByCandidate.get(candidateId) ?? [];
      const latest = historyRows[0];

      const factors = parseFactors(candidate?.factorsJson ?? null);
      let qualificationScore = num(candidate?.totalScore);
      if (
        qualificationScore == null &&
        factors &&
        (Object.keys(DEFAULT_WEIGHTS) as Array<keyof typeof DEFAULT_WEIGHTS>).every(
          (key) => factors[key] != null,
        )
      ) {
        qualificationScore = scoreCandidate(factors as FactorScores);
      }

      const confidence =
        num(candidate?.scoreConfidence) ?? num(candidate?.confidence);
      const measuredConfidence = confidence != null && confidence >= 1;

      const finalDecision = asDecision(latest?.decision ?? candidate?.decision);
      const decisionSource = latest?.source ?? (candidate?.decision ? 'CANDIDATE_FIELD' : 'SYSTEM');
      const approvalStatus = approvalFrom(finalDecision, decisionSource);
      const decisionReason =
        latest?.reason ??
        candidate?.decisionReason ??
        (finalDecision === 'UNDECIDED'
          ? 'No persisted decision yet'
          : `Decision ${finalDecision} recorded without detailed reason`);

      const riskScore = num(candidate?.avgRisk) ?? factors?.risk ?? null;
      const blocking = Number(candidate?.blockingRisks ?? 0);
      const evidencePassed = Number(candidate?.evidencePassed ?? 0);
      const evidenceFailed = Number(candidate?.evidenceFailed ?? 0);

      const factorContribution = (
        Object.keys(DEFAULT_WEIGHTS) as Array<keyof typeof DEFAULT_WEIGHTS>
      ).map((key) => {
        const value = factors?.[key] ?? null;
        const weight = Math.round(DEFAULT_WEIGHTS[key] * 1000) / 10;
        const contribution =
          value != null ? Math.round(value * DEFAULT_WEIGHTS[key] * 100) / 100 : null;
        return { label: WEIGHT_LABELS[key], value, weight, contribution };
      });

      const scoreBreakdown = [
        { label: 'Composite', value: qualificationScore },
        { label: 'Strategy', value: factors?.strategicFit ?? null },
        { label: 'Evidence', value: factors?.evidence ?? null },
        { label: 'Audience', value: factors?.audienceValue ?? null },
        { label: 'Originality', value: factors?.originality ?? null },
        { label: 'Feasibility', value: factors?.feasibility ?? null },
        { label: 'Risk', value: riskScore },
        { label: 'Rank', value: num(candidate?.rankPosition) },
      ];

      const supportingEvidence = [
        {
          label: 'Evidence checks passed',
          status: evidencePassed > 0 ? 'RECORDED' : 'UNMEASURED',
          detail: `${evidencePassed} passed`,
        },
        {
          label: 'Evidence checks failed',
          status: evidenceFailed > 0 ? 'WARNING' : 'CLEAR',
          detail: `${evidenceFailed} failed`,
        },
        {
          label: 'Score explanation',
          status: candidate?.explanation ? 'RECORDED' : 'UNMEASURED',
          detail: candidate?.explanation?.slice(0, 240) ?? 'No explanation on iq_scores',
        },
        {
          label: 'Gate status',
          status: candidate?.gateStatus ?? 'UNKNOWN',
          detail: `gate_status=${candidate?.gateStatus ?? 'n/a'}`,
        },
      ];

      const governanceRules = [
        {
          code: 'MANDATORY_GATES',
          result: /PASS/i.test(candidate?.gateStatus ?? '') ? 'SATISFIED' : 'NOT_PASSED',
          detail: `Gate status ${candidate?.gateStatus ?? 'UNMEASURED'}`,
        },
        {
          code: 'DECISION_POLICY',
          result: latest?.policyVersion ? 'VERSIONED' : 'DEFAULT',
          detail: latest?.policyVersion
            ? `Policy ${latest.policyVersion}`
            : 'No policy_version on decision row',
        },
        {
          code: 'RISK_CEILING',
          result:
            riskScore == null
              ? 'UNMEASURED'
              : riskScore <= 30 && blocking === 0
                ? 'WITHIN_LIMIT'
                : 'EXCEEDED_OR_BLOCKING',
          detail:
            riskScore != null
              ? `Risk ${riskScore}; blocking ${blocking}`
              : 'No risk score persisted',
        },
        {
          code: 'DECISION_SOURCE',
          result: decisionSource.toUpperCase().includes('SYSTEM') ? 'AUTONOMOUS' : 'OVERRIDE_PATH',
          detail: `Source ${decisionSource}`,
        },
      ];

      const policyReferences = [
        latest?.policyVersion ? `policy:${latest.policyVersion}` : null,
        candidate?.modelVersion ? `model:${candidate.modelVersion}` : null,
        'rule:MANDATORY_GATES',
        'rule:DECISION_REGISTER_IMMUTABLE',
      ].filter((v): v is string => Boolean(v));

      const relatedAudit = auditRows.filter(
        (a) =>
          a.candidateId === candidateId ||
          (a.reason ?? '').includes(candidate?.title ?? '___none___'),
      );

      const overrideLogs = [
        ...historyRows
          .filter((h) => {
            const src = h.source.toUpperCase();
            return (
              src.includes('HUMAN') ||
              src.includes('OVERRIDE') ||
              src === 'MANUAL' ||
              src === 'OPERATOR'
            );
          })
          .map((h) => ({
            actor: h.source,
            action: h.decision,
            reason: h.reason,
            at: h.createdAt.toISOString(),
            status: 'RECORDED',
          })),
        ...relatedAudit
          .filter((a) => /OVERRIDE|HUMAN|MANUAL/i.test(a.action) || /OVERRIDE|HUMAN/i.test(a.actorType))
          .map((a) => ({
            actor: a.actorType,
            action: a.action,
            reason: a.reason ?? 'Audit override event',
            at: a.createdAt.toISOString(),
            status: 'AUDIT',
          })),
      ].slice(0, 12);

      const approvalChain = [
        {
          step: '1. Autonomous evaluation',
          actor: 'SYSTEM',
          status: finalDecision !== 'UNDECIDED' ? 'COMPLETE' : 'PENDING',
          at: latest?.createdAt.toISOString() ?? candidate?.scoredAt?.toISOString() ?? null,
        },
        {
          step: '2. Policy / model binding',
          actor: latest?.policyVersion ?? candidate?.modelVersion ?? 'UNMEASURED',
          status: latest?.policyVersion || candidate?.modelVersion ? 'BOUND' : 'UNMEASURED',
          at: latest?.createdAt.toISOString() ?? null,
        },
        {
          step: '3. Decision register write',
          actor: decisionSource,
          status: latest ? 'PERSISTED' : candidate?.decision ? 'CANDIDATE_FIELD_ONLY' : 'PENDING',
          at: latest?.createdAt.toISOString() ?? null,
        },
        {
          step: '4. Route to Selected Ideas',
          actor: 'AUTONOMOUS',
          status:
            finalDecision === 'QUALIFY'
              ? 'ELIGIBLE'
              : finalDecision === 'UNDECIDED'
                ? 'PENDING'
                : 'NOT_ROUTED',
          at: finalDecision === 'QUALIFY' ? latest?.createdAt.toISOString() ?? null : null,
        },
      ];

      if (overrideLogs.length) {
        approvalChain.push({
          step: 'Override recorded',
          actor: overrideLogs[0]?.actor ?? 'OVERRIDE',
          status: 'OBSERVE_ONLY',
          at: overrideLogs[0]?.at ?? null,
        });
      }

      const history = historyRows.map((h) => ({
        id: h.id,
        decision: h.decision,
        reason: h.reason,
        source: h.source,
        policyVersion: h.policyVersion,
        createdAt: h.createdAt.toISOString(),
      }));

      const versionComparison = historyRows
        .slice()
        .reverse()
        .map((h, index, arr) => ({
          version: index + 1,
          decision: h.decision,
          score: qualificationScore,
          source: h.source,
          at: h.createdAt.toISOString(),
          changed: index === 0 ? true : h.decision !== arr[index - 1]?.decision,
        }));

      const explainability: string[] = [];
      explainability.push(`Final decision: ${finalDecision} (${approvalStatus})`);
      explainability.push(`Reason: ${decisionReason}`);
      if (qualificationScore != null) {
        explainability.push(`Qualification score ${qualificationScore}`);
      }
      if (confidence != null) explainability.push(`AI confidence ${confidence}%`);
      if (num(candidate?.rankPosition) != null) {
        explainability.push(`Rank #${num(candidate?.rankPosition)}`);
      }
      for (const rule of governanceRules) {
        explainability.push(`${rule.code}: ${rule.result}`);
      }
      if (candidate?.explanation) {
        explainability.push(candidate.explanation.slice(0, 200));
      }

      const explainableSummary =
        finalDecision === 'UNDECIDED'
          ? `${candidate?.title ?? candidateId} awaits a persisted qualification decision.`
          : `${candidate?.title ?? candidateId} → ${finalDecision}. ${decisionReason}`;

      const digitalSignature =
        latest != null
          ? `iq_decisions:${latest.id}:${latest.source}:${latest.createdAt.toISOString()}`
          : null;

      const createdAt = candidate?.createdAt.toISOString() ?? latest?.createdAt.toISOString() ?? new Date().toISOString();
      const updatedAt = candidate?.updatedAt.toISOString() ?? createdAt;
      const timestamp = latest?.createdAt.toISOString() ?? updatedAt;

      return {
        id: latest?.id ?? `candidate-decision:${candidateId}`,
        candidateId,
        title: candidate?.title ?? 'Unknown candidate',
        summary: candidate?.summary ?? '',
        domain: candidate?.domain ?? '—',
        audience: candidate?.audience ?? null,
        geography: candidate?.geography ?? null,
        candidateStatus: candidate?.status ?? 'UNKNOWN',
        gateStatus: candidate?.gateStatus ?? 'NOT_EVALUATED',
        finalDecision,
        qualificationScore,
        confidence,
        measuredConfidence,
        approvalStatus,
        decisionReason,
        explainableSummary,
        supportingEvidence,
        riskAssessment: {
          score: riskScore,
          band: riskBand(riskScore),
          blocking,
          detail:
            riskScore != null
              ? `Avg risk ${riskScore}; ${blocking} blocking assessment(s)`
              : 'No risk assessments persisted',
        },
        decisionVersion: historyRows.length || (finalDecision !== 'UNDECIDED' ? 1 : 0),
        timestamp,
        modelVersion: candidate?.modelVersion ?? null,
        policyVersion: latest?.policyVersion ?? null,
        decisionSource,
        workflowStage: workflowStage(finalDecision, candidate?.status ?? ''),
        factorContribution,
        scoreBreakdown,
        governanceRules,
        policyReferences,
        overrideLogs,
        approvalChain,
        digitalSignature,
        history,
        versionComparison,
        explainability,
        lifecycle: [
          {
            key: 'score',
            label: 'Score & rank available',
            done: qualificationScore != null || num(candidate?.rankPosition) != null,
            at: candidate?.scoredAt?.toISOString() ?? null,
          },
          {
            key: 'decide',
            label: 'Decision generated',
            done: finalDecision !== 'UNDECIDED',
            at: timestamp,
          },
          {
            key: 'explain',
            label: 'Explainability recorded',
            done: Boolean(decisionReason) && finalDecision !== 'UNDECIDED',
            at: timestamp,
          },
          {
            key: 'govern',
            label: 'Governance bind',
            done: Boolean(latest?.policyVersion) || Boolean(candidate?.modelVersion),
            at: timestamp,
          },
          {
            key: 'register',
            label: 'Immutable register write',
            done: Boolean(latest),
            at: latest?.createdAt.toISOString() ?? null,
          },
          {
            key: 'route',
            label: 'Route to Selected Ideas',
            done: finalDecision === 'QUALIFY',
            at: finalDecision === 'QUALIFY' ? timestamp : null,
          },
        ],
        factors,
        rankPosition: num(candidate?.rankPosition),
        createdAt,
        updatedAt,
      };
    });

    // Sort: latest decision first
    records.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const approvedIdeas = records.filter((r) => r.finalDecision === 'QUALIFY').length;
    const rejectedIdeas = records.filter((r) => r.finalDecision === 'REJECT').length;
    const deferredReviews = records.filter((r) => r.finalDecision === 'REASSESS').length;
    const escalatedDecisions = records.filter((r) => r.finalDecision === 'BLOCK').length;
    const overrideRequests = records.reduce(
      (sum, r) => sum + r.overrideLogs.length,
      0,
    );

    const aiConfidence = avg(
      records.map((r) => r.confidence).filter((v): v is number => v != null),
    );

    const withPersistedDecision = records.filter((r) =>
      decisionRows.some((d) => d.candidateId === r.candidateId),
    ).length;
    const governanceCompliance = pct(withPersistedDecision, Math.max(records.length, 1));

    // Accuracy: latest decision matches candidate.decision when both present
    let match = 0;
    let comparable = 0;
    for (const record of records) {
      const candidate = candidateById.get(record.candidateId);
      if (!candidate?.decision) continue;
      comparable += 1;
      if (asDecision(candidate.decision) === record.finalDecision) match += 1;
    }
    const decisionAccuracy = pct(match, comparable);

    const recommendations: DecisionRegisterOverview['recommendations'] = [];
    for (const item of records.slice(0, 14)) {
      recommendations.push({
        id: `dec-${item.id}`,
        action: item.finalDecision,
        reason: `${item.title} · ${item.approvalStatus} · ${item.decisionReason.slice(0, 120)}`,
        priority:
          item.finalDecision === 'BLOCK' || item.finalDecision === 'REJECT'
            ? 'HIGH'
            : item.finalDecision === 'REASSESS'
              ? 'MEDIUM'
              : 'LOW',
        candidateId: item.candidateId,
      });
    }

    const notifications: DecisionRegisterOverview['notifications'] = [];
    for (const item of records.slice(0, 12)) {
      if (item.finalDecision === 'QUALIFY') {
        notifications.push({
          id: `ok-${item.id}`,
          severity: 'INFO',
          message: `Approved — route to Selected Ideas: ${item.title}`,
        });
      }
      if (item.finalDecision === 'REJECT') {
        notifications.push({
          id: `rej-${item.id}`,
          severity: 'WARNING',
          message: `Rejected: ${item.title}`,
        });
      }
      if (item.finalDecision === 'BLOCK') {
        notifications.push({
          id: `blk-${item.id}`,
          severity: 'CRITICAL',
          message: `Escalated / blocked: ${item.title}`,
        });
      }
      if (item.finalDecision === 'REASSESS') {
        notifications.push({
          id: `rea-${item.id}`,
          severity: 'WARNING',
          message: `Deferred for reassessment: ${item.title}`,
        });
      }
      if (item.overrideLogs.length) {
        notifications.push({
          id: `ovr-${item.id}`,
          severity: 'WARNING',
          message: `Override path recorded for ${item.title} (observe-only)`,
        });
      }
    }

    const modelVersions = [
      ...new Set(
        records.map((r) => r.modelVersion).filter((v): v is string => Boolean(v)),
      ),
    ];
    const policyVersions = [
      ...new Set(
        records.map((r) => r.policyVersion).filter((v): v is string => Boolean(v)),
      ),
    ];

    const hasDecisions = records.some((r) => r.finalDecision !== 'UNDECIDED');
    const pipeline = [
      { key: 'rank', label: 'Ranking Complete' },
      { key: 'evaluate', label: 'Evaluate Decision' },
      { key: 'explain', label: 'Explain Decision' },
      { key: 'govern', label: 'Apply Governance' },
      { key: 'register', label: 'Write Register' },
      { key: 'audit', label: 'Immutable Audit' },
      { key: 'notify', label: 'Notify Downstream' },
      { key: 'route', label: 'Route to Selected Ideas' },
    ].map((item, index) => {
      let state: 'pending' | 'active' | 'done' | 'failed' = 'pending';
      if (escalatedDecisions > 0 && item.key === 'evaluate') state = 'failed';
      else if (approvedIdeas > 0 && index <= 7) state = 'done';
      else if (hasDecisions && index <= 5) state = 'done';
      else if (hasDecisions && index === 6) state = 'active';
      else if (candidates.length && index === 0) state = 'active';
      return { ...item, state };
    });

    const decisionDistribution = [
      { label: 'QUALIFY', count: approvedIdeas },
      { label: 'REJECT', count: rejectedIdeas },
      { label: 'REASSESS', count: deferredReviews },
      { label: 'BLOCK', count: escalatedDecisions },
    ];

    const sourceMap = new Map<string, number>();
    for (const row of decisionRows) {
      sourceMap.set(row.source, (sourceMap.get(row.source) ?? 0) + 1);
    }

    const dayBuckets = new Map<string, { approved: number; rejected: number }>();
    for (const row of decisionRows) {
      const day = row.createdAt.toISOString().slice(0, 10);
      const bucket = dayBuckets.get(day) ?? { approved: 0, rejected: 0 };
      if (asDecision(row.decision) === 'QUALIFY') bucket.approved += 1;
      if (asDecision(row.decision) === 'REJECT') bucket.rejected += 1;
      dayBuckets.set(day, bucket);
    }

    return {
      available: true,
      meta: {
        cycleStatus: cycles[0]?.status ?? 'NOT_STARTED',
        intakeStatus: intakes[0]?.status ?? null,
        modelVersions,
        policyVersions,
      },
      metrics: {
        approvedIdeas,
        rejectedIdeas,
        deferredReviews,
        escalatedDecisions,
        aiConfidence,
        governanceCompliance,
        overrideRequests,
        decisionAccuracy,
        totalDecisions: decisionRows.length,
        decidedCandidates: records.length,
      },
      pipeline,
      records,
      recommendations,
      analytics: {
        decisionDistribution,
        sourceDistribution: [...sourceMap.entries()].map(([label, count]) => ({
          label,
          count,
        })),
        approvalTrends: [...dayBuckets.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-14)
          .map(([label, v]) => ({
            label,
            approved: v.approved,
            rejected: v.rejected,
          })),
        complianceDashboard: [
          { label: 'Persisted register coverage', value: governanceCompliance },
          { label: 'Decision accuracy (field sync)', value: decisionAccuracy },
          {
            label: 'Override rate',
            value: pct(overrideRequests, Math.max(records.length, 1)),
          },
          { label: 'AI confidence (avg)', value: aiConfidence },
        ],
      },
      governance: {
        modelVersions,
        policyVersions,
        decisionsLogged: decisionRows.length,
        auditEvents: auditRows.length,
        overrideCount: overrideRequests,
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
      error instanceof Error ? error.message : 'Failed to load decision register',
      'ERROR',
    );
  }
}
