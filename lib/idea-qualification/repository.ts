import { prisma } from '@/lib/db';
import type {
  Candidate,
  FactorScores,
  FunnelStage,
  QualificationCandidateCard,
  QualificationOverview,
  QualificationStatus,
  RadarDimension,
} from './contracts';

type IntakeRow = {
  id: string;
  source_run_id: string;
  strategy_version_id: string;
  checksum: string;
  status: string;
  received_at: Date;
};

type CycleRow = {
  id: string;
  status: string;
  started_at: Date | null;
  completed_at: Date | null;
  failure_reason: string | null;
};

type CountRow = { status: string; count: number | bigint };
type BlockerRow = {
  id: string;
  severity: string;
  message: string;
  recommendation: string | null;
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

function nextActionFor(status: string, gateStatus: string, decision: string | null): string {
  if (decision === 'QUALIFY' || status === 'QUALIFIED' || status === 'SELECTED') return 'Proceed to Research';
  if (decision === 'REJECT' || status === 'REJECTED') return 'Archive / reject';
  if (decision === 'BLOCK' || status === 'BLOCKED' || gateStatus === 'FAILED') return 'Resolve blockers';
  if (decision === 'REASSESS') return 'Re-score';
  if (status === 'HANDED_OFF') return 'Monitor handoff';
  if (status === 'EVALUATING' || status === 'NORMALISING') return 'Await autonomous evaluation';
  return 'Under review';
}

function emptyOverview(reason?: string): QualificationOverview {
  return {
    available: !reason,
    reason,
    kpi: {
      ideasReceived: 0,
      ideasPassed: 0,
      ideasRejected: 0,
      underReview: 0,
      aiConfidence: null,
      evidenceSufficiency: null,
      strategyAlignment: null,
      originalityScore: null,
      commercialPotential: null,
      productionCost: null,
      estimatedRoi: null,
      audienceDemand: null,
      riskScore: null,
      feasibilityScore: null,
      approvalRate: null,
      averageQualificationTimeMs: null,
    },
    engine: {
      status: 'IDLE',
      currentModel: null,
      reasoningEngine: 'Qualification factor gates',
      confidence: null,
      knowledgeSources: 0,
      policyVersion: null,
      strategyVersion: null,
      promptVersion: null,
      learningVersion: null,
    },
    funnel: [],
    candidates: [],
    radar: [],
    risks: [],
    evidenceCoverage: {
      totalChecks: 0,
      passed: 0,
      failed: 0,
      blocking: 0,
      coveragePct: null,
    },
    duplicates: {
      checks: 0,
      blocking: 0,
      avgSimilarity: null,
      maxSimilarity: null,
    },
    recommendations: [],
    timeline: [],
    decisions: [],
    audit: [],
    governance: {
      auditEvents: 0,
      decisions: 0,
      digitalSignatures: 0,
      immutableRecords: 0,
      policyVersion: null,
    },
    metrics: {},
    pipeline: [],
    blockers: [],
    lastUpdated: new Date().toISOString(),
  };
}

export class QualificationRepository {
  async overview(): Promise<QualificationOverview> {
    try {
      const intakes = await prisma.$queryRaw<IntakeRow[]>`
        SELECT TOP 1
          CONVERT(varchar(36), id) AS id,
          CONVERT(varchar(36), source_run_id) AS source_run_id,
          CONVERT(varchar(36), strategy_version_id) AS strategy_version_id,
          checksum,
          status,
          received_at
        FROM iq_intake_packages
        WHERE status = 'ACKNOWLEDGED'
        ORDER BY acknowledged_at DESC
      `;

      const cycles = await prisma.$queryRaw<CycleRow[]>`
        SELECT TOP 1
          CONVERT(varchar(36), id) AS id,
          status,
          started_at,
          completed_at,
          failure_reason
        FROM iq_cycles
        ORDER BY created_at DESC
      `;

      const counts = await prisma.$queryRaw<CountRow[]>`
        SELECT status, COUNT(*) AS count
        FROM iq_candidates
        GROUP BY status
      `;

      const blockers = await prisma.$queryRaw<BlockerRow[]>`
        SELECT TOP 20
          CONVERT(varchar(36), id) AS id,
          severity,
          message,
          recommendation
        FROM iq_blockers
        WHERE resolved_at IS NULL
        ORDER BY created_at DESC
      `;

      const candidateRows = await prisma.$queryRaw<
        Array<{
          id: string;
          title: string;
          summary: string;
          domain: string;
          geography: string | null;
          audience: string | null;
          status: string;
          score: number | string;
          confidence: number | string;
          gateStatus: string;
          decision: string | null;
          decisionReason: string | null;
          createdAt: Date;
          updatedAt: Date;
          scoreId: string | null;
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
        }>
      >`
        SELECT TOP 50
          CONVERT(varchar(36), c.id) AS id,
          c.title,
          c.summary,
          c.domain,
          c.geography,
          c.audience,
          c.status,
          c.score,
          c.confidence,
          c.gate_status AS gateStatus,
          c.decision,
          c.decision_reason AS decisionReason,
          c.created_at AS createdAt,
          c.updated_at AS updatedAt,
          CONVERT(varchar(36), s.id) AS scoreId,
          s.total_score AS totalScore,
          s.confidence AS scoreConfidence,
          s.factors_json AS factorsJson,
          s.explanation,
          s.model_version AS modelVersion,
          r.rank_position AS rankPosition,
          (
            SELECT COUNT(*) FROM iq_evidence_checks e
            WHERE e.candidate_id = c.id AND e.status IN ('PASSED', 'PASS', 'OK')
          ) AS evidencePassed,
          (
            SELECT COUNT(*) FROM iq_evidence_checks e
            WHERE e.candidate_id = c.id AND e.status IN ('FAILED', 'FAIL', 'REJECTED')
          ) AS evidenceFailed,
          (
            SELECT MAX(similarity) FROM iq_duplicate_checks d WHERE d.candidate_id = c.id
          ) AS maxDuplicateSimilarity,
          (
            SELECT AVG(CAST(risk_score AS float)) FROM iq_risk_assessments rk
            WHERE rk.candidate_id = c.id
          ) AS avgRiskScore
        FROM iq_candidates c
        OUTER APPLY (
          SELECT TOP 1 *
          FROM iq_scores sc
          WHERE sc.candidate_id = c.id
          ORDER BY sc.scored_at DESC
        ) s
        LEFT JOIN iq_rankings r ON r.candidate_id = c.id
        ORDER BY
          CASE WHEN c.status IN ('QUALIFIED','SELECTED','HANDED_OFF') THEN 0
               WHEN c.status IN ('EVALUATING','NORMALISING','RECEIVED') THEN 1
               ELSE 2 END,
          COALESCE(s.total_score, c.score) DESC,
          c.created_at DESC
      `;

      const evidenceAgg = await prisma.$queryRaw<
        Array<{
          totalChecks: number | bigint;
          passed: number | bigint;
          failed: number | bigint;
          blocking: number | bigint;
        }>
      >`
        SELECT
          COUNT(*) AS totalChecks,
          SUM(CASE WHEN status IN ('PASSED','PASS','OK') THEN 1 ELSE 0 END) AS passed,
          SUM(CASE WHEN status IN ('FAILED','FAIL','REJECTED') THEN 1 ELSE 0 END) AS failed,
          SUM(CASE WHEN blocking = 1 THEN 1 ELSE 0 END) AS blocking
        FROM iq_evidence_checks
      `;

      const duplicateAgg = await prisma.$queryRaw<
        Array<{
          checks: number | bigint;
          blocking: number | bigint;
          avgSimilarity: number | string | null;
          maxSimilarity: number | string | null;
        }>
      >`
        SELECT
          COUNT(*) AS checks,
          SUM(CASE WHEN blocking = 1 THEN 1 ELSE 0 END) AS blocking,
          AVG(CAST(similarity AS float)) AS avgSimilarity,
          MAX(similarity) AS maxSimilarity
        FROM iq_duplicate_checks
      `;

      const riskRows = await prisma.$queryRaw<
        Array<{
          category: string;
          count: number | bigint;
          avgScore: number | string | null;
          maxSeverity: string | null;
        }>
      >`
        SELECT TOP 20
          category,
          COUNT(*) AS count,
          AVG(CAST(risk_score AS float)) AS avgScore,
          MAX(severity) AS maxSeverity
        FROM iq_risk_assessments
        GROUP BY category
        ORDER BY AVG(CAST(risk_score AS float)) DESC
      `;

      const decisionRows = await prisma.$queryRaw<
        Array<{
          id: string;
          candidateId: string;
          title: string;
          decision: string;
          reason: string;
          source: string;
          createdAt: Date;
        }>
      >`
        SELECT TOP 24
          CONVERT(varchar(36), d.id) AS id,
          CONVERT(varchar(36), d.candidate_id) AS candidateId,
          c.title,
          d.decision,
          d.reason,
          d.decision_source AS source,
          d.created_at AS createdAt
        FROM iq_decisions d
        INNER JOIN iq_candidates c ON c.id = d.candidate_id
        ORDER BY d.created_at DESC
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
        FROM iq_audit_events
        ORDER BY created_at DESC
      `;

      const stageCounts = await prisma.$queryRaw<
        Array<{
          evidenceCandidates: number | bigint;
          scoredCandidates: number | bigint;
          duplicateCandidates: number | bigint;
          riskCandidates: number | bigint;
          gatedCandidates: number | bigint;
          rankedCandidates: number | bigint;
          decidedCandidates: number | bigint;
          handedOff: number | bigint;
          avgCycleMs: number | string | null;
          avgConfidence: number | string | null;
          modelVersions: number | bigint;
          knowledgeSources: number | bigint;
        }>
      >`
        SELECT
          (SELECT COUNT(DISTINCT candidate_id) FROM iq_evidence_checks) AS evidenceCandidates,
          (SELECT COUNT(DISTINCT candidate_id) FROM iq_scores) AS scoredCandidates,
          (SELECT COUNT(DISTINCT candidate_id) FROM iq_duplicate_checks) AS duplicateCandidates,
          (SELECT COUNT(DISTINCT candidate_id) FROM iq_risk_assessments) AS riskCandidates,
          (SELECT COUNT(DISTINCT candidate_id) FROM iq_gate_results) AS gatedCandidates,
          (SELECT COUNT(*) FROM iq_rankings) AS rankedCandidates,
          (SELECT COUNT(DISTINCT candidate_id) FROM iq_decisions) AS decidedCandidates,
          (SELECT COUNT(*) FROM iq_candidates WHERE status = 'HANDED_OFF') AS handedOff,
          (
            SELECT AVG(CAST(DATEDIFF(millisecond, created_at, updated_at) AS float))
            FROM iq_candidates
            WHERE status IN ('QUALIFIED','REJECTED','SELECTED','HANDED_OFF','BLOCKED')
          ) AS avgCycleMs,
          (SELECT AVG(CAST(confidence AS float)) FROM iq_candidates WHERE confidence > 0) AS avgConfidence,
          (SELECT COUNT(DISTINCT model_version) FROM iq_scores) AS modelVersions,
          (SELECT COUNT(*) FROM iq_evidence_checks) AS knowledgeSources
      `;

      const intake = intakes[0];
      const cycle = cycles[0];
      const statusCounts = Object.fromEntries(
        counts.map((row) => [String(row.status).toUpperCase(), Number(row.count)]),
      ) as Record<string, number>;

      const received =
        (statusCounts.RECEIVED ?? 0) +
        (statusCounts.NORMALISING ?? 0) +
        (statusCounts.EVALUATING ?? 0) +
        (statusCounts.QUALIFIED ?? 0) +
        (statusCounts.REJECTED ?? 0) +
        (statusCounts.BLOCKED ?? 0) +
        (statusCounts.SELECTED ?? 0) +
        (statusCounts.HANDED_OFF ?? 0) +
        (statusCounts.ARCHIVED ?? 0);
      const passed =
        (statusCounts.QUALIFIED ?? 0) +
        (statusCounts.SELECTED ?? 0) +
        (statusCounts.HANDED_OFF ?? 0);
      const rejected = statusCounts.REJECTED ?? 0;
      const underReview =
        (statusCounts.RECEIVED ?? 0) +
        (statusCounts.NORMALISING ?? 0) +
        (statusCounts.EVALUATING ?? 0) +
        (statusCounts.BLOCKED ?? 0);

      const candidates: QualificationCandidateCard[] = candidateRows.map((row) => {
        const score = num(row.totalScore) ?? num(row.score) ?? 0;
        const confidence = num(row.scoreConfidence) ?? num(row.confidence) ?? 0;
        const factors = parseFactors(row.factorsJson);
        return {
          id: row.id,
          title: row.title,
          summary: row.summary,
          domain: row.domain,
          geography: row.geography,
          audience: row.audience,
          status: row.status as QualificationStatus,
          score,
          measuredScore: score > 0,
          confidence,
          measuredConfidence: confidence >= 1,
          gateStatus: row.gateStatus,
          decision: row.decision,
          decisionReason: row.decisionReason,
          rankPosition: row.rankPosition != null ? Number(row.rankPosition) : null,
          evidencePassed: Number(row.evidencePassed ?? 0),
          evidenceFailed: Number(row.evidenceFailed ?? 0),
          maxDuplicateSimilarity: num(row.maxDuplicateSimilarity),
          riskScore: num(row.avgRiskScore),
          factors,
          explanation: row.explanation,
          modelVersion: row.modelVersion,
          nextAction: nextActionFor(row.status, row.gateStatus, row.decision),
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        };
      });

      const factorBuckets: Record<string, number[]> = {};
      for (const candidate of candidates) {
        if (!candidate.factors) continue;
        for (const [key, value] of Object.entries(candidate.factors)) {
          if (value == null) continue;
          (factorBuckets[key] ??= []).push(value);
        }
      }

      const radar: RadarDimension[] = [
        { key: 'strategicFit', label: 'Strategic Fit', value: avg(factorBuckets.strategicFit ?? []) },
        { key: 'originality', label: 'Originality', value: avg(factorBuckets.originality ?? []) },
        {
          key: 'commercial',
          label: 'Commercial Value',
          value: avg(factorBuckets.audienceValue ?? []),
        },
        {
          key: 'educational',
          label: 'Educational Value',
          value: avg(factorBuckets.educationalValue ?? []),
        },
        {
          key: 'global',
          label: 'Global Appeal',
          value: avg(factorBuckets.regionalRelevance ?? []),
        },
        { key: 'evidence', label: 'Evidence Quality', value: avg(factorBuckets.evidence ?? []) },
        {
          key: 'productionCost',
          label: 'Production Cost',
          value: null,
        },
        {
          key: 'audience',
          label: 'Audience Demand',
          value: avg(factorBuckets.audienceValue ?? []),
        },
        {
          key: 'safety',
          label: 'Safety',
          value:
            avg(factorBuckets.risk ?? []) != null
              ? Math.max(0, 100 - (avg(factorBuckets.risk ?? []) ?? 0))
              : null,
        },
        {
          key: 'evergreen',
          label: 'Evergreen Value',
          value: avg(factorBuckets.timeliness ?? []),
        },
        {
          key: 'visual',
          label: 'Visual Potential',
          value: avg(factorBuckets.visualPotential ?? []),
        },
        {
          key: 'story',
          label: 'Storytelling Potential',
          value: avg(factorBuckets.educationalValue ?? []),
        },
      ];

      const stages = stageCounts[0];
      const evidenceCandidates = Number(stages?.evidenceCandidates ?? 0);
      const scoredCandidates = Number(stages?.scoredCandidates ?? 0);
      const duplicateCandidates = Number(stages?.duplicateCandidates ?? 0);
      const riskCandidates = Number(stages?.riskCandidates ?? 0);
      const gatedCandidates = Number(stages?.gatedCandidates ?? 0);
      const rankedCandidates = Number(stages?.rankedCandidates ?? 0);
      const decidedCandidates = Number(stages?.decidedCandidates ?? 0);
      const handedOff = Number(stages?.handedOff ?? 0);
      const avgConfidence = num(stages?.avgConfidence);
      const avgCycleMs = num(stages?.avgCycleMs);

      const cycleStatus = cycle?.status ?? 'NOT_STARTED';
      const funnelDefs: Array<{
        key: string;
        label: string;
        records: number;
        failures?: number;
      }> = [
        { key: 'incoming', label: 'Incoming Ideas', records: received },
        {
          key: 'normalisation',
          label: 'Normalization',
          records:
            received - (statusCounts.RECEIVED ?? 0) > 0
              ? received - (statusCounts.RECEIVED ?? 0)
              : statusCounts.NORMALISING ?? 0,
        },
        { key: 'evidence', label: 'Evidence Validation', records: evidenceCandidates },
        {
          key: 'strategy',
          label: 'Strategy Alignment',
          records: scoredCandidates,
        },
        {
          key: 'audience',
          label: 'Audience Demand',
          records: scoredCandidates,
        },
        {
          key: 'originality',
          label: 'Originality',
          records: Math.max(scoredCandidates, duplicateCandidates),
        },
        {
          key: 'feasibility',
          label: 'Production Feasibility',
          records: scoredCandidates,
        },
        {
          key: 'commercial',
          label: 'Commercial Value',
          records: scoredCandidates,
        },
        {
          key: 'risk',
          label: 'Risk Assessment',
          records: riskCandidates,
          failures: blockers.length,
        },
        {
          key: 'ranking',
          label: 'Ranking',
          records: rankedCandidates,
        },
        {
          key: 'approved',
          label: 'Approved',
          records: passed,
          failures: rejected,
        },
      ];

      const funnel: FunnelStage[] = funnelDefs.map((stage, index) => {
        let state: FunnelStage['state'] = 'pending';
        if (stage.records > 0) state = 'done';
        else if (cycleStatus === 'RUNNING' && index === 0) state = 'active';
        else if (cycleStatus === 'FAILED' && index === 0) state = 'failed';
        const successRate =
          stage.records > 0 && stage.failures != null
            ? pct(Math.max(0, stage.records - stage.failures), stage.records)
            : stage.records > 0
              ? 100
              : null;
        return {
          key: stage.key,
          label: stage.label,
          records: stage.records,
          durationMs: null,
          confidence: stage.records > 0 ? avgConfidence : null,
          failures: stage.failures ?? 0,
          successRate,
          state,
        };
      });

      const evidence = evidenceAgg[0];
      const evidenceTotal = Number(evidence?.totalChecks ?? 0);
      const evidencePassed = Number(evidence?.passed ?? 0);
      const evidenceFailed = Number(evidence?.failed ?? 0);
      const evidenceBlocking = Number(evidence?.blocking ?? 0);

      const dup = duplicateAgg[0];
      const dupChecks = Number(dup?.checks ?? 0);

      const aiConfidence = avgConfidence ?? avg(candidates.map((c) => c.confidence).filter((v) => v >= 1));
      const evidenceSufficiency =
        evidenceTotal > 0 ? pct(evidencePassed, evidenceTotal) : avg(factorBuckets.evidence ?? []);
      const strategyAlignment = avg(factorBuckets.strategicFit ?? []);
      const originalityScore = avg(factorBuckets.originality ?? []);
      const audienceDemand = avg(factorBuckets.audienceValue ?? []);
      const feasibilityScore = avg(factorBuckets.feasibility ?? []);
      const riskScore =
        avg(riskRows.map((row) => num(row.avgScore)).filter((v): v is number => v != null)) ??
        avg(factorBuckets.risk ?? []);

      const modelVersions = candidateRows
        .map((row) => row.modelVersion)
        .filter((value): value is string => Boolean(value));
      const uniqueModels = [...new Set(modelVersions)];

      const recommendations: QualificationOverview['recommendations'] = [];
      for (const candidate of candidates.slice(0, 8)) {
        if (candidate.status === 'QUALIFIED' || candidate.decision === 'QUALIFY') {
          recommendations.push({
            id: `proceed-${candidate.id}`,
            action: 'Proceed',
            reason: `${candidate.title} passed gates with score ${candidate.score}`,
            priority: 'HIGH',
            candidateId: candidate.id,
          });
        } else if (candidate.evidenceFailed > candidate.evidencePassed && candidate.evidenceFailed > 0) {
          recommendations.push({
            id: `evidence-${candidate.id}`,
            action: 'Needs Evidence',
            reason: `${candidate.title} has ${candidate.evidenceFailed} failed evidence checks`,
            priority: 'HIGH',
            candidateId: candidate.id,
          });
        } else if ((candidate.maxDuplicateSimilarity ?? 0) >= 65) {
          recommendations.push({
            id: `merge-${candidate.id}`,
            action: 'Merge',
            reason: `${candidate.title} similarity ${candidate.maxDuplicateSimilarity}%`,
            priority: 'MEDIUM',
            candidateId: candidate.id,
          });
        } else if (candidate.status === 'BLOCKED' || candidate.decision === 'BLOCK') {
          recommendations.push({
            id: `delay-${candidate.id}`,
            action: 'Delay',
            reason: candidate.decisionReason ?? `${candidate.title} is blocked`,
            priority: 'MEDIUM',
            candidateId: candidate.id,
          });
        } else if (candidate.status === 'REJECTED') {
          recommendations.push({
            id: `reject-${candidate.id}`,
            action: 'Reject',
            reason: candidate.decisionReason ?? `${candidate.title} rejected`,
            priority: 'LOW',
            candidateId: candidate.id,
          });
        } else if (candidate.status === 'EVALUATING' || candidate.status === 'RECEIVED') {
          recommendations.push({
            id: `research-${candidate.id}`,
            action: 'Needs Research',
            reason: `${candidate.title} still in ${candidate.status}`,
            priority: 'MEDIUM',
            candidateId: candidate.id,
          });
        }
      }
      if (!recommendations.length && intake) {
        recommendations.push({
          id: 'await-cycle',
          action: 'Await processing',
          reason: 'Intake acknowledged — waiting for autonomous qualification cycle records',
          priority: 'LOW',
        });
      }

      const timeline: QualificationOverview['timeline'] = [
        {
          key: 'intake',
          label: 'Idea Created / Intake',
          at: intake?.received_at.toISOString() ?? null,
          count: received,
          done: Boolean(intake) || received > 0,
        },
        {
          key: 'evidence',
          label: 'Evidence Verified',
          at: null,
          count: evidenceCandidates,
          done: evidenceCandidates > 0,
        },
        {
          key: 'strategy',
          label: 'Strategy Matched',
          at: null,
          count: scoredCandidates,
          done: scoredCandidates > 0,
        },
        {
          key: 'scored',
          label: 'Scored',
          at: null,
          count: scoredCandidates,
          done: scoredCandidates > 0,
        },
        {
          key: 'approved',
          label: 'Approved',
          at: null,
          count: passed,
          done: passed > 0,
        },
        {
          key: 'rejected',
          label: 'Rejected',
          at: null,
          count: rejected,
          done: rejected > 0,
        },
        {
          key: 'escalated',
          label: 'Escalated / Blocked',
          at: null,
          count: statusCounts.BLOCKED ?? 0,
          done: (statusCounts.BLOCKED ?? 0) > 0,
        },
        {
          key: 'research',
          label: 'Sent to Research',
          at: null,
          count: handedOff,
          done: handedOff > 0,
        },
      ];

      const metrics = Object.fromEntries(
        counts.map((row) => [String(row.status).toLowerCase(), Number(row.count)]),
      );

      const legacyPipeline = [
        'intake',
        'normalisation',
        'evidence',
        'duplicates',
        'scoring',
        'gates',
        'ranking',
        'decision',
        'handoff',
      ].map((stage) => {
        const funnelMatch = funnel.find((item) => item.key.startsWith(stage.slice(0, 5)) || item.key === stage);
        return {
          stage,
          status: cycleStatus,
          count: funnelMatch?.records ?? 0,
        };
      });

      return {
        available: true,
        intake: intake
          ? {
              packageId: intake.id,
              runId: intake.source_run_id,
              checksum: intake.checksum,
              status: intake.status,
              receivedAt: intake.received_at.toISOString(),
              strategyVersionId: intake.strategy_version_id,
            }
          : undefined,
        cycle: cycle
          ? {
              id: cycle.id,
              status: cycle.status,
              startedAt: cycle.started_at?.toISOString() ?? new Date(0).toISOString(),
              completedAt: cycle.completed_at?.toISOString() ?? null,
              failureReason: cycle.failure_reason,
            }
          : undefined,
        metrics,
        pipeline: legacyPipeline,
        blockers: blockers.map((row) => ({
          id: row.id,
          severity: row.severity,
          message: row.message,
          recommendation: row.recommendation,
        })),
        kpi: {
          ideasReceived: received,
          ideasPassed: passed,
          ideasRejected: rejected,
          underReview,
          aiConfidence,
          evidenceSufficiency,
          strategyAlignment,
          originalityScore,
          commercialPotential: audienceDemand,
          productionCost: null,
          estimatedRoi: null,
          audienceDemand,
          riskScore,
          feasibilityScore,
          approvalRate: pct(passed, received),
          averageQualificationTimeMs: avgCycleMs != null ? Math.round(avgCycleMs) : null,
        },
        engine: {
          status: cycleStatus === 'RUNNING' ? 'RUNNING' : intake ? 'READY' : 'IDLE',
          currentModel: uniqueModels[0] ?? null,
          reasoningEngine: 'Factor-weighted gates + portfolio ranking',
          confidence: aiConfidence,
          knowledgeSources: Number(stages?.knowledgeSources ?? 0),
          policyVersion: decisionRows[0] ? 'gate-defaults-v1' : null,
          strategyVersion: intake?.strategy_version_id?.slice(0, 8) ?? null,
          promptVersion: null,
          learningVersion: null,
        },
        funnel,
        candidates,
        radar,
        risks: riskRows.map((row) => ({
          category: row.category,
          count: Number(row.count),
          avgScore: num(row.avgScore) != null ? Math.round(num(row.avgScore)!) : null,
          maxSeverity: row.maxSeverity,
        })),
        evidenceCoverage: {
          totalChecks: evidenceTotal,
          passed: evidencePassed,
          failed: evidenceFailed,
          blocking: evidenceBlocking,
          coveragePct: pct(evidencePassed, Math.max(evidenceTotal, 1)),
        },
        duplicates: {
          checks: dupChecks,
          blocking: Number(dup?.blocking ?? 0),
          avgSimilarity: num(dup?.avgSimilarity) != null ? Math.round(num(dup!.avgSimilarity!)!) : null,
          maxSimilarity: num(dup?.maxSimilarity) != null ? Math.round(num(dup!.maxSimilarity!)!) : null,
        },
        recommendations,
        timeline,
        decisions: decisionRows.map((row) => ({
          id: row.id,
          candidateId: row.candidateId,
          title: row.title,
          decision: row.decision,
          reason: row.reason,
          source: row.source,
          createdAt: row.createdAt.toISOString(),
        })),
        audit: auditRows.map((row) => ({
          id: row.id,
          action: row.action,
          actorType: row.actorType,
          createdAt: row.createdAt.toISOString(),
          reason: row.reason,
        })),
        governance: {
          auditEvents: auditRows.length,
          decisions: decisionRows.length,
          digitalSignatures: intake ? 1 : 0,
          immutableRecords: auditRows.length + decisionRows.length,
          policyVersion: decisionRows[0] ? 'gate-defaults-v1' : null,
        },
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      const shell = emptyOverview(
        error instanceof Error
          ? error.message.replace(/password|secret|token/gi, '[redacted]')
          : 'Idea Qualification tables are unavailable. Run the IQ migration.',
      );
      shell.available = false;
      return shell;
    }
  }

  async list(): Promise<Candidate[]> {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        summary: string;
        status: string;
        domain: string;
        geography: string | null;
        audience: string | null;
        score: number | string;
        confidence: number | string;
        gateStatus: string;
        decision: string | null;
        createdAt: Date;
      }>
    >`
      SELECT TOP 200
        CONVERT(varchar(36), id) AS id,
        title,
        summary,
        status,
        domain,
        geography,
        audience,
        score,
        confidence,
        gate_status AS gateStatus,
        decision,
        created_at AS createdAt
      FROM iq_candidates
      ORDER BY created_at DESC
    `;

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      status: row.status as QualificationStatus,
      domain: row.domain,
      geography: row.geography ?? undefined,
      audience: row.audience ?? undefined,
      score: Number(row.score),
      confidence: Number(row.confidence),
      gateStatus: row.gateStatus,
      decision: row.decision ?? undefined,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
