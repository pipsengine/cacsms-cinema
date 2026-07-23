import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { LIFECYCLE_STAGES } from '@/apps/web/config/lifecycle-navigation';
import {
  buildStageGateCatalog,
  buildStageTaskCatalog,
  mapJobStatusToStageId,
  stageIdsBefore,
} from './catalog';
import { calculateOverallProgress, calculateTaskProgress, finalizeStageProgress } from './progress';
import {
  assertTransition,
  canTransition,
  controlActionAllowed,
  isVisualWorkflowStatus,
  targetStatusForControl,
  type VisualWorkflowStatus,
} from './statuses';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function recordEvent(
  tx: Tx,
  args: {
    workflowRunId: string;
    stageId?: string | null;
    eventType: string;
    previousStatus?: string | null;
    newStatus?: string | null;
    actorType: string;
    correlationId: string;
    metadata?: Record<string, unknown>;
  },
) {
  await tx.visualWorkflowEvent.create({
    data: {
      workflowRunId: args.workflowRunId,
      stageId: args.stageId ?? null,
      eventType: args.eventType,
      previousStatus: args.previousStatus ?? null,
      newStatus: args.newStatus ?? null,
      actorType: args.actorType,
      correlationId: args.correlationId,
      metadataJson: args.metadata ? JSON.stringify(args.metadata) : null,
    },
  });
}

export async function seedWorkflowStructure(
  tx: Tx,
  workflowRunId: string,
): Promise<void> {
  for (const stage of LIFECYCLE_STAGES) {
    await tx.visualWorkflowStageRun.create({
      data: {
        workflowRunId,
        stageId: stage.id,
        stageOrder: stage.order,
        status: 'NOT_STARTED',
        totalTaskCount: buildStageTaskCatalog(stage.id).filter((task) => task.applicable).length,
      },
    });

    for (const page of stage.pages) {
      await tx.visualWorkflowPageStatus.create({
        data: {
          workflowRunId,
          stageId: stage.id,
          pageId: page.id,
          status: page.capability === 'not_available' ? 'UNAVAILABLE' : 'NOT_STARTED',
          statusReason:
            page.capability === 'not_available'
              ? 'Capability not yet implemented by the backend'
              : null,
        },
      });
    }

    for (const task of buildStageTaskCatalog(stage.id)) {
      await tx.visualWorkflowTask.create({
        data: {
          workflowRunId,
          stageId: stage.id,
          pageId: task.pageId,
          taskType: task.taskType,
          sequenceOrder: task.sequenceOrder,
          weight: task.weight,
          applicable: task.applicable,
          status: task.applicable ? 'NOT_STARTED' : 'CANCELLED',
          idempotencyKey: `${workflowRunId}:${stage.id}:${task.taskType}`,
        },
      });
    }

    for (const gate of buildStageGateCatalog(stage.id)) {
      await tx.visualWorkflowGate.create({
        data: {
          workflowRunId,
          stageId: stage.id,
          gateType: gate.gateType,
          mandatory: gate.mandatory,
          requiredThreshold: gate.requiredThreshold,
          calculationBasis: gate.calculationBasis,
          result: 'PENDING',
        },
      });
    }
  }
}

/** Create a persisted workflow run for a job (idempotent on jobId). */
export async function ensureWorkflowRunForJob(args: {
  jobId: string;
  projectId: string;
  scriptId?: string | null;
  correlationId?: string;
}): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.visualWorkflowRun.findUnique({ where: { jobId: args.jobId } });
  if (existing) return { id: existing.id, created: false };

  const correlationId = args.correlationId || randomUUID();
  const created = await prisma.$transaction(async (tx) => {
    const activeSibling = await tx.visualWorkflowRun.findFirst({
      where: {
        projectId: args.projectId,
        status: { in: ['ACTIVE', 'QUEUED', 'PAUSING', 'PAUSED', 'RECOVERING', 'WAITING', 'DEGRADED'] },
        jobId: { not: args.jobId },
      },
      select: { id: true },
    });
    // Explicitly allow only one non-terminal active-like run per project unless already linked.
    if (activeSibling) {
      // Attach is not automatic — create run in WAITING until operator recovers/stops sibling.
    }

    const run = await tx.visualWorkflowRun.create({
      data: {
        projectId: args.projectId,
        scriptId: args.scriptId ?? null,
        jobId: args.jobId,
        status: activeSibling ? 'WAITING' : 'QUEUED',
        currentStageId: 'discover',
        correlationId,
        startedAt: activeSibling ? null : new Date(),
        lastHeartbeatAt: new Date(),
        stopOrFailureReason: activeSibling
          ? `Waiting: another workflow run ${activeSibling.id} is already active for this project`
          : null,
        checkpointJson: JSON.stringify({ jobId: args.jobId, stageId: 'discover' }),
      },
    });

    await seedWorkflowStructure(tx, run.id);
    await recordEvent(tx, {
      workflowRunId: run.id,
      stageId: 'discover',
      eventType: 'WorkflowRunCreated',
      previousStatus: null,
      newStatus: run.status,
      actorType: 'system',
      correlationId,
      metadata: { jobId: args.jobId, projectId: args.projectId },
    });

    return run;
  }, { timeout: 60_000 });

  return { id: created.id, created: true };
}

