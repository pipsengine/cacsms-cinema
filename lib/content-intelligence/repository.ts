import { prisma } from '@/lib/db';
import type {
  IntelligenceAuditEvent,
  IntelligenceOverview,
  IntelligencePipelineStage,
  Opportunity,
  OpportunityStatus,
} from './contracts';

type PackageRow = {
  strategy_version_id: string;
  version_number: number;
  checksum: string;
  status: string;
};

type RunRow = {
  id: string;
  status: string;
  started_at: Date | null;
  completed_at: Date | null;
  failure_reason: string | null;
};

type CountRow = { status: string; count: number | bigint };
type BlockerRow = { id: string; severity: string; message: string };
type ScalarCount = { total: number | bigint };
type ConfidenceRow = { avgConfidence: number | string | null; measured: number | bigint };
type AuditRow = {
  id: string;
  action: string;
  actorType: string;
  createdAt: Date;
  reason: string | null;
};

const PIPELINE_STAGES: Array<{ stage: string; label: string }> = [
  { stage: 'sources', label: 'Sources' },
  { stage: 'signals', label: 'Signals' },
  { stage: 'candidates', label: 'Candidates' },
  { stage: 'verification', label: 'Verification' },
  { stage: 'duplicates', label: 'Duplicates' },
  { stage: 'scoring', label: 'Scoring' },
  { stage: 'ranking', label: 'Ranking' },
  { stage: 'handoff', label: 'Handoff' },
];

function pipelineStatus(count: number, runStatus?: string): string {
  if (count > 0) {
    if (runStatus === 'COMPLETED') return 'COMPLETED';
    if (runStatus === 'RUNNING' || runStatus === 'QUEUED') return 'RUNNING';
    if (runStatus === 'FAILED' || runStatus === 'BLOCKED') return 'FAILED';
    if (runStatus === 'PARTIAL') return 'PARTIAL';
    return 'READY';
  }
  if (runStatus === 'RUNNING' || runStatus === 'QUEUED') return 'WAITING';
  if (runStatus === 'FAILED') return 'FAILED';
  if (runStatus === 'CANCELLED') return 'CANCELLED';
  return 'NOT_STARTED';
}

