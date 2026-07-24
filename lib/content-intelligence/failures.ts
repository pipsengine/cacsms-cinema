import { prisma } from '@/lib/db';

export type FailureSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type FailureCategory =
  | 'Infrastructure'
  | 'Database'
  | 'API'
  | 'Workflow'
  | 'AI'
  | 'Data'
  | 'Dependency'
  | 'Security'
  | 'Performance'
  | 'External'
  | 'Queue'
  | 'Transfer'
  | 'Discovery'
  | 'Evidence'
  | 'Ranking'
  | 'Portfolio'
  | 'Unknown';

export type RecoveryStatus =
  | 'ACTIVE'
  | 'DIAGNOSING'
  | 'RECOVERING'
  | 'RETRYING'
  | 'RECOVERED'
  | 'DEAD_LETTER'
  | 'BLOCKED'
  | 'PENDING';

export type FailureRecord = {
  id: string;
  source: 'blocker' | 'job' | 'run' | 'handoff';
  workflow: string;
  module: string;
  stage: string;
  component: string;
  severity: FailureSeverity;
  failureType: string;
  category: FailureCategory;
  message: string;
  lastError: string | null;
  recommendation: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  durationMs: number | null;
  retries: number;
  maxAttempts: number | null;
  recoveryStatus: RecoveryStatus;
  recoveryMethod: string | null;
  confidence: number | null;
  impact: string;
  rootCause: string;
  affectedJobs: number;
  correlationId: string | null;
  runId: string | null;
  nextAttemptAt: string | null;
  timeline: Array<{ key: string; label: string; at: string | null; done: boolean }>;
  diagnosis: {
    summary: string;
    probability: number | null;
    recoveryPlan: string[];
    preventiveActions: string[];
  };
};

export type FailureIssue = {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  code: string;
  message: string;
  failureId?: string;
};

export type FailurePipelineNode = {
  key: string;
  label: string;
  recordsProcessed: number;
  latencyMs: number | null;
  healthScore: number | null;
  confidence: number | null;
  queueDepth: number;
  successRate: number | null;
  state: 'pending' | 'active' | 'done' | 'failed';
};

export type FailureRecoveryOverview = {
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
    systemHealth: number | null;
    workflowAvailability: number | null;
    lastIncident: string | null;
    queueStatus: string;
  };
  metrics: {
    systemHealth: number | null;
    recoverySuccessRate: number | null;
    activeFailures: number;
    criticalFailures: number;
    warnings: number;
    recoveredJobs: number;
    autoHealedJobs: number;
    pendingRecovery: number;
    retryQueue: number;
    deadLetterQueue: number;
    averageRecoveryTimeMs: number | null;
    failurePredictionAccuracy: number | null;
    infrastructureHealth: number | null;
    workflowAvailability: number | null;
    dataIntegrity: number | null;
    aiConfidence: number | null;
  };
  categories: Array<{ category: FailureCategory; count: number }>;
  infrastructure: Array<{ key: string; label: string; status: string; value: number | null }>;
  pipeline: FailurePipelineNode[];
  failures: FailureRecord[];
  deadLetter: FailureRecord[];
  recommendations: Array<{
    id: string;
    action: string;
    reason: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  issues: FailureIssue[];
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

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, n) => sum + n, 0) / values.length);
}

function classifyCategory(text: string, jobType?: string | null): FailureCategory {
  const hay = `${text} ${jobType ?? ''}`.toLowerCase();
  if (/auth|token|credential|certificate|signature|tamper|security/.test(hay)) return 'Security';
  if (/database|sql|prisma|deadlock|lock/.test(hay)) return 'Database';
  if (/timeout|latency|slow|performance|cpu|memory|gpu|disk/.test(hay)) return 'Performance';
  if (/network|socket|dns|connect/.test(hay)) return 'Infrastructure';
  if (/api|http|provider|external|rate.?limit/.test(hay)) return 'API';
  if (/llm|model|embedding|prompt|hallucin|openai|anthropic/.test(hay)) return 'AI';
  if (/handoff|transfer|checksum|ack/.test(hay)) return 'Transfer';
  if (/queue|outbox|scheduler|lease/.test(hay)) return 'Queue';
  if (/evidence|verif|source|signal/.test(hay)) return 'Evidence';
  if (/rank|score|portfolio|duplicate/.test(hay)) return 'Ranking';
  if (/discover|run|job|workflow|orchestr/.test(hay)) return 'Workflow';
  if (/depend|missing|reference|metadata/.test(hay)) return 'Dependency';
  if (/corrupt|inconsist|invalid|data/.test(hay)) return 'Data';
  if (/external|third.?party|publish/.test(hay)) return 'External';
  if (/portfolio/.test(hay)) return 'Portfolio';
  if (/discover/.test(hay)) return 'Discovery';
  return 'Unknown';
}