function pageStatusFromStage(
  pageCapability: 'live' | 'not_available',
  stageStatus: VisualWorkflowStatus,
  taskStatus: string | undefined,
  recordCount: number | null,
): VisualWorkflowStatus {
  if (pageCapability === 'not_available') return 'UNAVAILABLE';
  if (taskStatus === 'COMPLETED') return 'COMPLETED';
  if (taskStatus === 'FAILED') return 'FAILED';
  if (stageStatus === 'BLOCKED') return 'BLOCKED';
  if (stageStatus === 'ACTIVE' && taskStatus === 'ACTIVE') return 'ACTIVE';
  if (stageStatus === 'ACTIVE' || stageStatus === 'QUEUED') return taskStatus === 'ACTIVE' ? 'ACTIVE' : 'WAITING';
  if (stageStatus === 'COMPLETED') return 'COMPLETED';
  if (stageStatus === 'NOT_STARTED') return 'NOT_STARTED';
  if (recordCount != null && recordCount > 0 && stageStatus !== 'FAILED') return 'WAITING';
  return stageStatus === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'NOT_STARTED';
}

/** Reconcile persisted stage/page/task/gate status from Job + JobStageExecution + SystemControl. */
export async function reconcileWorkflowRun(workflowRunId: string): Promise<void> {
  const run = await prisma.visualWorkflowRun.findUnique({
    where: { id: workflowRunId },
    include: {
      stages: true,
      pages: true,
      tasks: true,
      gates: true,
      exceptions: { where: { status: 'OPEN', blocking: true } },
    },
  });
  if (!run) return;

  const control = await prisma.systemControl.findUnique({ where: { id: 'global' } });
  const desired = control?.desiredState ?? 'STOPPED';

  let job: {
    id: string;
    status: string;
    failureCode: string | null;
    errorJson: string | null;
    attemptCount: number;
  } | null = null;
  let executions: Array<{ stage: string; status: string }> = [];

  if (run.jobId) {
    job = await prisma.job.findUnique({
      where: { id: run.jobId },
      select: { id: true, status: true, failureCode: true, errorJson: true, attemptCount: true },
    });
    if (job) {
      executions = await prisma.jobStageExecution.findMany({
        where: { jobId: job.id },
        select: { stage: true, status: true },
      });
    }
  }

  const successStages = new Set(
    executions.filter((item) => item.status === 'SUCCESS').map((item) => item.stage),
  );

  const bareJobStatus = job?.status?.replace(/^PROCESSING:/, '') ?? null;
  const isProcessing = Boolean(job?.status?.startsWith('PROCESSING:'));
  const activeStageId = bareJobStatus ? mapJobStatusToStageId(job!.status) : run.currentStageId;
  const priorStageIds = activeStageId ? stageIdsBefore(activeStageId) : [];

  let overall: VisualWorkflowStatus = isVisualWorkflowStatus(run.status) ? run.status : 'UNAVAILABLE';

  if (desired === 'EMERGENCY_STOP') overall = 'EMERGENCY_STOPPED';
  else if (desired === 'PAUSED' && (overall === 'ACTIVE' || overall === 'QUEUED' || overall === 'DEGRADED')) {
    overall = canTransition(overall, 'PAUSED') ? 'PAUSED' : overall;
  } else if (desired === 'STOPPED' && !TERMINAL_LIKE(overall) && overall !== 'NOT_STARTED' && overall !== 'COMPLETED') {
    if (canTransition(overall, 'STOPPED')) overall = 'STOPPED';
  } else if (job?.status === 'HUMAN_EXCEPTION_REQUIRED' || job?.status === 'FAILED') {
    overall = 'BLOCKED';
  } else if (job?.status === 'CANCELLED') {
    overall = 'CANCELLED';
  } else if (job?.status === 'COMPLETED') {
    overall = 'COMPLETED';
  } else if (desired === 'RUNNING' && job && (isProcessing || PROCESSABLE(bareJobStatus))) {
    overall = isProcessing ? 'ACTIVE' : 'QUEUED';
  } else if (desired === 'RUNNING' && !job) {
    overall = run.status === 'WAITING' ? 'WAITING' : 'QUEUED';
  }

  await prisma.$transaction(async (tx) => {
    // Exception from job failure
    if (job?.status === 'HUMAN_EXCEPTION_REQUIRED' || job?.status === 'FAILED') {
      const open = await tx.visualWorkflowException.findFirst({
        where: {
          workflowRunId,
          status: 'OPEN',
          classification: job.failureCode || 'STAGE_EXECUTION_FAILED',
        },
      });
      if (!open) {
        await tx.visualWorkflowException.create({
          data: {
            workflowRunId,
            stageId: activeStageId,
            classification: job.failureCode || 'STAGE_EXECUTION_FAILED',
            severity: 'CRITICAL',
            blocking: true,
            status: 'OPEN',
            safeDescription: sanitizeError(job.errorJson, job.failureCode),
            retryEligible: isRetryableFailure(job.failureCode),
          },
        });
      }
    }

    const openBlocking = await tx.visualWorkflowException.count({
      where: { workflowRunId, status: 'OPEN', blocking: true },
    });

    for (const stage of LIFECYCLE_STAGES) {
      const stageRun = run.stages.find((item) => item.stageId === stage.id);
      if (!stageRun) continue;

      const mappedStatuses = stage.workflowStatuses;
      const completedMapped = mappedStatuses.filter((status) => successStages.has(status)).length;
      const allMappedDone = mappedStatuses.length > 0 && completedMapped === mappedStatuses.length;
      const isCurrent = activeStageId === stage.id;
      const isPrior = priorStageIds.includes(stage.id);

      let stageStatus: VisualWorkflowStatus = 'NOT_STARTED';
      if (overall === 'EMERGENCY_STOPPED') stageStatus = isCurrent || isPrior ? (isPrior && allMappedDone ? 'COMPLETED' : 'EMERGENCY_STOPPED') : 'NOT_STARTED';
      else if (overall === 'STOPPED') stageStatus = isPrior && allMappedDone ? 'COMPLETED' : isCurrent ? 'STOPPED' : isPrior ? 'STOPPED' : 'NOT_STARTED';
      else if (overall === 'PAUSED' || overall === 'PAUSING') {
        stageStatus = isPrior && allMappedDone ? 'COMPLETED' : isCurrent ? 'PAUSED' : 'NOT_STARTED';
      } else if (openBlocking > 0 && isCurrent) stageStatus = 'BLOCKED';
      else if (allMappedDone || (isPrior && job?.status === 'COMPLETED')) stageStatus = 'COMPLETED';
      else if (isCurrent && isProcessing) stageStatus = 'ACTIVE';
      else if (isCurrent) stageStatus = 'QUEUED';
      else if (isPrior) stageStatus = allMappedDone ? 'COMPLETED' : 'WAITING';
      else stageStatus = 'NOT_STARTED';

      // Tasks: mark applicable live pages based on mapped job execution
      const stageTasks = run.tasks.filter((task) => task.stageId === stage.id);
      for (const task of stageTasks) {
        if (!task.applicable) continue;
        let taskStatus = task.status;
        if (stageStatus === 'COMPLETED') taskStatus = 'COMPLETED';
        else if (stageStatus === 'ACTIVE' && task.pageId) {
          // Live generation pages become ACTIVE while generation statuses run
          const liveGen =
            stage.id === 'generation' &&
            ['image-generator', 'generation-queue', 'active-job', 'candidate-gallery', 'attempts', 'failures'].includes(
              task.pageId,
            );
          taskStatus = liveGen && isProcessing ? 'ACTIVE' : 'WAITING';
        } else if (stageStatus === 'BLOCKED') taskStatus = 'FAILED';
        else if (stageStatus === 'NOT_STARTED') taskStatus = 'NOT_STARTED';
        else if (stageStatus === 'QUEUED' || stageStatus === 'WAITING') taskStatus = 'WAITING';

        if (taskStatus !== task.status) {
          await tx.visualWorkflowTask.update({
            where: { id: task.id },
            data: {
              status: taskStatus,
              startedAt: taskStatus === 'ACTIVE' || taskStatus === 'COMPLETED' ? task.startedAt ?? new Date() : task.startedAt,
              completedAt: taskStatus === 'COMPLETED' ? task.completedAt ?? new Date() : null,
              attemptCount: job?.attemptCount ?? task.attemptCount,
            },
          });
        }
      }

      const refreshedTasks = await tx.visualWorkflowTask.findMany({ where: { workflowRunId, stageId: stage.id } });
      const taskProgress = calculateTaskProgress(
        refreshedTasks.map((task) => ({
          weight: task.weight,
          applicable: task.applicable,
          status: task.status,
        })),
      );

      // Gates
      const gateJobsResult = allMappedDone ? 'PASSED' : stageStatus === 'BLOCKED' ? 'FAILED' : 'PENDING';
      const gateExceptionsResult = openBlocking > 0 && isCurrent ? 'FAILED' : openBlocking === 0 ? 'PASSED' : 'PENDING';

      await tx.visualWorkflowGate.updateMany({
        where: { workflowRunId, stageId: stage.id, gateType: 'MANDATORY_STAGE_JOBS' },
        data: {
          result: gateJobsResult,
          measuredScore: mappedStatuses.length ? completedMapped / mappedStatuses.length : null,
          evaluatedAt: new Date(),
        },
      });
      await tx.visualWorkflowGate.updateMany({
        where: { workflowRunId, stageId: stage.id, gateType: 'NO_OPEN_BLOCKING_EXCEPTIONS' },
        data: {
          result: gateExceptionsResult,
          measuredScore: openBlocking,
          evaluatedAt: new Date(),
        },
      });

      const gates = await tx.visualWorkflowGate.findMany({ where: { workflowRunId, stageId: stage.id } });
      const finalized = finalizeStageProgress({
        taskProgress,
        gates: gates.map((gate) => ({ mandatory: gate.mandatory, result: gate.result })),
        openBlockingExceptions: isCurrent ? openBlocking : 0,
        proposedStatus: stageStatus,
      });

      if (stageStatus === 'COMPLETED' && !finalized.canComplete) {
        stageStatus = isCurrent ? 'BLOCKED' : 'ACTIVE';
      }

      const completedTaskCount = refreshedTasks.filter((task) => task.applicable && task.status === 'COMPLETED').length;
      const totalTaskCount = refreshedTasks.filter((task) => task.applicable).length;

      await tx.visualWorkflowStageRun.update({
        where: { id: stageRun.id },
        data: {
          status: stageStatus,
          progressPercent: finalized.progressPercent,
          completedTaskCount,
          totalTaskCount,
          blockingExceptionCount: isCurrent ? openBlocking : 0,
          attemptCount: isCurrent ? job?.attemptCount ?? stageRun.attemptCount : stageRun.attemptCount,
          startedAt: stageStatus === 'NOT_STARTED' ? null : stageRun.startedAt ?? new Date(),
          completedAt: stageStatus === 'COMPLETED' ? stageRun.completedAt ?? new Date() : null,
          retryEligible: stageStatus === 'BLOCKED',
          errorClassification: stageStatus === 'BLOCKED' ? job?.failureCode ?? 'BLOCKED' : null,
          checkpointJson: isCurrent
            ? JSON.stringify({ jobId: run.jobId, jobStatus: job?.status ?? null, stageId: stage.id })
            : stageRun.checkpointJson,
          version: { increment: 1 },
        },
      });

      // Pages
      for (const page of run.pages.filter((item) => item.stageId === stage.id)) {
        const config = LIFECYCLE_STAGES.flatMap((s) => s.pages).find((p) => p.id === page.pageId);
        const task = refreshedTasks.find((item) => item.pageId === page.pageId);
        let recordCount: number | null = null;
        if (page.pageId === 'generation-queue' || page.pageId === 'image-generator' || page.pageId === 'active-job') {
          recordCount = job ? 1 : 0;
        }
        if (page.pageId === 'exceptions') recordCount = openBlocking;

        const nextPageStatus = pageStatusFromStage(
          config?.capability ?? 'not_available',
          stageStatus,
          task?.status,
          recordCount,
        );

        await tx.visualWorkflowPageStatus.update({
          where: { id: page.id },
          data: {
            status: nextPageStatus,
            recordCount,
            blockingIssueCount: nextPageStatus === 'BLOCKED' ? Math.max(1, openBlocking) : 0,
            progressPercent: config?.exact ? finalized.progressPercent : task?.status === 'COMPLETED' ? 100 : null,
            lastActivityAt: new Date(),
            startedAt: nextPageStatus === 'NOT_STARTED' || nextPageStatus === 'UNAVAILABLE' ? null : page.startedAt ?? new Date(),
            completedAt: nextPageStatus === 'COMPLETED' ? page.completedAt ?? new Date() : null,
            statusReason:
              nextPageStatus === 'UNAVAILABLE'
                ? 'Capability not yet implemented by the backend'
                : stageStatus === 'BLOCKED'
                  ? sanitizeError(job?.errorJson ?? null, job?.failureCode ?? null)
                  : page.statusReason,
          },
        });
      }
    }

    const stageRows = await tx.visualWorkflowStageRun.findMany({ where: { workflowRunId } });
    const overallProgress = calculateOverallProgress(
      stageRows.map((stage) => ({
        progressPercent: stage.progressPercent,
        status: stage.status,
        weight: 1,
      })),
    );

    const previous = run.status;
    if (previous !== overall && isVisualWorkflowStatus(previous) && isVisualWorkflowStatus(overall)) {
      try {
        assertTransition(previous, overall);
      } catch {
        // Control overlays may force emergency/stop; record as forced recovery path via RECOVERING intermediate when needed.
        if (overall === 'EMERGENCY_STOPPED' || overall === 'STOPPED' || overall === 'BLOCKED' || overall === 'COMPLETED') {
          // allow forced terminal/control mapping from reconciler
        } else if (!canTransition(previous as VisualWorkflowStatus, overall)) {
          overall = previous as VisualWorkflowStatus;
        }
      }
    }

    await tx.visualWorkflowRun.update({
      where: { id: workflowRunId },
      data: {
        status: overall,
        currentStageId: activeStageId,
        progressPercent: overall === 'COMPLETED' ? 100 : overallProgress,
        lastHeartbeatAt: new Date(),
        completedAt: overall === 'COMPLETED' ? run.completedAt ?? new Date() : run.completedAt,
        pausedAt: overall === 'PAUSED' ? run.pausedAt ?? new Date() : null,
        stoppedAt:
          overall === 'STOPPED' || overall === 'EMERGENCY_STOPPED' ? run.stoppedAt ?? new Date() : run.stoppedAt,
        stopOrFailureReason:
          overall === 'BLOCKED'
            ? sanitizeError(job?.errorJson ?? null, job?.failureCode ?? null)
            : overall === 'WAITING'
              ? run.stopOrFailureReason
              : null,
        checkpointJson: JSON.stringify({
          jobId: run.jobId,
          jobStatus: job?.status ?? null,
          stageId: activeStageId,
          desiredState: desired,
        }),
        version: { increment: 1 },
      },
    });

    if (previous !== overall) {
      await recordEvent(tx, {
        workflowRunId,
        stageId: activeStageId,
        eventType: 'WorkflowStatusReconciled',
        previousStatus: previous,
        newStatus: overall,
        actorType: 'system',
        correlationId: run.correlationId,
        metadata: { jobStatus: job?.status ?? null, desiredState: desired },
      });
    }
  }, { timeout: 60_000 });
}

