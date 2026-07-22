import { randomUUID } from 'crypto';
import { prisma } from './db';
import { PROCESSABLE_JOB_STATUSES, type JobStatus, isJobStatus } from './job-status';

const LIFECYCLE_SEQUENCE: JobStatus[] = [...PROCESSABLE_JOB_STATUSES, 'COMPLETED'];
const PROCESSING_PREFIX = 'PROCESSING:';
const LEASE_DURATION_MS = 5 * 60 * 1000;
const workerId = `${process.env.COMPUTERNAME ?? 'worker'}:${process.pid}:${randomUUID()}`;

interface StageContext {
  jobId: string;
  correlationId: string;
  stage: JobStatus;
}

type StageHandler = (context: StageContext) => Promise<Record<string, unknown>>;

// Production handlers are registered capability-by-capability. An absent handler is
// an explicit failure; the worker never simulates successful stage work.
const stageHandlers = new Map<JobStatus, StageHandler>();

export class JobOrchestrator {
  static registerStageHandler(stage: JobStatus, handler: StageHandler) {
    stageHandlers.set(stage, handler);
  }

  static getNextStatus(currentStatus: JobStatus): JobStatus | null {
    const currentIndex = LIFECYCLE_SEQUENCE.indexOf(currentStatus);
    if (currentIndex < 0 || currentIndex === LIFECYCLE_SEQUENCE.length - 1) return null;
    return LIFECYCLE_SEQUENCE[currentIndex + 1];
  }

  static async advanceJob(jobId: string, expectedStatus?: JobStatus): Promise<void> {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.cancelRequestedAt) return;

    const currentStatus = expectedStatus ?? (isJobStatus(job.status) ? job.status : undefined);
    if (!currentStatus || !PROCESSABLE_JOB_STATUSES.includes(currentStatus as never)) return;
    const nextStatus = this.getNextStatus(currentStatus);
    if (!nextStatus) return;

    const claimedStatus = `${PROCESSING_PREFIX}${currentStatus}`;
    const correlationId = job.correlationId || randomUUID();
    const startedAt = new Date();
    const attemptNumber = job.attemptCount + 1;

    const claimed = await prisma.$transaction(async (transaction) => {
      const claim = await transaction.job.updateMany({
        where: {
          id: jobId,
          status: currentStatus,
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: startedAt } }],
        },
        data: {
          status: claimedStatus,
          leaseOwner: workerId,
          leaseExpiresAt: new Date(startedAt.getTime() + LEASE_DURATION_MS),
          startedAt: job.startedAt ?? startedAt,
          attemptCount: { increment: 1 },
          version: { increment: 1 },
        },
      });
      if (claim.count !== 1) return null;

      const execution = await transaction.jobStageExecution.create({
        data: { jobId, stage: currentStatus, status: 'IN_PROGRESS', attemptNumber, startedAt, correlationId },
      });
      await transaction.outboxEvent.create({
        data: {
          aggregateType: 'Job',
          aggregateId: jobId,
          eventType: 'JobStageStarted',
          payloadJson: JSON.stringify({ jobId, stage: currentStatus, executionId: execution.id }),
          correlationId,
        },
      });
      return execution;
    }, { timeout: 30_000 });
    if (!claimed) return;

    try {
      const handler = stageHandlers.get(currentStatus);
      if (!handler) throw new Error(`NO_STAGE_HANDLER: No production handler is registered for ${currentStatus}`);
      const output = await handler({ jobId, stage: currentStatus, correlationId });
      const completedAt = new Date();

      await prisma.$transaction([
        prisma.jobStageExecution.update({
          where: { id: claimed.id },
          data: { status: 'SUCCESS', outputJson: JSON.stringify(output), completedAt, durationMs: completedAt.getTime() - startedAt.getTime() },
        }),
        prisma.job.update({
          where: { id: jobId },
          data: { status: nextStatus, leaseOwner: null, leaseExpiresAt: null, version: { increment: 1 }, ...(nextStatus === 'COMPLETED' && { completedAt }) },
        }),
        prisma.outboxEvent.create({
          data: { aggregateType: 'Job', aggregateId: jobId, eventType: 'JobStageCompleted', payloadJson: JSON.stringify({ jobId, stage: currentStatus, nextStatus }), correlationId },
        }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failureCode = message.startsWith('NO_STAGE_HANDLER:') ? 'NO_STAGE_HANDLER' : 'STAGE_EXECUTION_FAILED';
      const completedAt = new Date();
      await prisma.$transaction([
        prisma.jobStageExecution.update({
          where: { id: claimed.id },
          data: { status: 'FAILED', completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), failureCode, errorJson: JSON.stringify({ message }), retryDecision: 'HUMAN_REVIEW' },
        }),
        prisma.job.update({
          where: { id: jobId },
          data: { status: 'HUMAN_EXCEPTION_REQUIRED', failureCode, errorJson: JSON.stringify({ message }), leaseOwner: null, leaseExpiresAt: null, version: { increment: 1 } },
        }),
        prisma.outboxEvent.create({
          data: { aggregateType: 'Job', aggregateId: jobId, eventType: 'HumanExceptionRequired', payloadJson: JSON.stringify({ jobId, stage: currentStatus, failureCode }), correlationId },
        }),
      ]);
    }
  }

  static async recoverStaleClaims(): Promise<void> {
    const now = new Date();
    const staleJobs = await prisma.job.findMany({
      where: { status: { startsWith: PROCESSING_PREFIX }, leaseExpiresAt: { lt: now } },
      select: { id: true, status: true, correlationId: true },
    });
    for (const job of staleJobs) {
      await prisma.$transaction([
        prisma.job.update({
          where: { id: job.id },
          data: { status: 'HUMAN_EXCEPTION_REQUIRED', failureCode: 'WORKER_LEASE_EXPIRED', leaseOwner: null, leaseExpiresAt: null, version: { increment: 1 } },
        }),
        prisma.jobStageExecution.updateMany({
          where: { jobId: job.id, status: 'IN_PROGRESS' },
          data: { status: 'FAILED', completedAt: now, failureCode: 'WORKER_LEASE_EXPIRED', retryDecision: 'HUMAN_REVIEW' },
        }),
        prisma.outboxEvent.create({
          data: { aggregateType: 'Job', aggregateId: job.id, eventType: 'HumanExceptionRequired', payloadJson: JSON.stringify({ jobId: job.id, failureCode: 'WORKER_LEASE_EXPIRED' }), correlationId: job.correlationId },
        }),
      ]);
    }
  }

  static async pollAndProcessJobs(): Promise<void> {
    if (!process.env.DATABASE_URL) return;
    const control = await prisma.systemControl.findUnique({ where: { id: 'global' } });
    if (control?.desiredState !== 'RUNNING') return;

    await this.recoverStaleClaims();
    const pendingJobs = await prisma.job.findMany({
      where: { status: { in: [...PROCESSABLE_JOB_STATUSES] }, cancelRequestedAt: null, deletedAt: null },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 5,
    });
    for (const job of pendingJobs) await this.advanceJob(job.id, job.status as JobStatus);
  }
}