function severityFrom(
  severity: string | null,
  status: string,
  attempts: number,
  maxAttempts: number | null,
): FailureSeverity {
  const s = (severity ?? status).toUpperCase();
  if (s === 'CRITICAL' || s === 'FATAL') return 'CRITICAL';
  if (s === 'HIGH' || s === 'ERROR' || s === 'FAILED') {
    if (maxAttempts != null && attempts >= maxAttempts) return 'CRITICAL';
    return 'HIGH';
  }
  if (s === 'WARNING' || s === 'MEDIUM') return 'MEDIUM';
  if (s === 'LOW') return 'LOW';
  if (s === 'INFO') return 'INFO';
  if (maxAttempts != null && attempts >= maxAttempts) return 'CRITICAL';
  if (attempts >= 3) return 'HIGH';
  return 'MEDIUM';
}

function recoveryStatusFor(input: {
  resolved: boolean;
  status: string;
  attempts: number;
  maxAttempts: number | null;
  nextAttemptAt: string | null;
}): RecoveryStatus {
  if (input.resolved || input.status.toUpperCase() === 'SUCCEEDED' || input.status.toUpperCase() === 'COMPLETED') {
    return 'RECOVERED';
  }
  if (
    input.maxAttempts != null &&
    input.attempts >= input.maxAttempts &&
    input.status.toUpperCase() === 'FAILED'
  ) {
    return 'DEAD_LETTER';
  }
  if (input.status.toUpperCase() === 'RETRYING' || input.nextAttemptAt) return 'RETRYING';
  if (input.status.toUpperCase() === 'RUNNING' || input.status.toUpperCase() === 'LEASED') {
    return 'RECOVERING';
  }
  if (input.status.toUpperCase() === 'FAILED' || input.status.toUpperCase() === 'BLOCKED') {
    return 'ACTIVE';
  }
  return 'PENDING';
}

function rootCauseFrom(message: string, category: FailureCategory): string {
  const hay = message.toLowerCase();
  if (/timeout/.test(hay)) return 'Timeout / exceeded SLA window';
  if (/memory|oom/.test(hay)) return 'Memory exhaustion';
  if (/deadlock|lock/.test(hay)) return 'Database lock / deadlock';
  if (/auth|token|unauthorized|401|403/.test(hay)) return 'Authentication / authorization failure';
  if (/rate.?limit|429/.test(hay)) return 'Provider rate limiting';
  if (/unavailable|offline|econnrefused|network/.test(hay)) return 'Service / network unavailable';
  if (/missing|not found|null/.test(hay)) return 'Missing dependency or metadata';
  if (/duplicate/.test(hay)) return 'Duplicate lock / conflict';
  if (/checksum|integrity|tamper/.test(hay)) return 'Integrity / signature mismatch';
  if (/embedding|vector/.test(hay)) return 'Embedding mismatch / vector service issue';
  if (/llm|model|prompt/.test(hay)) return 'AI model / prompt failure';
  return `${category} fault detected from persisted error text`;
}

function recoveryPlanFor(category: FailureCategory, recoveryStatus: RecoveryStatus): string[] {
  const plans: string[] = [];
  if (recoveryStatus === 'DEAD_LETTER') {
    plans.push('Move to dead-letter analysis', 'Rebuild payload', 'Manual operator review if repeated');
  } else {
    plans.push('Classify severity', 'Check dependencies', 'Apply adaptive retry');
  }
  switch (category) {
    case 'Database':
      plans.push('Reconnect pool', 'Retry transactional write');
      break;
    case 'API':
    case 'External':
      plans.push('Reconnect API', 'Switch provider fallback if configured');
      break;
    case 'AI':
      plans.push('Reload model', 'Regenerate embeddings if required');
      break;
    case 'Transfer':
      plans.push('Recalculate checksum', 'Rebuild handoff package', 'Retry transfer');
      break;
    case 'Queue':
      plans.push('Recreate queue lease', 'Resume scheduler');
      break;
    case 'Dependency':
      plans.push('Repair metadata', 'Reload strategy / evidence links');
      break;
    default:
      plans.push('Restart workflow step', 'Validate and resume pipeline');
  }
  plans.push('Validate restoration', 'Update learning / audit');
  return plans;
}