function TERMINAL_LIKE(status: string): boolean {
  return status === 'COMPLETED' || status === 'CANCELLED' || status === 'EMERGENCY_STOPPED';
}

function PROCESSABLE(status: string | null): boolean {
  if (!status) return false;
  return ![
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'HUMAN_EXCEPTION_REQUIRED',
  ].includes(status);
}

function sanitizeError(errorJson: string | null, failureCode: string | null): string {
  if (failureCode === 'NO_STAGE_HANDLER') return 'A required stage handler is not registered.';
  if (failureCode === 'WORKER_LEASE_EXPIRED') return 'Worker lease expired; stage requires recovery.';
  if (failureCode) return `Workflow blocked: ${failureCode}`;
  if (!errorJson) return 'Workflow blocked by an unresolved exception.';
  try {
    const parsed = JSON.parse(errorJson) as { message?: string };
    const message = parsed.message || 'Unresolved exception';
    return message.replace(/api[_-]?key|password|secret|token/gi, '[redacted]').slice(0, 280);
  } catch {
    return 'Unresolved exception';
  }
}

function isRetryableFailure(failureCode: string | null): boolean {
  if (!failureCode) return false;
  return ['WORKER_LEASE_EXPIRED', 'STAGE_EXECUTION_FAILED', 'PROVIDER_TIMEOUT'].includes(failureCode);
}

