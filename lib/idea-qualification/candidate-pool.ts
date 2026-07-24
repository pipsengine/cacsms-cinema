import { prisma } from '@/lib/db';
import type { FactorScores, QualificationStatus } from './contracts';

export type PoolCandidate = {
  id: string;
  rank: number | null;
  title: string;
  summary: string;
  topic: string;
  category: string;
  subcategory: string | null;
  region: string | null;
  language: string | null;
  audience: string | null;
  formatHint: string | null;
  status: QualificationStatus;
  gateStatus: string;
  decision: string | null;
  decisionReason: string | null;
  score: number;
  measuredScore: boolean;
  confidence: number;
  measuredConfidence: boolean;
  strategyFit: number | null;
  originality: number | null;
  evidenceQuality: number | null;
  audienceValue: number | null;
  commercialValue: number | null;
  productionReadiness: number | null;
  visualPotential: number | null;
  evergreenPotential: number | null;
  educationalValue: number | null;
  riskScore: number | null;
  evidencePassed: number;
  evidenceFailed: number;
  maxDuplicateSimilarity: number | null;
  factors: Partial<FactorScores> | null;
  explanation: string | null;
  modelVersion: string | null;
  aiSummary: string;
  explainability: string[];
  nextStage: string;
  nextAction: string;
  recommendation: string;
  cycleId: string;
  upstreamOpportunityId: string;
  discoveryRunId: string | null;
  strategyVersionId: string | null;
  strategyVersionNumber: number | null;
  risks: Array<{ category: string; severity: string; score: number }>;
  lifecycle: Array<{ key: string; label: string; at: string | null; done: boolean }>;
  knowledge: Array<{ label: string; value: string }>;
  audienceIntel: Array<{ label: string; value: string | null }>;
  commercial: Array<{ label: string; value: string | null }>;
  production: Array<{ label: string; value: string | null }>;
  audit: Array<{ action: string; at: string; reason: string | null }>;
  createdAt: string;
  updatedAt: string;
};

export type CandidatePoolOverview = {
  available: boolean;
  reason?: string;
  meta: {
    cycleStatus: string;
    intakeStatus: string | null;
    lastUpdatedAt: string | null;
  };
  metrics: {
    totalCandidates: number;
    newToday: number;
    underQualification: number;
    passed: number;
    rejected: number;
    escalated: number;
    awaitingEvidence: number;
    aiConfidence: number | null;
    averageQualificationTimeMs: number | null;
    commercialScore: number | null;
    productionReadiness: number | null;
    strategyAlignment: number | null;
    audienceMatch: number | null;
    duplicateRate: number | null;
    researchReady: number;
  };
  pipeline: Array<{
    key: string;
    label: string;
    state: 'pending' | 'active' | 'done';
  }>;
  candidates: PoolCandidate[];
  recommendations: Array<{
    id: string;
    action: string;
    reason: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    candidateId?: string;
  }>;
  analytics: {
    topicDistribution: Array<{ label: string; count: number }>;
    statusDistribution: Array<{ label: string; count: number }>;
    confidenceBuckets: Array<{ label: string; count: number }>;
  };
  notifications: Array<{
    id: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
  }>;
  lastUpdated: string;
};

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, n) => sum + n, 0) / values.length);
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

function num(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseFactors(raw: string | null): Partial<FactorScores> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<FactorScores> = {};
    const keys: Array<keyof FactorScores> = [
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
    ];
    for (const key of keys) {
      const value = num(parsed[key] as number | string | null);
      if (value != null) out[key] = value;
    }
    return out;
  } catch {
    return null;
  }
}

function nextAction(status: string, gateStatus: string, decision: string | null): string {
  if (decision === 'QUALIFY' || status === 'QUALIFIED' || status === 'SELECTED') {
    return 'Proceed to Research';
  }
  if (decision === 'REJECT' || status === 'REJECTED') return 'Archive / reject';
  if (decision === 'BLOCK' || status === 'BLOCKED' || gateStatus === 'FAILED') {
    return 'Escalate for review';
  }
  if (decision === 'REASSESS') return 'Rescore';
  if (status === 'HANDED_OFF') return 'Monitor Research handoff';
  if (status === 'RECEIVED' || status === 'NORMALISING') return 'Await qualification';
  return 'Continue evaluation';
}

