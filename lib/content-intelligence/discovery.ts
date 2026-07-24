import { prisma } from '@/lib/db';

export type DiscoveryJob = {
  id: string;
  jobType: string;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DiscoveryRun = {
  id: string;
  status: string;
  idempotencyKey: string;
  trigger: string;
  strategyVersionId: string | null;
  strategyVersionNumber: number | null;
  strategyChecksum: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  failureReason: string | null;
  executionMs: number | null;
  sourcesScanned: number;
  signalsCollected: number;
  verifiedEvidence: number;
  opportunities: number;
  duplicatesFlagged: number;
  handoffs: number;
  failedJobs: number;
  activeJobs: number;
  avgConfidence: number | null;
  measuredConfidence: number;
  jobs: DiscoveryJob[];
};

export type DiscoveryIssue = {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  code: string;
  message: string;
  runId?: string;
};

export type DiscoveryRunsOverview = {
  available: boolean;
  reason?: string;
  strategy?: {
    versionId: string;
    versionNumber: number;
    checksum: string;
    status: string;
  };
  metrics: {
    discoveryRuns: number;
    activeJobs: number;
    sourcesScanned: number;
    evidenceCollected: number;
    measuredConfidence: number;
    avgConfidence: number | null;
    pipelineHealth: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
    partial: number;
    registeredSources: number;
  };
  runs: DiscoveryRun[];
  issues: DiscoveryIssue[];
  audit: Array<{
    id: string;
    action: string;
    actorType: string;
    createdAt: string;
    reason: string | null;
    runId: string | null;
  }>;
  lastUpdated: string;
};

type PackageRow = {
  strategy_version_id: string;
  version_number: number;
  checksum: string;
  status: string;
};

type RunRow = {
  id: string;
  status: string;
  idempotencyKey: string;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  failureReason: string | null;
  strategyVersionId: string | null;
  strategyVersionNumber: number | string | null;
  strategyChecksum: string | null;
  sourcesScanned: number | bigint;
  signalsCollected: number | bigint;
  verifiedEvidence: number | bigint;
  opportunities: number | bigint;
  duplicatesFlagged: number | bigint;
  handoffs: number | bigint;
  failedJobs: number | bigint;
  activeJobs: number | bigint;
  avgConfidence: number | string | null;
  measuredConfidence: number | bigint;
};

type JobRow = {
  id: string;
  runId: string | null;
  jobType: string;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  lastError: string | null;
  nextAttemptAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function executionMs(startedAt: Date | null, completedAt: Date | null): number | null {
  if (!startedAt) return null;
  const end = completedAt ?? new Date();
  const ms = end.getTime() - startedAt.getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

function triggerFromKey(key: string): string {
  if (key.includes('-ci')) return 'Autonomous lifecycle';
  if (key.startsWith('manual') || key.includes('manual')) return 'Manual request';
  return 'System scheduled';
}

function deriveIssues(runs: DiscoveryRun[], registeredSources: number): DiscoveryIssue[] {
  const issues: DiscoveryIssue[] = [];

  if (registeredSources === 0) {
    issues.push({
      id: 'no-sources',
      severity: 'WARNING',
      code: 'NO_SOURCES',
      message: 'No registered sources available for discovery scanning.',
    });
  }

  for (const run of runs) {
    if (run.status === 'FAILED' || run.status === 'BLOCKED') {
      issues.push({
        id: `${run.id}-failed`,
        severity: 'CRITICAL',
        code: 'RUN_FAILED',
        message: run.failureReason || `Discovery run ${run.id.slice(0, 8)} is ${run.status}.`,
        runId: run.id,
      });
    }
    if (run.status === 'PARTIAL') {
      issues.push({
        id: `${run.id}-partial`,
        severity: 'WARNING',
        code: 'PARTIAL_RUN',
        message: `Discovery run ${run.id.slice(0, 8)} completed partially.`,
        runId: run.id,
      });
    }
    if (run.failedJobs > 0) {
      issues.push({
        id: `${run.id}-jobs`,
        severity: 'WARNING',
        code: 'FAILED_JOBS',
        message: `${run.failedJobs} failed job(s) on run ${run.id.slice(0, 8)}.`,
        runId: run.id,
      });
    }
    if (
      run.measuredConfidence > 0 &&
      run.avgConfidence != null &&
      run.avgConfidence < 40 &&
      run.signalsCollected > 0
    ) {
      issues.push({
        id: `${run.id}-low-conf`,
        severity: 'WARNING',
        code: 'LOW_CONFIDENCE',
        message: `Low measured confidence (${run.avgConfidence}) on run ${run.id.slice(0, 8)}.`,
        runId: run.id,
      });
    }
    if (run.duplicatesFlagged > 0) {
      issues.push({
        id: `${run.id}-dup`,
        severity: 'INFO',
        code: 'DUPLICATE_EVIDENCE',
        message: `${run.duplicatesFlagged} opportunity(ies) flagged for duplicate similarity.`,
        runId: run.id,
      });
    }
    for (const job of run.jobs) {
      if (job.lastError && (job.status === 'FAILED' || job.attemptCount > 1)) {
        issues.push({
          id: `${job.id}-err`,
          severity: job.status === 'FAILED' ? 'CRITICAL' : 'WARNING',
          code: 'JOB_ERROR',
          message: job.lastError,
          runId: run.id,
        });
      }
    }
  }

  return issues.slice(0, 40);
}

export async function loadDiscoveryRuns(): Promise<DiscoveryRunsOverview> {
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

    const sourceCountRows = await prisma.$queryRaw<Array<{ total: number | bigint }>>`
      SELECT COUNT(*) AS total FROM ci_sources WHERE status <> 'ARCHIVED'
    `;
    const registeredSources = Number(sourceCountRows[0]?.total ?? 0);

    const runRows = await prisma.$queryRaw<RunRow[]>`
      SELECT TOP 80
        CONVERT(varchar(36), r.id) AS id,
        r.status,
        r.idempotency_key AS idempotencyKey,
        r.started_at AS startedAt,
        r.completed_at AS completedAt,
        r.created_at AS createdAt,
        r.failure_reason AS failureReason,
        CONVERT(varchar(36), p.strategy_version_id) AS strategyVersionId,
        p.version_number AS strategyVersionNumber,
        p.checksum AS strategyChecksum,
        (
          SELECT COUNT(DISTINCT sig.source_id)
          FROM ci_signals sig
          WHERE sig.run_id = r.id AND sig.source_id IS NOT NULL
        ) AS sourcesScanned,
        (
          SELECT COUNT(*) FROM ci_signals sig WHERE sig.run_id = r.id
        ) AS signalsCollected,
        (
          SELECT COUNT(*)
          FROM ci_verifications v
          INNER JOIN ci_opportunities o ON o.id = v.opportunity_id
          WHERE o.run_id = r.id AND v.status IN ('PASSED', 'VERIFIED', 'ACCEPTED')
        ) AS verifiedEvidence,
        (
          SELECT COUNT(*) FROM ci_opportunities o WHERE o.run_id = r.id
        ) AS opportunities,
        (
          SELECT COUNT(*)
          FROM ci_opportunities o
          WHERE o.run_id = r.id
            AND o.duplicate_similarity IS NOT NULL
            AND o.duplicate_similarity > 0
        ) AS duplicatesFlagged,
        (
          SELECT COUNT(*)
          FROM ci_handoffs h
          INNER JOIN ci_opportunities o ON o.id = h.opportunity_id
          WHERE o.run_id = r.id
        ) AS handoffs,
        (
          SELECT COUNT(*) FROM ci_jobs j WHERE j.run_id = r.id AND j.status = 'FAILED'
        ) AS failedJobs,
        (
          SELECT COUNT(*)
          FROM ci_jobs j
          WHERE j.run_id = r.id AND j.status IN ('QUEUED', 'RUNNING', 'LEASED', 'PENDING')
        ) AS activeJobs,
        (
          SELECT AVG(CASE WHEN sig.confidence >= 1 THEN sig.confidence ELSE NULL END)
          FROM ci_signals sig
          WHERE sig.run_id = r.id
        ) AS avgConfidence,
        (
          SELECT SUM(CASE WHEN sig.confidence >= 1 THEN 1 ELSE 0 END)
          FROM ci_signals sig
          WHERE sig.run_id = r.id
        ) AS measuredConfidence
      FROM ci_discovery_runs r
      LEFT JOIN ci_strategy_packages p ON p.id = r.strategy_package_id
      ORDER BY r.created_at DESC
    `;

    const jobRows = await prisma.$queryRaw<JobRow[]>`
      SELECT TOP 200
        CONVERT(varchar(36), id) AS id,
        CONVERT(varchar(36), run_id) AS runId,
        job_type AS jobType,
        status,
        attempt_count AS attemptCount,
        max_attempts AS maxAttempts,
        last_error AS lastError,
        next_attempt_at AS nextAttemptAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM ci_jobs
      ORDER BY updated_at DESC
    `;

    const auditRows = await prisma.$queryRaw<
      Array<{
        id: string;
        action: string;
        actorType: string;
        createdAt: Date;
        reason: string | null;
        runId: string | null;
      }>
    >`
      SELECT TOP 30
        CONVERT(varchar(36), id) AS id,
        action,
        actor_type AS actorType,
        created_at AS createdAt,
        reason,
        CONVERT(varchar(36), run_id) AS runId
      FROM ci_audit_events
      WHERE action LIKE 'DISCOVERY%'
         OR action LIKE 'STRATEGY_PACKAGE%'
         OR run_id IS NOT NULL
      ORDER BY created_at DESC
    `;

    const jobsByRun = new Map<string, DiscoveryJob[]>();
    for (const row of jobRows) {
      if (!row.runId) continue;
      const list = jobsByRun.get(row.runId) ?? [];
      list.push({
        id: row.id,
        jobType: row.jobType,
        status: row.status,
        attemptCount: Number(row.attemptCount),
        maxAttempts: Number(row.maxAttempts),
        lastError: row.lastError,
        nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      });
      jobsByRun.set(row.runId, list);
    }

    const runs: DiscoveryRun[] = runRows.map((row) => {
      const measured = Number(row.measuredConfidence ?? 0);
      const avg =
        measured > 0 && row.avgConfidence != null
          ? Math.round(Number(row.avgConfidence))
          : null;
      return {
        id: row.id,
        status: row.status,
        idempotencyKey: row.idempotencyKey,
        trigger: triggerFromKey(row.idempotencyKey),
        strategyVersionId: row.strategyVersionId,
        strategyVersionNumber:
          row.strategyVersionNumber != null ? Number(row.strategyVersionNumber) : null,
        strategyChecksum: row.strategyChecksum,
        startedAt: row.startedAt?.toISOString() ?? null,
        completedAt: row.completedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        failureReason: row.failureReason,
        executionMs: executionMs(row.startedAt, row.completedAt),
        sourcesScanned: Number(row.sourcesScanned ?? 0),
        signalsCollected: Number(row.signalsCollected ?? 0),
        verifiedEvidence: Number(row.verifiedEvidence ?? 0),
        opportunities: Number(row.opportunities ?? 0),
        duplicatesFlagged: Number(row.duplicatesFlagged ?? 0),
        handoffs: Number(row.handoffs ?? 0),
        failedJobs: Number(row.failedJobs ?? 0),
        activeJobs: Number(row.activeJobs ?? 0),
        avgConfidence: avg,
        measuredConfidence: measured,
        jobs: jobsByRun.get(row.id) ?? [],
      };
    });

    const activeJobsGlobal = await prisma.$queryRaw<Array<{ total: number | bigint }>>`
      SELECT COUNT(*) AS total
      FROM ci_jobs
      WHERE status IN ('QUEUED', 'RUNNING', 'LEASED', 'PENDING')
    `;

    const queued = runs.filter((item) => item.status === 'QUEUED').length;
    const running = runs.filter((item) => item.status === 'RUNNING').length;
    const completed = runs.filter((item) => item.status === 'COMPLETED').length;
    const failed = runs.filter(
      (item) => item.status === 'FAILED' || item.status === 'BLOCKED',
    ).length;
    const cancelled = runs.filter((item) => item.status === 'CANCELLED').length;
    const partial = runs.filter((item) => item.status === 'PARTIAL').length;

    const sourcesScanned = runs.reduce((sum, item) => sum + item.sourcesScanned, 0);
    const evidenceCollected = runs.reduce((sum, item) => sum + item.signalsCollected, 0);

    const confidencePool = runs.flatMap((item) =>
      item.avgConfidence != null && item.measuredConfidence > 0 ? [item.avgConfidence] : [],
    );
    const measuredConfidence = confidencePool.length;
    const avgConfidence =
      measuredConfidence > 0
        ? Math.round(confidencePool.reduce((sum, value) => sum + value, 0) / measuredConfidence)
        : null;

    const terminal = completed + failed + cancelled + partial;
    const healthyTerminal = completed;
    const pipelineHealth =
      runs.length === 0
        ? 0
        : Math.round(
            ((healthyTerminal + running * 0.5 + queued * 0.25) /
              Math.max(1, terminal + running + queued)) *
              100,
          );

    const packageRow = packages[0];

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
      metrics: {
        discoveryRuns: runs.length,
        activeJobs: Number(activeJobsGlobal[0]?.total ?? 0),
        sourcesScanned,
        evidenceCollected,
        measuredConfidence,
        avgConfidence,
        pipelineHealth,
        queued,
        running,
        completed,
        failed,
        cancelled,
        partial,
        registeredSources,
      },
      runs,
      issues: deriveIssues(runs, registeredSources),
      audit: auditRows.map((row) => ({
        id: row.id,
        action: row.action,
        actorType: row.actorType,
        createdAt: row.createdAt.toISOString(),
        reason: row.reason,
        runId: row.runId,
      })),
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    return {
      available: false,
      reason:
        error instanceof Error
          ? error.message.replace(/password|secret|token/gi, '[redacted]')
          : 'Discovery runs unavailable. Run the Content Intelligence migration.',
      metrics: {
        discoveryRuns: 0,
        activeJobs: 0,
        sourcesScanned: 0,
        evidenceCollected: 0,
        measuredConfidence: 0,
        avgConfidence: null,
        pipelineHealth: 0,
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        partial: 0,
        registeredSources: 0,
      },
      runs: [],
      issues: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