export async function applyWorkflowControl(args: {
  workflowRunId: string;
  action: 'start' | 'pause' | 'resume' | 'stop' | 'emergency_stop' | 'recover' | 'retry';
  reason?: string;
  actorId?: string;
  correlationId: string;
  expectedVersion?: number;
  stageId?: string;
}): Promise<{ ok: true; status: string; version: number } | { ok: false; status: number; error: string }> {
  const run = await prisma.visualWorkflowRun.findUnique({ where: { id: args.workflowRunId } });
  if (!run) return { ok: false, status: 404, error: 'Workflow run not found.' };
  if (args.expectedVersion != null && run.version !== args.expectedVersion) {
    return { ok: false, status: 409, error: 'Workflow run version conflict. Refetch and retry.' };
  }

  const current = isVisualWorkflowStatus(run.status) ? run.status : 'UNAVAILABLE';
  if (!controlActionAllowed(args.action, current) && args.action !== 'retry') {
    return { ok: false, status: 409, error: `Action ${args.action} is not allowed from status ${current}.` };
  }

  let next = targetStatusForControl(args.action);
  if (args.action === 'pause') next = 'PAUSED';
  if (args.action === 'retry' && args.stageId) {
    next = 'QUEUED';
  }

  try {
    assertTransition(current, next === 'PAUSED' && current === 'ACTIVE' ? 'PAUSING' : next);
  } catch {
    if (args.action === 'pause' && canTransition(current, 'PAUSING')) {
      next = 'PAUSED';
    } else if (!canTransition(current, next)) {
      return { ok: false, status: 409, error: `Invalid transition ${current} → ${next}.` };
    }
  }

  // Map to system control for worker gating (reuse established control plane).
  const desiredState =
    args.action === 'start' || args.action === 'resume' || args.action === 'recover' || args.action === 'retry'
      ? 'RUNNING'
      : args.action === 'pause'
        ? 'PAUSED'
        : args.action === 'emergency_stop'
          ? 'EMERGENCY_STOP'
          : 'STOPPED';

  await prisma.$transaction(async (tx) => {
    await tx.systemControl.upsert({
      where: { id: 'global' },
      create: {
        id: 'global',
        desiredState,
        reason: args.reason || `Workflow ${args.action}`,
        requestedBy: args.actorId || 'operator',
        correlationId: args.correlationId,
      },
      update: {
        desiredState,
        reason: args.reason || `Workflow ${args.action}`,
        requestedBy: args.actorId || 'operator',
        correlationId: args.correlationId,
        version: { increment: 1 },
      },
    });

    if (args.action === 'emergency_stop' && run.jobId) {
      await tx.job.updateMany({
        where: { id: run.jobId, deletedAt: null },
        data: { cancelRequestedAt: new Date(), version: { increment: 1 } },
      });
    }

    if (args.action === 'retry' && run.jobId) {
      const job = await tx.job.findUnique({ where: { id: run.jobId } });
      if (job && (job.status === 'HUMAN_EXCEPTION_REQUIRED' || job.status === 'FAILED')) {
        const failed = await tx.jobStageExecution.findFirst({
          where: { jobId: run.jobId, status: 'FAILED' },
          orderBy: { createdAt: 'desc' },
        });
        const stageFromArg = args.stageId
          ? LIFECYCLE_STAGES.find((stage) => stage.id === args.stageId)?.workflowStatuses[0]
          : undefined;
        const mappedStageId = mapJobStatusToStageId(job.status);
        const stageFromJob = mappedStageId
          ? LIFECYCLE_STAGES.find((stage) => stage.id === mappedStageId)?.workflowStatuses[0]
          : undefined;
        const retryAt = failed?.stage || stageFromArg || stageFromJob || 'DISCOVER';

        await tx.job.update({
          where: { id: run.jobId },
          data: {
            status: retryAt,
            failureCode: null,
            errorJson: null,
            cancelRequestedAt: null,
            version: { increment: 1 },
          },
        });
        await tx.visualWorkflowException.updateMany({
          where: { workflowRunId: args.workflowRunId, status: 'OPEN' },
          data: { status: 'RESOLVED', resolvedAt: new Date(), resolutionDetails: 'Retry requested' },
        });
      }
    }

    if (args.action === 'recover' && run.jobId) {
      const job = await tx.job.findUnique({ where: { id: run.jobId } });
      if (job?.status.startsWith('PROCESSING:')) {
        const bare = job.status.replace('PROCESSING:', '');
        await tx.job.update({
          where: { id: run.jobId },
          data: {
            status: bare,
            leaseOwner: null,
            leaseExpiresAt: null,
            version: { increment: 1 },
          },
        });
        await tx.jobStageExecution.updateMany({
          where: { jobId: run.jobId, status: 'IN_PROGRESS' },
          data: {
            status: 'FAILED',
            failureCode: 'RECOVERED_INTERRUPTED',
            completedAt: new Date(),
            retryDecision: 'RETRY',
          },
        });
      }
    }

    await tx.visualWorkflowRun.update({
      where: { id: args.workflowRunId },
      data: {
        status: next,
        pausedAt: next === 'PAUSED' ? new Date() : null,
        stoppedAt: next === 'STOPPED' || next === 'EMERGENCY_STOPPED' ? new Date() : run.stoppedAt,
        startedAt: run.startedAt ?? (next === 'QUEUED' || next === 'ACTIVE' ? new Date() : null),
        stopOrFailureReason: args.reason || null,
        lastHeartbeatAt: new Date(),
        version: { increment: 1 },
        checkpointJson: JSON.stringify({
          ...(safeJson(run.checkpointJson) || {}),
          lastControl: args.action,
          at: new Date().toISOString(),
        }),
      },
    });

    await recordEvent(tx, {
      workflowRunId: args.workflowRunId,
      stageId: args.stageId ?? run.currentStageId,
      eventType: `WorkflowControl:${args.action}`,
      previousStatus: current,
      newStatus: next,
      actorType: 'operator',
      correlationId: args.correlationId,
      metadata: { reason: args.reason || null },
    });

    await tx.auditEvent.create({
      data: {
        actorType: 'operator',
        actorId: args.actorId || 'operator',
        action: `VISUAL_WORKFLOW_${args.action.toUpperCase()}`,
        entityType: 'VisualWorkflowRun',
        entityId: args.workflowRunId,
        beforeJson: JSON.stringify({ status: current, version: run.version }),
        afterJson: JSON.stringify({ status: next }),
        correlationId: args.correlationId,
      },
    });

    await tx.outboxEvent.create({
      data: {
        aggregateType: 'VisualWorkflowRun',
        aggregateId: args.workflowRunId,
        eventType: `VisualWorkflow${args.action}`,
        payloadJson: JSON.stringify({ workflowRunId: args.workflowRunId, action: args.action, status: next }),
        correlationId: args.correlationId,
      },
    });
  }, { timeout: 30_000 });

  await reconcileWorkflowRun(args.workflowRunId);
  const updated = await prisma.visualWorkflowRun.findUniqueOrThrow({ where: { id: args.workflowRunId } });
  return { ok: true, status: updated.status, version: updated.version };
}