function recommendationFor(input: {
  status: string;
  decision: string | null;
  evidenceFailed: number;
  evidencePassed: number;
  duplicate: number | null;
  strategyFit: number | null;
}): string {
  if (input.decision === 'QUALIFY' || input.status === 'QUALIFIED' || input.status === 'SELECTED') {
    return 'Proceed to Research';
  }
  if (input.evidenceFailed > input.evidencePassed && input.evidenceFailed > 0) {
    return 'Request More Evidence';
  }
  if ((input.duplicate ?? 0) >= 65) return 'Merge with Existing Idea';
  if (input.strategyFit != null && input.strategyFit < 70) return 'Delay';
  if (input.status === 'BLOCKED') return 'Escalate for Review';
  if (input.status === 'REJECTED') return 'Reject';
  if (input.status === 'EVALUATING') return 'Split into Multiple Topics';
  return 'Continue qualification';
}

function nextStage(status: string): string {
  switch (status) {
    case 'HANDED_OFF':
    case 'SELECTED':
    case 'QUALIFIED':
      return 'Research & Evidence';
    case 'REJECTED':
    case 'ARCHIVED':
      return 'Closed';
    case 'BLOCKED':
      return 'Failure & Recovery';
    default:
      return 'Evidence Sufficiency';
  }
}

function buildExplainability(input: {
  score: number;
  measuredScore: boolean;
  factors: Partial<FactorScores> | null;
  decisionReason: string | null;
  explanation: string | null;
  duplicate: number | null;
}): string[] {
  const lines: string[] = [];
  if (input.measuredScore) lines.push(`Overall score: ${input.score}`);
  const f = input.factors;
  if (f?.strategicFit != null) lines.push(`Strategy alignment: ${f.strategicFit}%`);
  if (f?.evidence != null) lines.push(`Evidence coverage: ${f.evidence}%`);
  if (f?.audienceValue != null) lines.push(`Audience demand: ${f.audienceValue}%`);
  if (f?.originality != null) lines.push(`Originality: ${f.originality}%`);
  if (f?.feasibility != null) lines.push(`Production readiness: ${f.feasibility}%`);
  if (f?.educationalValue != null) lines.push(`Educational value: ${f.educationalValue}%`);
  if (f?.risk != null) lines.push(`Risk: ${f.risk}`);
  if (input.duplicate != null) {
    lines.push(
      input.duplicate < 65
        ? `No blocking duplicate (similarity ${input.duplicate}%)`
        : `Duplicate similarity ${input.duplicate}%`,
    );
  }
  if (input.decisionReason) lines.push(input.decisionReason);
  if (input.explanation) lines.push(input.explanation);
  if (!lines.length) lines.push('No factor explanation persisted yet for this candidate');
  return lines;
}

function buildAiSummary(input: {
  title: string;
  factors: Partial<FactorScores> | null;
  status: string;
  measuredScore: boolean;
  score: number;
}): string {
  const f = input.factors;
  if (!f || !Object.keys(f).length) {
    return `${input.title} is in the candidate pool with status ${input.status}. Detailed factor explainability will appear once qualification scoring is persisted.`;
  }
  const parts = [
    f.strategicFit != null && f.strategicFit >= 80
      ? 'aligns strongly with the active strategy'
      : 'is under strategy evaluation',
    f.educationalValue != null && f.educationalValue >= 75
      ? 'demonstrates high educational value'
      : null,
    f.audienceValue != null && f.audienceValue >= 75
      ? 'addresses emerging audience demand'
      : null,
    f.evidence != null && f.evidence >= 75
      ? 'is supported by verified evidence signals'
      : null,
    f.feasibility != null && f.feasibility >= 70
      ? 'shows solid production feasibility'
      : null,
    f.risk != null && f.risk <= 30
      ? 'carries relatively low measured risk'
      : f.risk != null
        ? 'requires risk mitigation review'
        : null,
  ].filter(Boolean);
  const scoreBit = input.measuredScore ? ` Overall score ${input.score}.` : '';
  return `This documentary idea ${parts.join(', ') || 'is awaiting richer factor persistence'}.${scoreBit}`;
}