function preventiveFor(category: FailureCategory): string[] {
  switch (category) {
    case 'Performance':
      return ['Increase memory / GPU headroom', 'Split workflow batches', 'Improve caching'];
    case 'API':
    case 'External':
      return ['Increase redundancy', 'Tune rate limits', 'Add provider fallback'];
    case 'AI':
      return ['Improve prompts', 'Reduce concurrent LLM load', 'Cache embeddings'];
    case 'Database':
      return ['Scale workers carefully', 'Optimize locking', 'Add connection pool capacity'];
    case 'Queue':
      return ['Increase worker concurrency', 'Reduce lease contention'];
    default:
      return ['Improve dependency checks', 'Strengthen health probes', 'Document recurrence pattern'];
  }
}

export async function loadFailureRecovery(): Promise<FailureRecoveryOverview> {
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
      SELECT TOP 20
        CONVERT(varchar(36), id) AS id,
        status,
        started_at,
        completed_at,
        failure_reason
      FROM ci_discovery_runs
      ORDER BY created_at DESC
    `;

    const blockers = await prisma.$queryRaw<
      Array<{
        id: string;
        runId: string | null;
        severity: string;
        message: string;
        recommendation: string | null;
        createdAt: Date;
        resolvedAt: Date | null;
      }>
    >`
      SELECT TOP 100
        CONVERT(varchar(36), id) AS id,
        CONVERT(varchar(36), run_id) AS runId,
        severity,
        message,
        recommendation,
        created_at AS createdAt,
        resolved_at AS resolvedAt
      FROM ci_blockers
      ORDER BY created_at DESC
    `;

    const jobs = await prisma.$queryRaw<
      Array<{
        id: string;
        runId: string | null;
        jobType: string;
        status: string;
        attemptCount: number | bigint;
        maxAttempts: number | bigint;
        lastError: string | null;
        nextAttemptAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        payloadJson: string | null;
      }>
    >`
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
        updated_at AS updatedAt,
        payload_json AS payloadJson
      FROM ci_jobs
      WHERE status IN ('FAILED', 'RETRYING', 'BLOCKED', 'DEAD_LETTER', 'QUEUED', 'RUNNING', 'LEASED', 'PENDING')
         OR attempt_count > 0
         OR last_error IS NOT NULL
      ORDER BY updated_at DESC
    `;

    const handoffs = await prisma.$queryRaw<
      Array<{
        id: string;
        opportunityId: string;
        status: string;
        retryCount: number | bigint;
        failureReason: string | null;
        createdAt: Date;
        acknowledgedAt: Date | null;
      }>
    >`
      SELECT TOP 50
        CONVERT(varchar(36), id) AS id,
        CONVERT(varchar(36), opportunity_id) AS opportunityId,
        status,
        retry_count AS retryCount,
        failure_reason AS failureReason,
        created_at AS createdAt,
        acknowledged_at AS acknowledgedAt
      FROM ci_handoffs
      WHERE status IN ('FAILED', 'REJECTED', 'RETRY', 'RETRYING', 'ROLLED_BACK')
         OR retry_count > 0
         OR failure_reason IS NOT NULL
      ORDER BY created_at DESC
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
         OR action LIKE '%FAIL%'
         OR action LIKE '%RECOVER%'
         OR action LIKE '%RETRY%'
         OR action LIKE '%BLOCK%'
         OR action LIKE '%HANDOFF%'
      ORDER BY created_at DESC
    `;

    const failures: FailureRecord[] = [];

    for (const row of blockers) {
      const category = classifyCategory(row.message);
      const resolved = Boolean(row.resolvedAt);
      const recoveryStatus = recoveryStatusFor({
        resolved,
        status: resolved ? 'COMPLETED' : 'FAILED',
        attempts: resolved ? 1 : 0,
        maxAttempts: null,
        nextAttemptAt: null,
      });
      const severity = severityFrom(row.severity, 'FAILED', 0, null);
      const rootCause = rootCauseFrom(row.message, category);
      const durationMs =
        row.resolvedAt != null
          ? Math.max(0, row.resolvedAt.getTime() - row.createdAt.getTime())
          : Date.now() - row.createdAt.getTime();
      failures.push({
        id: `blocker-${row.id}`,
        source: 'blocker',
        workflow: 'Content Intelligence',
        module: 'Blockers',
        stage: '02',
        component: 'ci_blockers',
        severity,
        failureType: row.severity,
        category,
        message: row.message,
        lastError: row.message,
        recommendation: row.recommendation,
        detectedAt: row.createdAt.toISOString(),
        resolvedAt: row.resolvedAt?.toISOString() ?? null,
        durationMs,
        retries: 0,
        maxAttempts: null,
        recoveryStatus,
        recoveryMethod: resolved ? 'Resolved blocker' : row.recommendation,
        confidence: resolved ? 80 : 55,
        impact: severity === 'CRITICAL' || severity === 'HIGH' ? 'Workflow blocked' : 'Degraded',
        rootCause,
        affectedJobs: 1,
        correlationId: row.runId,
        runId: row.runId,
        nextAttemptAt: null,
        timeline: [
          { key: 'detected', label: 'Failure detected', at: row.createdAt.toISOString(), done: true },
          { key: 'analysis', label: 'Analysis', at: row.createdAt.toISOString(), done: true },
          {
            key: 'recovery',
            label: 'Recovery',
            at: row.resolvedAt?.toISOString() ?? null,
            done: resolved,
          },
          {
            key: 'completed',
            label: 'Completed',
            at: row.resolvedAt?.toISOString() ?? null,
            done: resolved,
          },
        ],
        diagnosis: {
          summary: row.message,
          probability: resolved ? 90 : 70,
          recoveryPlan: recoveryPlanFor(category, recoveryStatus),
          preventiveActions: preventiveFor(category),
        },
      });
    }

    for (const row of jobs) {
      const attempts = Number(row.attemptCount);
      const maxAttempts = Number(row.maxAttempts);
      const category = classifyCategory(row.lastError ?? row.jobType, row.jobType);
      const recoveryStatus = recoveryStatusFor({
        resolved: row.status.toUpperCase() === 'SUCCEEDED' || row.status.toUpperCase() === 'COMPLETED',
        status: row.status,
        attempts,
        maxAttempts,
        nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
      });
      const severity = severityFrom(null, row.status, attempts, maxAttempts);
      const message = row.lastError ?? `Job ${row.jobType} status ${row.status}`;
      const rootCause = rootCauseFrom(message, category);
      const durationMs = Math.max(0, row.updatedAt.getTime() - row.createdAt.getTime());
      const recovered =
        recoveryStatus === 'RECOVERED' ||
        (attempts > 0 &&
          (row.status.toUpperCase() === 'SUCCEEDED' || row.status.toUpperCase() === 'COMPLETED'));
      failures.push({
        id: `job-${row.id}`,
        source: 'job',
        workflow: 'Discovery / CI Jobs',
        module: row.jobType,
        stage: '02',
        component: 'ci_jobs',
        severity,
        failureType: row.status,
        category,
        message,
        lastError: row.lastError,
        recommendation:
          recoveryStatus === 'DEAD_LETTER'
            ? 'Dead-letter: rebuild payload and requeue'
            : 'Adaptive retry with exponential backoff',
        detectedAt: row.createdAt.toISOString(),
        resolvedAt: recovered ? row.updatedAt.toISOString() : null,
        durationMs,
        retries: attempts,
        maxAttempts,
        recoveryStatus,
        recoveryMethod:
          recoveryStatus === 'RETRYING'
            ? 'Scheduled retry'
            : recoveryStatus === 'DEAD_LETTER'
              ? 'Dead letter quarantine'
              : recovered
                ? 'Auto-healed via retry'
                : 'Pending recovery plan',
        confidence: recovered ? 85 : recoveryStatus === 'DEAD_LETTER' ? 40 : 60,
        impact:
          recoveryStatus === 'DEAD_LETTER'
            ? 'Unrecoverable without rebuild'
            : 'Job retryable / workflow delayed',
        rootCause,
        affectedJobs: 1,
        correlationId: row.runId,
        runId: row.runId,
        nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
        timeline: [
          { key: 'detected', label: 'Failure detected', at: row.createdAt.toISOString(), done: true },
          {
            key: 'diagnosis',
            label: 'Diagnosis',
            at: row.updatedAt.toISOString(),
            done: Boolean(row.lastError),
          },
          {
            key: 'retry',
            label: 'Retry',
            at: attempts > 0 ? row.updatedAt.toISOString() : row.nextAttemptAt?.toISOString() ?? null,
            done: attempts > 0 || recoveryStatus === 'RETRYING',
          },
          {
            key: 'resume',
            label: 'Resume workflow',
            at: recovered ? row.updatedAt.toISOString() : null,
            done: recovered,
          },
          {
            key: 'learning',
            label: 'Learning updated',
            at: recovered ? row.updatedAt.toISOString() : null,
            done: recovered,
          },
        ],
        diagnosis: {
          summary: message,
          probability: recovered ? 88 : 65,
          recoveryPlan: recoveryPlanFor(category, recoveryStatus),
          preventiveActions: preventiveFor(category),
        },
      });
    }

    for (const row of runs.filter((r) => r.failure_reason || r.status === 'FAILED')) {
      const message = row.failure_reason ?? `Discovery run ${row.status}`;
      const category = classifyCategory(message, 'DISCOVERY_RUN');
      const resolved = row.status === 'COMPLETED';
      const recoveryStatus = recoveryStatusFor({
        resolved,
        status: row.status,
        attempts: 1,
        maxAttempts: 1,
        nextAttemptAt: null,
      });
      failures.push({
        id: `run-${row.id}`,
        source: 'run',
        workflow: 'Discovery Run',
        module: 'ci_discovery_runs',
        stage: '02',
        component: 'discovery',
        severity: severityFrom('HIGH', row.status, 1, 1),
        failureType: row.status,
        category,
        message,
        lastError: row.failure_reason,
        recommendation: 'Restart discovery run after dependency health checks',
        detectedAt: (row.started_at ?? new Date()).toISOString(),
        resolvedAt: resolved ? row.completed_at?.toISOString() ?? null : null,
        durationMs:
          row.started_at && row.completed_at
            ? Math.max(0, row.completed_at.getTime() - row.started_at.getTime())
            : row.started_at
              ? Date.now() - row.started_at.getTime()
              : null,
        retries: 0,
        maxAttempts: null,
        recoveryStatus,
        recoveryMethod: resolved ? 'Run completed after recovery' : 'Await run restart',
        confidence: 70,
        impact: 'Discovery pipeline interrupted',
        rootCause: rootCauseFrom(message, category),
        affectedJobs: 1,
        correlationId: row.id,
        runId: row.id,
        nextAttemptAt: null,
        timeline: [
          {
            key: 'detected',
            label: 'Failure detected',
            at: (row.started_at ?? new Date()).toISOString(),
            done: true,
          },
          {
            key: 'diagnosis',
            label: 'Diagnosis',
            at: (row.started_at ?? new Date()).toISOString(),
            done: Boolean(row.failure_reason),
          },
          {
            key: 'completed',
            label: 'Completed',
            at: row.completed_at?.toISOString() ?? null,
            done: resolved,
          },
        ],
        diagnosis: {
          summary: message,
          probability: 75,
          recoveryPlan: recoveryPlanFor(category, recoveryStatus),
          preventiveActions: preventiveFor(category),
        },
      });
    }

    for (const row of handoffs) {
      const message = row.failureReason ?? `Handoff ${row.status}`;
      const category = classifyCategory(message, 'HANDOFF');
      const attempts = Number(row.retryCount);
      const resolved = Boolean(row.acknowledgedAt) && !/FAIL|REJECT|ROLLBACK/i.test(row.status);
      const recoveryStatus = recoveryStatusFor({
        resolved,
        status: row.status,
        attempts,
        maxAttempts: 5,
        nextAttemptAt: null,
      });
      failures.push({
        id: `handoff-${row.id}`,
        source: 'handoff',
        workflow: 'Qualification Handoff',
        module: 'ci_handoffs',
        stage: '02→03',
        component: 'transfer',
        severity: severityFrom('HIGH', row.status, attempts, 5),
        failureType: row.status,
        category: 'Transfer',
        message,
        lastError: row.failureReason,
        recommendation: 'Rebuild package, recalculate checksum, retry transfer',
        detectedAt: row.createdAt.toISOString(),
        resolvedAt: resolved ? row.acknowledgedAt?.toISOString() ?? null : null,
        durationMs:
          row.acknowledgedAt != null
            ? Math.max(0, row.acknowledgedAt.getTime() - row.createdAt.getTime())
            : Date.now() - row.createdAt.getTime(),
        retries: attempts,
        maxAttempts: 5,
        recoveryStatus,
        recoveryMethod: attempts > 0 ? 'Handoff retry' : 'Pending transfer recovery',
        confidence: 65,
        impact: 'Stage 03 intake delayed',
        rootCause: rootCauseFrom(message, category),
        affectedJobs: 1,
        correlationId: row.opportunityId,
        runId: null,
        nextAttemptAt: null,
        timeline: [
          { key: 'detected', label: 'Failure detected', at: row.createdAt.toISOString(), done: true },
          {
            key: 'retry',
            label: 'Retry',
            at: attempts > 0 ? row.createdAt.toISOString() : null,
            done: attempts > 0,
          },
          {
            key: 'ack',
            label: 'Acknowledged',
            at: row.acknowledgedAt?.toISOString() ?? null,
            done: resolved,
          },
        ],
        diagnosis: {
          summary: message,
          probability: 70,
          recoveryPlan: recoveryPlanFor('Transfer', recoveryStatus),
          preventiveActions: preventiveFor('Transfer'),
        },
      });
    }

    // Prefer unique ids; already unique by prefix
    failures.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));

    const activeFailures = failures.filter(
      (item) =>
        item.recoveryStatus === 'ACTIVE' ||
        item.recoveryStatus === 'RETRYING' ||
        item.recoveryStatus === 'RECOVERING' ||
        item.recoveryStatus === 'PENDING' ||
        item.recoveryStatus === 'BLOCKED' ||
        item.recoveryStatus === 'DIAGNOSING',
    );
    const criticalFailures = failures.filter(
      (item) =>
        item.severity === 'CRITICAL' &&
        item.recoveryStatus !== 'RECOVERED',
    );
    const warnings = failures.filter(
      (item) =>
        (item.severity === 'MEDIUM' || item.severity === 'LOW') &&
        item.recoveryStatus !== 'RECOVERED',
    );
    const recoveredJobs = failures.filter((item) => item.recoveryStatus === 'RECOVERED');
    const autoHealedJobs = recoveredJobs.filter(
      (item) => item.retries > 0 || item.source === 'job',
    );
    const pendingRecovery = failures.filter(
      (item) =>
        item.recoveryStatus === 'PENDING' ||
        item.recoveryStatus === 'DIAGNOSING' ||
        item.recoveryStatus === 'RECOVERING',
    );
    const retryQueue = failures.filter((item) => item.recoveryStatus === 'RETRYING');
    const deadLetter = failures.filter((item) => item.recoveryStatus === 'DEAD_LETTER');
    const recoveryTimes = recoveredJobs
      .map((item) => item.durationMs)
      .filter((value): value is number => value != null);
    const closedOrOpen = failures.filter(
      (item) =>
        item.recoveryStatus === 'RECOVERED' ||
        item.recoveryStatus === 'DEAD_LETTER' ||
        item.recoveryStatus === 'ACTIVE' ||
        item.recoveryStatus === 'RETRYING',
    );
    const recoverySuccessRate =
      closedOrOpen.length > 0
        ? Math.round((recoveredJobs.length / closedOrOpen.length) * 1000) / 10
        : null;

    const confValues = failures
      .map((item) => item.confidence)
      .filter((value): value is number => value != null);

    const categoryMap = new Map<FailureCategory, number>();
    for (const item of failures) {
      categoryMap.set(item.category, (categoryMap.get(item.category) ?? 0) + 1);
    }
    const categories = [...categoryMap.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const totalIncidents = failures.length;
    const healthyShare =
      totalIncidents === 0
        ? 100
        : Math.max(
            0,
            Math.round(
              100 -
                (activeFailures.length / Math.max(1, totalIncidents)) * 70 -
                (criticalFailures.length / Math.max(1, totalIncidents)) * 30,
            ),
          );
    const workflowAvailability =
      totalIncidents === 0
        ? 100
        : Math.max(
            0,
            Math.round(
              100 - (activeFailures.length / Math.max(1, totalIncidents)) * 100,
            ),
          );

    const packageRow = packages[0];
    const run = runs[0];
    const lastIncident = failures[0]?.detectedAt ?? null;

    const recommendations = [
      criticalFailures.length > 0
        ? {
            id: 'critical',
            action: 'Prioritize critical incident recovery',
            reason: `${criticalFailures.length} critical failure(s) still open.`,
            priority: 'HIGH' as const,
          }
        : null,
      deadLetter.length > 0
        ? {
            id: 'dlq',
            action: 'Rebuild dead-letter payloads and requeue',
            reason: `${deadLetter.length} job(s) exhausted max attempts.`,
            priority: 'HIGH' as const,
          }
        : null,
      retryQueue.length > 5
        ? {
            id: 'retry',
            action: 'Tune adaptive retry / scale workers',
            reason: `Retry queue depth is ${retryQueue.length}.`,
            priority: 'MEDIUM' as const,
          }
        : null,
      categories[0] && categories[0].count >= 3
        ? {
            id: 'hotspot',
            action: `Harden ${categories[0].category} resilience`,
            reason: `${categories[0].count} incidents concentrated in ${categories[0].category}.`,
            priority: 'MEDIUM' as const,
          }
        : null,
      recoverySuccessRate != null && recoverySuccessRate < 70
        ? {
            id: 'sla',
            action: 'Improve recovery SLA / reduce MTTR',
            reason: `Recovery success rate ${recoverySuccessRate}% is below 70%.`,
            priority: 'MEDIUM' as const,
          }
        : null,
    ].filter(Boolean) as FailureRecoveryOverview['recommendations'];

    const issues: FailureIssue[] = [];
    for (const item of criticalFailures.slice(0, 10)) {
      issues.push({
        id: `${item.id}-crit`,
        severity: 'CRITICAL',
        code: 'CRITICAL_FAILURE',
        message: item.message,
        failureId: item.id,
      });
    }
    for (const item of deadLetter.slice(0, 5)) {
      issues.push({
        id: `${item.id}-dlq`,
        severity: 'WARNING',
        code: 'DEAD_LETTER',
        message: `Dead letter: ${item.message}`,
        failureId: item.id,
      });
    }
    if (activeFailures.length === 0 && failures.length > 0) {
      issues.push({
        id: 'healthy',
        severity: 'INFO',
        code: 'SYSTEM_HEALTHY',
        message: 'No active failures — recovered incidents remain available for learning.',
      });
    }

    const pipelineBase: Array<Omit<FailurePipelineNode, 'state'>> = [
      {
        key: 'detect',
        label: 'Failure Detection',
        recordsProcessed: failures.length,
        latencyMs: null,
        healthScore: healthyShare,
        confidence: avg(confValues),
        queueDepth: activeFailures.length,
        successRate: recoverySuccessRate,
      },
      {
        key: 'classify',
        label: 'Classification',
        recordsProcessed: categories.length,
        latencyMs: null,
        healthScore: healthyShare,
        confidence: avg(confValues),
        queueDepth: warnings.length,
        successRate: null,
      },
      {
        key: 'rca',
        label: 'Root Cause Analysis',
        recordsProcessed: failures.filter((item) => Boolean(item.rootCause)).length,
        latencyMs: null,
        healthScore: avg(
          failures
            .map((item) => item.diagnosis.probability)
            .filter((value): value is number => value != null),
        ),
        confidence: avg(confValues),
        queueDepth: pendingRecovery.length,
        successRate: null,
      },
      {
        key: 'deps',
        label: 'Dependency Check',
        recordsProcessed: failures.filter((item) => item.category === 'Dependency').length,
        latencyMs: null,
        healthScore: null,
        confidence: avg(confValues),
        queueDepth: failures.filter((item) => item.category === 'Dependency').length,
        successRate: null,
      },
      {
        key: 'plan',
        label: 'Recovery Planning',
        recordsProcessed: failures.filter((item) => item.diagnosis.recoveryPlan.length > 0).length,
        latencyMs: null,
        healthScore: healthyShare,
        confidence: avg(confValues),
        queueDepth: pendingRecovery.length,
        successRate: null,
      },
      {
        key: 'heal',
        label: 'Auto-Healing',
        recordsProcessed: autoHealedJobs.length,
        latencyMs: avg(recoveryTimes),
        healthScore: recoverySuccessRate,
        confidence: avg(confValues),
        queueDepth: retryQueue.length,
        successRate: recoverySuccessRate,
      },
      {
        key: 'validate',
        label: 'Validation',
        recordsProcessed: recoveredJobs.length,
        latencyMs: avg(recoveryTimes),
        healthScore: recoverySuccessRate,
        confidence: avg(confValues),
        queueDepth: deadLetter.length,
        successRate: recoverySuccessRate,
      },
      {
        key: 'resume',
        label: 'Resume Workflow',
        recordsProcessed: recoveredJobs.length,
        latencyMs: avg(recoveryTimes),
        healthScore: workflowAvailability,
        confidence: avg(confValues),
        queueDepth: activeFailures.length,
        successRate: workflowAvailability,
      },
      {
        key: 'learn',
        label: 'Learning Update',
        recordsProcessed: recoveredJobs.length + deadLetter.length,
        latencyMs: null,
        healthScore: recoverySuccessRate,
        confidence: avg(confValues),
        queueDepth: 0,
        successRate: null,
      },
    ];

    const runStatus = run?.status ?? 'IDLE';
    const activeIndex = !packageRow
      ? -1
      : failures.length === 0
        ? 0
        : criticalFailures.length > 0 || deadLetter.length > 0
          ? 5
          : activeFailures.length > 0
            ? 5
            : 8;

    const pipeline: FailurePipelineNode[] = pipelineBase.map((node, index) => ({
      ...node,
      state:
        runStatus === 'FAILED' && index === Math.max(0, activeIndex)
          ? 'failed'
          : activeIndex < 0
            ? 'pending'
            : index < activeIndex
              ? 'done'
              : index === activeIndex
                ? 'active'
                : 'pending',
    }));

    const infrastructure: FailureRecoveryOverview['infrastructure'] = [
      { key: 'cpu', label: 'CPU', status: 'UNMEASURED', value: null },
      { key: 'memory', label: 'Memory', status: 'UNMEASURED', value: null },
      { key: 'disk', label: 'Disk', status: 'UNMEASURED', value: null },
      { key: 'gpu', label: 'GPU', status: 'UNMEASURED', value: null },
      { key: 'database', label: 'Database', status: 'UNMEASURED', value: null },
      { key: 'redis', label: 'Redis', status: 'UNMEASURED', value: null },
      { key: 'queue', label: 'Queue', status: retryQueue.length ? 'DEGRADED' : 'UNMEASURED', value: retryQueue.length || null },
      { key: 'workers', label: 'Workers', status: 'UNMEASURED', value: null },
      { key: 'llm', label: 'LLM', status: 'UNMEASURED', value: null },
      { key: 'vector', label: 'Vector DB', status: 'UNMEASURED', value: null },
      { key: 'storage', label: 'Object Storage', status: 'UNMEASURED', value: null },
      {
        key: 'workflow',
        label: 'Workflow availability',
        status: workflowAvailability >= 90 ? 'HEALTHY' : workflowAvailability >= 70 ? 'DEGRADED' : 'IMPACTED',
        value: workflowAvailability,
      },
    ];

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
        systemHealth: healthyShare,
        workflowAvailability,
        lastIncident,
        queueStatus: activeFailures.length
          ? `${activeFailures.length} active`
          : deadLetter.length
            ? `${deadLetter.length} dead-letter`
            : failures.length
              ? 'Stable'
              : packageRow
                ? 'Monitoring'
                : 'Blocked',
      },
      metrics: {
        systemHealth: healthyShare,
        recoverySuccessRate,
        activeFailures: activeFailures.length,
        criticalFailures: criticalFailures.length,
        warnings: warnings.length,
        recoveredJobs: recoveredJobs.length,
        autoHealedJobs: autoHealedJobs.length,
        pendingRecovery: pendingRecovery.length,
        retryQueue: retryQueue.length,
        deadLetterQueue: deadLetter.length,
        averageRecoveryTimeMs: avg(recoveryTimes),
        failurePredictionAccuracy: null,
        infrastructureHealth: null,
        workflowAvailability,
        dataIntegrity: null,
        aiConfidence: avg(confValues),
      },
      categories,
      infrastructure,
      pipeline,
      failures,
      deadLetter,
      recommendations,
      issues: issues.slice(0, 40),
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
          : 'Failure recovery unavailable. Run the Content Intelligence migration.',
      meta: {
        systemHealth: null,
        workflowAvailability: null,
        lastIncident: null,
        queueStatus: 'Unavailable',
      },
      metrics: {
        systemHealth: null,
        recoverySuccessRate: null,
        activeFailures: 0,
        criticalFailures: 0,
        warnings: 0,
        recoveredJobs: 0,
        autoHealedJobs: 0,
        pendingRecovery: 0,
        retryQueue: 0,
        deadLetterQueue: 0,
        averageRecoveryTimeMs: null,
        failurePredictionAccuracy: null,
        infrastructureHealth: null,
        workflowAvailability: null,
        dataIntegrity: null,
        aiConfidence: null,
      },
      categories: [],
      infrastructure: [],
      pipeline: [],
      failures: [],
      deadLetter: [],
      recommendations: [],
      issues: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