export class IntelligenceRepository {
  async overview(): Promise<IntelligenceOverview> {
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

      const runs = await prisma.$queryRaw<RunRow[]>`
        SELECT TOP 1
          CONVERT(varchar(36), id) AS id,
          status,
          started_at,
          completed_at,
          failure_reason
        FROM ci_discovery_runs
        ORDER BY created_at DESC
      `;

      const statusCounts = await prisma.$queryRaw<CountRow[]>`
        SELECT status, COUNT(*) AS count
        FROM ci_opportunities
        GROUP BY status
      `;

      const blockers = await prisma.$queryRaw<BlockerRow[]>`
        SELECT TOP 20
          CONVERT(varchar(36), id) AS id,
          severity,
          message
        FROM ci_blockers
        WHERE resolved_at IS NULL
        ORDER BY created_at DESC
      `;

      const sourceRows = await prisma.$queryRaw<ScalarCount[]>`
        SELECT COUNT(*) AS total FROM ci_sources
      `;
      const signalRows = await prisma.$queryRaw<ScalarCount[]>`
        SELECT COUNT(*) AS total FROM ci_signals
      `;
      const opportunityCountRows = await prisma.$queryRaw<ScalarCount[]>`
        SELECT COUNT(*) AS total FROM ci_opportunities
      `;
      const verificationRows = await prisma.$queryRaw<ScalarCount[]>`
        SELECT COUNT(*) AS total FROM ci_verifications
      `;
      const scoreRows = await prisma.$queryRaw<ScalarCount[]>`
        SELECT COUNT(*) AS total FROM ci_scores
      `;
      const rankingRows = await prisma.$queryRaw<ScalarCount[]>`
        SELECT COUNT(*) AS total FROM ci_rankings
      `;
      const handoffRows = await prisma.$queryRaw<ScalarCount[]>`
        SELECT COUNT(*) AS total FROM ci_handoffs WHERE status = 'ACKNOWLEDGED'
      `;
      const failedJobRows = await prisma.$queryRaw<ScalarCount[]>`
        SELECT COUNT(*) AS total FROM ci_jobs WHERE status = 'FAILED'
      `;
      const auditRows = await prisma.$queryRaw<AuditRow[]>`
        SELECT TOP 12
          CONVERT(varchar(36), id) AS id,
          action,
          actor_type AS actorType,
          created_at AS createdAt,
          reason
        FROM ci_audit_events
        ORDER BY created_at DESC
      `;
      const confidenceRows = await prisma.$queryRaw<ConfidenceRow[]>`
        SELECT
          AVG(CASE WHEN confidence >= 1 THEN confidence ELSE NULL END) AS avgConfidence,
          SUM(CASE WHEN confidence >= 1 THEN 1 ELSE 0 END) AS measured
        FROM ci_opportunities
      `;

      const packageRow = packages[0];
      const run = runs[0];
      const statusMetrics = Object.fromEntries(
        statusCounts.map((row) => [String(row.status).toLowerCase(), Number(row.count)]),
      );

      const stageCounts: Record<string, number> = {
        sources: Number(sourceRows[0]?.total ?? 0),
        signals: Number(signalRows[0]?.total ?? 0),
        candidates: Number(opportunityCountRows[0]?.total ?? 0),
        verification: Number(verificationRows[0]?.total ?? 0),
        duplicates: 0,
        scoring: Number(scoreRows[0]?.total ?? 0),
        ranking: Number(rankingRows[0]?.total ?? 0),
        handoff: Number(handoffRows[0]?.total ?? 0),
      };

      const pipeline: IntelligencePipelineStage[] = PIPELINE_STAGES.map((item) => ({
        stage: item.stage,
        label: item.label,
        status: pipelineStatus(stageCounts[item.stage] ?? 0, run?.status),
        count: stageCounts[item.stage] ?? 0,
      }));

      const stagesWithData = pipeline.filter((item) => item.count > 0).length;
      const readiness = Math.round((stagesWithData / Math.max(1, pipeline.length)) * 100);

      const measuredConfidence = Number(confidenceRows[0]?.measured ?? 0);
      const avgConf =
        measuredConfidence > 0 && confidenceRows[0]?.avgConfidence != null
          ? Math.round(Number(confidenceRows[0].avgConfidence))
          : null;

      const opportunityRows = await this.list(40);

      const audit: IntelligenceAuditEvent[] = auditRows.map((row) => ({
        id: row.id,
        action: row.action,
        actorType: row.actorType,
        createdAt: row.createdAt.toISOString(),
        reason: row.reason,
      }));

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
          ...statusMetrics,
          sources: stageCounts.sources,
          signals: stageCounts.signals,
          candidates: stageCounts.candidates,
          verification: stageCounts.verification,
          scoring: stageCounts.scoring,
          ranking: stageCounts.ranking,
          handoffs: stageCounts.handoff,
          failedJobs: Number(failedJobRows[0]?.total ?? 0),
          openBlockers: blockers.length,
          pipelineHealth: readiness,
          ...(avgConf != null ? { avgConfidence: avgConf } : {}),
          measuredConfidence,
        },
        pipeline,
        opportunities: opportunityRows,
        blockers: blockers.map((row) => ({
          id: row.id,
          severity: row.severity,
          message: row.message,
        })),
        audit,
        readiness,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      return {
        available: false,
        reason:
          error instanceof Error
            ? error.message.replace(/password|secret|token/gi, '[redacted]')
            : 'Content Intelligence tables are unavailable. Run the CI migration.',
      };
    }
  }

  async list(limit = 200): Promise<Opportunity[]> {
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
        created_at AS createdAt
      FROM ci_opportunities
      ORDER BY score DESC, created_at DESC
    `;

    return rows.slice(0, Math.max(1, Math.min(200, limit))).map((row) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      status: row.status as OpportunityStatus,
      domain: row.domain,
      geography: row.geography ?? undefined,
      audience: row.audience ?? undefined,
      score: Number(row.score),
      confidence: Number(row.confidence),
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