export async function loadCandidatePool(): Promise<CandidatePoolOverview> {
  try {
    const intake = await prisma.$queryRaw<
      Array<{ id: string; status: string; strategyVersionId: string }>
    >`
      SELECT TOP 1
        CONVERT(varchar(36), id) AS id,
        status,
        CONVERT(varchar(36), strategy_version_id) AS strategyVersionId
      FROM iq_intake_packages
      WHERE status = 'ACKNOWLEDGED'
      ORDER BY acknowledged_at DESC
    `;

    const cycles = await prisma.$queryRaw<
      Array<{ id: string; status: string; startedAt: Date | null }>
    >`
      SELECT TOP 1
        CONVERT(varchar(36), id) AS id,
        status,
        started_at AS startedAt
      FROM iq_cycles
      ORDER BY created_at DESC
    `;

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        cycleId: string;
        upstreamOpportunityId: string;
        title: string;
        summary: string;
        domain: string;
        geography: string | null;
        audience: string | null;
        formatHint: string | null;
        status: string;
        score: number | string;
        confidence: number | string;
        gateStatus: string;
        decision: string | null;
        decisionReason: string | null;
        sourcePayloadJson: string | null;
        createdAt: Date;
        updatedAt: Date;
        totalScore: number | string | null;
        scoreConfidence: number | string | null;
        factorsJson: string | null;
        explanation: string | null;
        modelVersion: string | null;
        rankPosition: number | null;
        evidencePassed: number | bigint;
        evidenceFailed: number | bigint;
        maxDuplicateSimilarity: number | string | null;
        avgRiskScore: number | string | null;
        discoveryRunId: string | null;
        strategyVersionId: string | null;
        strategyVersionNumber: number | bigint | null;
      }>
    >`
      SELECT TOP 200
        CONVERT(varchar(36), c.id) AS id,
        CONVERT(varchar(36), c.cycle_id) AS cycleId,
        CONVERT(varchar(36), c.upstream_opportunity_id) AS upstreamOpportunityId,
        c.title,
        c.summary,
        c.domain,
        c.geography,
        c.audience,
        c.format_hint AS formatHint,
        c.status,
        c.score,
        c.confidence,
        c.gate_status AS gateStatus,
        c.decision,
        c.decision_reason AS decisionReason,
        c.source_payload_json AS sourcePayloadJson,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt,
        s.total_score AS totalScore,
        s.confidence AS scoreConfidence,
        s.factors_json AS factorsJson,
        s.explanation,
        s.model_version AS modelVersion,
        r.rank_position AS rankPosition,
        (
          SELECT COUNT(*) FROM iq_evidence_checks e
          WHERE e.candidate_id = c.id AND e.status IN ('PASSED','PASS','OK')
        ) AS evidencePassed,
        (
          SELECT COUNT(*) FROM iq_evidence_checks e
          WHERE e.candidate_id = c.id AND e.status IN ('FAILED','FAIL','REJECTED')
        ) AS evidenceFailed,
        (
          SELECT MAX(similarity) FROM iq_duplicate_checks d WHERE d.candidate_id = c.id
        ) AS maxDuplicateSimilarity,
        (
          SELECT AVG(CAST(risk_score AS float)) FROM iq_risk_assessments rk
          WHERE rk.candidate_id = c.id
        ) AS avgRiskScore,
        CONVERT(varchar(36), i.source_run_id) AS discoveryRunId,
        CONVERT(varchar(36), i.strategy_version_id) AS strategyVersionId,
        sp.version_number AS strategyVersionNumber
      FROM iq_candidates c
      INNER JOIN iq_cycles cy ON cy.id = c.cycle_id
      LEFT JOIN iq_intake_packages i ON i.id = cy.intake_package_id
      OUTER APPLY (
        SELECT TOP 1 version_number
        FROM ci_strategy_packages pkg
        WHERE pkg.strategy_version_id = i.strategy_version_id
        ORDER BY pkg.acknowledged_at DESC
      ) sp
      OUTER APPLY (
        SELECT TOP 1 *
        FROM iq_scores sc
        WHERE sc.candidate_id = c.id
        ORDER BY sc.scored_at DESC
      ) s
      LEFT JOIN iq_rankings r ON r.candidate_id = c.id
      ORDER BY
        CASE WHEN r.rank_position IS NULL THEN 1 ELSE 0 END,
        r.rank_position ASC,
        COALESCE(s.total_score, c.score) DESC,
        c.created_at DESC
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

    const auditRows = await prisma.$queryRaw<
      Array<{
        candidateId: string | null;
        action: string;
        createdAt: Date;
        reason: string | null;
      }>
    >`
      SELECT TOP 200
        CONVERT(varchar(36), candidate_id) AS candidateId,
        action,
        created_at AS createdAt,
        reason
      FROM iq_audit_events
      WHERE candidate_id IS NOT NULL
      ORDER BY created_at DESC
    `;

    const risksByCandidate = new Map<string, Array<{ category: string; severity: string; score: number }>>();
    for (const row of riskRows) {
      const list = risksByCandidate.get(row.candidateId) ?? [];
      if (list.length < 8) {
        list.push({
          category: row.category,
          severity: row.severity,
          score: Math.round(Number(row.score)),
        });
      }
      risksByCandidate.set(row.candidateId, list);
    }

    const auditByCandidate = new Map<
      string,
      Array<{ action: string; at: string; reason: string | null }>
    >();
    for (const row of auditRows) {
      if (!row.candidateId) continue;
      const list = auditByCandidate.get(row.candidateId) ?? [];
      if (list.length < 10) {
        list.push({
          action: row.action,
          at: row.createdAt.toISOString(),
          reason: row.reason,
        });
      }
      auditByCandidate.set(row.candidateId, list);
    }

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const candidates: PoolCandidate[] = rows.map((row, index) => {
      const factors = parseFactors(row.factorsJson);
      const score = num(row.totalScore) ?? num(row.score) ?? 0;
      const confidence = num(row.scoreConfidence) ?? num(row.confidence) ?? 0;
      const measuredScore = score > 0;
      const measuredConfidence = confidence >= 1;
      const duplicate = num(row.maxDuplicateSimilarity);
      const strategyFit = factors?.strategicFit ?? null;
      const evidencePassed = Number(row.evidencePassed ?? 0);
      const evidenceFailed = Number(row.evidenceFailed ?? 0);
      const status = row.status as QualificationStatus;
      const explainability = buildExplainability({
        score,
        measuredScore,
        factors,
        decisionReason: row.decisionReason,
        explanation: row.explanation,
        duplicate,
      });

      let subcategory: string | null = null;
      let language: string | null = null;
      try {
        if (row.sourcePayloadJson) {
          const payload = JSON.parse(row.sourcePayloadJson) as Record<string, unknown>;
          if (typeof payload.subcategory === 'string') subcategory = payload.subcategory;
          if (typeof payload.language === 'string') language = payload.language;
        }
      } catch {
        /* ignore */
      }

      const createdAt = row.createdAt.toISOString();
      const updatedAt = row.updatedAt.toISOString();
      const hasEvidence = evidencePassed + evidenceFailed > 0;
      const scored = Boolean(row.factorsJson || measuredScore);
      const approved =
        status === 'QUALIFIED' || status === 'SELECTED' || status === 'HANDED_OFF';

      return {
        id: row.id,
        rank: row.rankPosition != null ? Number(row.rankPosition) : index + 1,
        title: row.title,
        summary: row.summary,
        topic: row.domain,
        category: row.domain,
        subcategory,
        region: row.geography,
        language,
        audience: row.audience,
        formatHint: row.formatHint,
        status,
        gateStatus: row.gateStatus,
        decision: row.decision,
        decisionReason: row.decisionReason,
        score,
        measuredScore,
        confidence,
        measuredConfidence,
        strategyFit,
        originality: factors?.originality ?? null,
        evidenceQuality: factors?.evidence ?? null,
        audienceValue: factors?.audienceValue ?? null,
        commercialValue: factors?.audienceValue ?? null,
        productionReadiness: factors?.feasibility ?? null,
        visualPotential: factors?.visualPotential ?? null,
        evergreenPotential: factors?.timeliness ?? null,
        educationalValue: factors?.educationalValue ?? null,
        riskScore: num(row.avgRiskScore) ?? factors?.risk ?? null,
        evidencePassed,
        evidenceFailed,
        maxDuplicateSimilarity: duplicate,
        factors,
        explanation: row.explanation,
        modelVersion: row.modelVersion,
        aiSummary: buildAiSummary({
          title: row.title,
          factors,
          status,
          measuredScore,
          score,
        }),
        explainability,
        nextStage: nextStage(status),
        nextAction: nextAction(status, row.gateStatus, row.decision),
        recommendation: recommendationFor({
          status,
          decision: row.decision,
          evidenceFailed,
          evidencePassed,
          duplicate,
          strategyFit,
        }),
        cycleId: row.cycleId,
        upstreamOpportunityId: row.upstreamOpportunityId,
        discoveryRunId: row.discoveryRunId,
        strategyVersionId: row.strategyVersionId,
        strategyVersionNumber:
          row.strategyVersionNumber != null ? Number(row.strategyVersionNumber) : null,
        risks: risksByCandidate.get(row.id) ?? [],
        lifecycle: [
          { key: 'generated', label: 'Generated', at: createdAt, done: true },
          { key: 'received', label: 'Received', at: createdAt, done: true },
          {
            key: 'validated',
            label: 'Validated',
            at: status !== 'RECEIVED' ? updatedAt : null,
            done: status !== 'RECEIVED',
          },
          {
            key: 'evidence',
            label: 'Evidence Checked',
            at: hasEvidence ? updatedAt : null,
            done: hasEvidence,
          },
          {
            key: 'strategy',
            label: 'Strategy Matched',
            at: strategyFit != null ? updatedAt : null,
            done: strategyFit != null,
          },
          {
            key: 'audience',
            label: 'Audience Analysed',
            at: factors?.audienceValue != null ? updatedAt : null,
            done: factors?.audienceValue != null,
          },
          {
            key: 'originality',
            label: 'Originality Tested',
            at: factors?.originality != null || duplicate != null ? updatedAt : null,
            done: factors?.originality != null || duplicate != null,
          },
          {
            key: 'production',
            label: 'Production Analysed',
            at: factors?.feasibility != null ? updatedAt : null,
            done: factors?.feasibility != null,
          },
          {
            key: 'approved',
            label: 'Approved',
            at: approved ? updatedAt : null,
            done: approved,
          },
          {
            key: 'research',
            label: 'Research Ready',
            at: status === 'HANDED_OFF' || status === 'SELECTED' ? updatedAt : null,
            done: status === 'HANDED_OFF' || status === 'SELECTED' || status === 'QUALIFIED',
          },
        ],
        knowledge: [
          { label: 'Topic', value: row.domain },
          { label: 'Region', value: row.geography ?? 'UNMEASURED' },
          { label: 'Audience', value: row.audience ?? 'UNMEASURED' },
          { label: 'Upstream opportunity', value: row.upstreamOpportunityId },
          { label: 'Related ideas', value: 'UNMEASURED' },
          { label: 'Entities / organizations', value: 'UNMEASURED' },
        ],
        audienceIntel: [
          { label: 'Target audience', value: row.audience },
          { label: 'Geographic interest', value: row.geography },
          { label: 'Age groups', value: null },
          { label: 'Personas', value: null },
          { label: 'Search intent', value: null },
          { label: 'Engagement forecast', value: null },
          { label: 'Retention prediction', value: null },
        ],
        commercial: [
          {
            label: 'Commercial score',
            value: factors?.audienceValue != null ? `${factors.audienceValue}` : null,
          },
          { label: 'Estimated views', value: null },
          { label: 'Sponsorship potential', value: null },
          { label: 'Licensing opportunity', value: null },
          { label: 'Revenue forecast', value: null },
          { label: 'Production budget', value: null },
          { label: 'ROI estimate', value: null },
          { label: 'Platform suitability', value: row.formatHint },
        ],
        production: [
          {
            label: 'Feasibility',
            value: factors?.feasibility != null ? `${factors.feasibility}` : null,
          },
          {
            label: 'Visual potential',
            value: factors?.visualPotential != null ? `${factors.visualPotential}` : null,
          },
          {
            label: 'Source availability',
            value: factors?.sourceAvailability != null ? `${factors.sourceAvailability}` : null,
          },
          { label: 'Archive footage', value: null },
          { label: 'Animation requirement', value: null },
          { label: 'Script complexity', value: null },
          { label: 'Estimated timeline', value: null },
          { label: 'Crew requirements', value: null },
        ],
        audit: auditByCandidate.get(row.id) ?? [],
        createdAt,
        updatedAt,
      };
    });

    const statusCounts = new Map<string, number>();
    const topicCounts = new Map<string, number>();
    for (const item of candidates) {
      statusCounts.set(item.status, (statusCounts.get(item.status) ?? 0) + 1);
      topicCounts.set(item.topic, (topicCounts.get(item.topic) ?? 0) + 1);
    }

    const passed =
      (statusCounts.get('QUALIFIED') ?? 0) +
      (statusCounts.get('SELECTED') ?? 0) +
      (statusCounts.get('HANDED_OFF') ?? 0);
    const rejected = statusCounts.get('REJECTED') ?? 0;
    const escalated = statusCounts.get('BLOCKED') ?? 0;
    const underQualification =
      (statusCounts.get('RECEIVED') ?? 0) +
      (statusCounts.get('NORMALISING') ?? 0) +
      (statusCounts.get('EVALUATING') ?? 0);
    const awaitingEvidence = candidates.filter(
      (item) => item.evidenceFailed > item.evidencePassed || item.evidencePassed === 0,
    ).length;
    const newToday = candidates.filter(
      (item) => new Date(item.createdAt).getTime() >= startOfDay.getTime(),
    ).length;
    const researchReady = candidates.filter(
      (item) =>
        item.status === 'QUALIFIED' ||
        item.status === 'SELECTED' ||
        item.status === 'HANDED_OFF',
    ).length;

    const durations = candidates
      .filter((item) =>
        ['QUALIFIED', 'REJECTED', 'SELECTED', 'HANDED_OFF', 'BLOCKED'].includes(item.status),
      )
      .map((item) => new Date(item.updatedAt).getTime() - new Date(item.createdAt).getTime())
      .filter((value) => value >= 0);

    const duplicateHits = candidates.filter(
      (item) => (item.maxDuplicateSimilarity ?? 0) >= 65,
    ).length;

    const recommendations: CandidatePoolOverview['recommendations'] = [];
    for (const item of candidates.slice(0, 12)) {
      recommendations.push({
        id: `rec-${item.id}`,
        action: item.recommendation,
        reason: `${item.title} · ${item.status} · score ${item.measuredScore ? item.score : 'UNMEAS.'}`,
        priority:
          item.recommendation === 'Proceed to Research'
            ? 'HIGH'
            : item.recommendation.includes('Evidence') || item.recommendation.includes('Escalate')
              ? 'HIGH'
              : 'MEDIUM',
        candidateId: item.id,
      });
    }

    const notifications: CandidatePoolOverview['notifications'] = [];
    for (const item of candidates.slice(0, 10)) {
      if (item.measuredScore && item.score >= 90) {
        notifications.push({
          id: `high-${item.id}`,
          severity: 'INFO',
          message: `High-value candidate detected: ${item.title}`,
        });
      }
      if ((item.maxDuplicateSimilarity ?? 0) >= 65) {
        notifications.push({
          id: `dup-${item.id}`,
          severity: 'WARNING',
          message: `Duplicate candidate found: ${item.title} (${item.maxDuplicateSimilarity}%)`,
        });
      }
      if (item.evidenceFailed > item.evidencePassed && item.evidenceFailed > 0) {
        notifications.push({
          id: `ev-${item.id}`,
          severity: 'WARNING',
          message: `Evidence insufficient: ${item.title}`,
        });
      }
      if (item.strategyFit != null && item.strategyFit < 70) {
        notifications.push({
          id: `fit-${item.id}`,
          severity: 'WARNING',
          message: `Strategy mismatch: ${item.title}`,
        });
      }
      if (item.status === 'QUALIFIED' || item.status === 'SELECTED') {
        notifications.push({
          id: `ready-${item.id}`,
          severity: 'INFO',
          message: `Candidate promoted toward Research: ${item.title}`,
        });
      }
    }

    const confidenceBuckets = [
      { label: '90-100', count: 0 },
      { label: '75-89', count: 0 },
      { label: '50-74', count: 0 },
      { label: '0-49', count: 0 },
      { label: 'UNMEASURED', count: 0 },
    ];
    for (const item of candidates) {
      if (!item.measuredConfidence) {
        confidenceBuckets[4].count += 1;
      } else if (item.confidence >= 90) confidenceBuckets[0].count += 1;
      else if (item.confidence >= 75) confidenceBuckets[1].count += 1;
      else if (item.confidence >= 50) confidenceBuckets[2].count += 1;
      else confidenceBuckets[3].count += 1;
    }

    const cycle = cycles[0];
    const hasCandidates = candidates.length > 0;
    const pipeline = [
      { key: 'intake', label: 'Package Intake' },
      { key: 'pool', label: 'Candidate Pool' },
      { key: 'evidence', label: 'Evidence Sufficiency' },
      { key: 'strategy', label: 'Strategy Fit' },
      { key: 'audience', label: 'Audience Value' },
      { key: 'originality', label: 'Originality' },
      { key: 'duplicates', label: 'Duplicate Detection' },
      { key: 'feasibility', label: 'Production Feasibility' },
      { key: 'visual', label: 'Visual Potential' },
      { key: 'research', label: 'Research & Evidence' },
    ].map((item, index) => ({
      ...item,
      state: (!intake[0]
        ? 'pending'
        : !hasCandidates
          ? index <= 1
            ? 'active'
            : 'pending'
          : researchReady > 0
            ? 'done'
            : index <= 2
              ? 'done'
              : index === 3
                ? 'active'
                : 'pending') as 'pending' | 'active' | 'done',
    }));

    return {
      available: true,
      meta: {
        cycleStatus: cycle?.status ?? 'NOT_STARTED',
        intakeStatus: intake[0]?.status ?? null,
        lastUpdatedAt: candidates[0]?.updatedAt ?? null,
      },
      metrics: {
        totalCandidates: candidates.length,
        newToday,
        underQualification,
        passed,
        rejected,
        escalated,
        awaitingEvidence,
        aiConfidence: avg(
          candidates
            .filter((item) => item.measuredConfidence)
            .map((item) => item.confidence),
        ),
        averageQualificationTimeMs: avg(durations),
        commercialScore: avg(
          candidates
            .map((item) => item.commercialValue)
            .filter((value): value is number => value != null),
        ),
        productionReadiness: avg(
          candidates
            .map((item) => item.productionReadiness)
            .filter((value): value is number => value != null),
        ),
        strategyAlignment: avg(
          candidates
            .map((item) => item.strategyFit)
            .filter((value): value is number => value != null),
        ),
        audienceMatch: avg(
          candidates
            .map((item) => item.audienceValue)
            .filter((value): value is number => value != null),
        ),
        duplicateRate: pct(duplicateHits, candidates.length),
        researchReady,
      },
      pipeline,
      candidates,
      recommendations,
      analytics: {
        topicDistribution: [...topicCounts.entries()]
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 12),
        statusDistribution: [...statusCounts.entries()]
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count),
        confidenceBuckets,
      },
      notifications,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    return {
      available: false,
      reason:
        error instanceof Error
          ? error.message.replace(/password|secret|token/gi, '[redacted]')
          : 'Candidate Pool unavailable',
      meta: {
        cycleStatus: 'UNAVAILABLE',
        intakeStatus: null,
        lastUpdatedAt: null,
      },
      metrics: {
        totalCandidates: 0,
        newToday: 0,
        underQualification: 0,
        passed: 0,
        rejected: 0,
        escalated: 0,
        awaitingEvidence: 0,
        aiConfidence: null,
        averageQualificationTimeMs: null,
        commercialScore: null,
        productionReadiness: null,
        strategyAlignment: null,
        audienceMatch: null,
        duplicateRate: null,
        researchReady: 0,
      },
      pipeline: [],
      candidates: [],
      recommendations: [],
      analytics: {
        topicDistribution: [],
        statusDistribution: [],
        confidenceBuckets: [],
      },
      notifications: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