function safeJson(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function getWorkflowStatusSnapshot(workflowRunId: string) {
  const run = await prisma.visualWorkflowRun.findUnique({
    where: { id: workflowRunId },
    include: {
      stages: { orderBy: { stageOrder: 'asc' } },
      pages: true,
      tasks: { orderBy: { sequenceOrder: 'asc' } },
      gates: true,
      exceptions: { where: { status: 'OPEN' }, orderBy: { createdAt: 'desc' } },
      events: { orderBy: { createdAt: 'desc' }, take: 50 },
      project: { select: { id: true, name: true } },
    },
  });
  if (!run) return null;

  const blockingExceptionCount = run.exceptions.filter((item) => item.blocking).length;
  const allowedActions = (
    ['start', 'pause', 'resume', 'stop', 'emergency_stop', 'recover', 'retry'] as const
  ).filter((action) =>
    isVisualWorkflowStatus(run.status) ? controlActionAllowed(action, run.status) : false,
  );

  return {
    workflowRunId: run.id,
    projectId: run.projectId,
    projectName: run.project.name,
    scriptId: run.scriptId,
    jobId: run.jobId,
    overallStatus: run.status,
    activeStageId: run.currentStageId,
    currentTaskId: run.currentTaskId,
    overallProgress: run.progressPercent,
    lastHeartbeatAt: run.lastHeartbeatAt?.toISOString() ?? null,
    startedAt: run.startedAt?.toISOString() ?? null,
    updatedAt: run.updatedAt.toISOString(),
    pausedAt: run.pausedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    stoppedAt: run.stoppedAt?.toISOString() ?? null,
    blockingExceptionCount,
    failureOrBlockingReason: run.stopOrFailureReason,
    version: run.version,
    correlationId: run.correlationId,
    allowedActions,
    retryEligible: allowedActions.includes('retry'),
    stages: run.stages.map((stage) => ({
      stageId: stage.stageId,
      stageOrder: stage.stageOrder,
      status: stage.status,
      progressPercent: stage.progressPercent,
      completedTaskCount: stage.completedTaskCount,
      totalTaskCount: stage.totalTaskCount,
      currentTaskId: stage.currentTaskId,
      blockingExceptionCount: stage.blockingExceptionCount,
      attemptCount: stage.attemptCount,
      startedAt: stage.startedAt?.toISOString() ?? null,
      completedAt: stage.completedAt?.toISOString() ?? null,
      updatedAt: stage.updatedAt.toISOString(),
      retryEligible: stage.retryEligible,
      errorClassification: stage.errorClassification,
      gates: run.gates
        .filter((gate) => gate.stageId === stage.stageId)
        .map((gate) => ({
          gateType: gate.gateType,
          mandatory: gate.mandatory,
          result: gate.result,
          measuredScore: gate.measuredScore,
          requiredThreshold: gate.requiredThreshold,
          evaluatedAt: gate.evaluatedAt?.toISOString() ?? null,
        })),
      pages: run.pages
        .filter((page) => page.stageId === stage.stageId)
        .map((page) => ({
          pageId: page.pageId,
          status: page.status,
          recordCount: page.recordCount,
          blockingIssueCount: page.blockingIssueCount,
          progressPercent: page.progressPercent,
          lastActivityAt: page.lastActivityAt?.toISOString() ?? null,
          startedAt: page.startedAt?.toISOString() ?? null,
          completedAt: page.completedAt?.toISOString() ?? null,
          statusReason: page.statusReason,
        })),
    })),
    exceptions: run.exceptions.map((item) => ({
      id: item.id,
      stageId: item.stageId,
      classification: item.classification,
      severity: item.severity,
      blocking: item.blocking,
      status: item.status,
      safeDescription: item.safeDescription,
      retryEligible: item.retryEligible,
      createdAt: item.createdAt.toISOString(),
    })),
    recentActivity: run.events.map((event) => ({
      id: event.id,
      stageId: event.stageId,
      eventType: event.eventType,
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
      actorType: event.actorType,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export async function findLatestWorkflowRunId(projectId?: string | null): Promise<string | null> {
  const run = await prisma.visualWorkflowRun.findFirst({
    where: projectId ? { projectId } : undefined,
    orderBy: [{ updatedAt: 'desc' }],
    select: { id: true },
  });
  return run?.id ?? null;
}

export async function recoverActiveWorkflowRuns(): Promise<number> {
  const runs = await prisma.visualWorkflowRun.findMany({
    where: {
      status: { in: ['ACTIVE', 'PAUSING', 'RECOVERING', 'QUEUED'] },
    },
    select: { id: true, jobId: true },
  });

  let recovered = 0;
  for (const run of runs) {
    if (run.jobId) {
      const job = await prisma.job.findUnique({ where: { id: run.jobId } });
      if (job?.status.startsWith('PROCESSING:')) {
        const bare = job.status.replace('PROCESSING:', '');
        await prisma.$transaction([
          prisma.job.update({
            where: { id: job.id },
            data: {
              status: bare,
              leaseOwner: null,
              leaseExpiresAt: null,
              version: { increment: 1 },
            },
          }),
          prisma.jobStageExecution.updateMany({
            where: { jobId: job.id, status: 'IN_PROGRESS' },
            data: {
              status: 'FAILED',
              failureCode: 'WORKER_RESTART_RECOVERY',
              completedAt: new Date(),
              retryDecision: 'RETRY',
            },
          }),
          prisma.visualWorkflowRun.update({
            where: { id: run.id },
            data: {
              status: 'RECOVERING',
              lastHeartbeatAt: new Date(),
              version: { increment: 1 },
            },
          }),
          prisma.visualWorkflowEvent.create({
            data: {
              workflowRunId: run.id,
              eventType: 'WorkerRestartRecovery',
              previousStatus: 'ACTIVE',
              newStatus: 'RECOVERING',
              actorType: 'system',
              correlationId: randomUUID(),
              metadataJson: JSON.stringify({ jobId: job.id, resumedStatus: bare }),
            },
          }),
        ]);
        recovered += 1;
      }
    }
    await reconcileWorkflowRun(run.id);
  }
  return recovered;
}
