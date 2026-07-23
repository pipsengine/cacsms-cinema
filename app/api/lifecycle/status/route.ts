import { NextRequest, NextResponse } from 'next/server';
import {
  findLatestWorkflowRunId,
  getWorkflowStatusSnapshot,
  reconcileWorkflowRun,
} from '@/lib/visual-workflow/service';
import { LIFECYCLE_STAGES } from '@/apps/web/config/lifecycle-navigation';

export const dynamic = 'force-dynamic';

/**
 * Compatibility status endpoint for lifecycle UI.
 * Delegates to persisted VisualWorkflowRun snapshots — never fabricates progress.
 */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId');
    const workflowRunIdParam = request.nextUrl.searchParams.get('workflowRunId');
    const jobId = request.nextUrl.searchParams.get('jobId');

    let workflowRunId = workflowRunIdParam;
    if (!workflowRunId && jobId) {
      const { prisma } = await import('@/lib/db');
      const byJob = await prisma.visualWorkflowRun.findUnique({ where: { jobId } });
      workflowRunId = byJob?.id ?? null;
      if (!workflowRunId) {
        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (job) {
          const { ensureWorkflowRunForJob } = await import('@/lib/visual-workflow/service');
          const ensured = await ensureWorkflowRunForJob({
            jobId: job.id,
            projectId: job.projectId,
            correlationId: job.correlationId,
          });
          workflowRunId = ensured.id;
        }
      }
    }
    if (!workflowRunId) {
      workflowRunId = await findLatestWorkflowRunId(projectId);
    }

    if (!workflowRunId) {
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        available: true,
        workflowRunId: null,
        overallStatus: 'NOT_STARTED',
        queue: null,
        stages: LIFECYCLE_STAGES.map((stage) => ({
          id: stage.id,
          workflowStatus: 'not_started',
          executionStatus: 'NOT_STARTED',
          jobCount: null,
          progressPercent: null,
          blockingIssues: 0,
          lastUpdatedAt: null,
          pages: stage.pages.map((page) => ({
            id: page.id,
            status: page.capability === 'not_available' ? 'not_available' : 'not_started',
            executionStatus: page.capability === 'not_available' ? 'UNAVAILABLE' : 'NOT_STARTED',
            count: null,
            blocking: false,
            lastUpdatedAt: null,
          })),
        })),
      });
    }

    await reconcileWorkflowRun(workflowRunId);
    const snapshot = await getWorkflowStatusSnapshot(workflowRunId);
    if (!snapshot) {
      return NextResponse.json({ available: false, error: 'Workflow snapshot unavailable.' }, { status: 503 });
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      available: true,
      workflowRunId: snapshot.workflowRunId,
      projectId: snapshot.projectId,
      overallStatus: snapshot.overallStatus,
      overallProgress: snapshot.overallProgress,
      activeStageId: snapshot.activeStageId,
      version: snapshot.version,
      lastHeartbeatAt: snapshot.lastHeartbeatAt,
      allowedActions: snapshot.allowedActions,
      queue: null,
      stages: snapshot.stages.map((stage) => ({
        id: stage.stageId,
        workflowStatus: toUiStatus(stage.status),
        executionStatus: stage.status,
        jobCount: stage.totalTaskCount,
        progressPercent: stage.progressPercent,
        completedTaskCount: stage.completedTaskCount,
        totalTaskCount: stage.totalTaskCount,
        blockingIssues: stage.blockingExceptionCount,
        lastUpdatedAt: stage.updatedAt,
        startedAt: stage.startedAt,
        completedAt: stage.completedAt,
        retryEligible: stage.retryEligible,
        pages: stage.pages.map((page) => ({
          id: page.pageId,
          status: toUiPageStatus(page.status),
          executionStatus: page.status,
          count: page.recordCount,
          blocking: page.blockingIssueCount > 0,
          lastUpdatedAt: page.lastActivityAt,
          progressPercent: page.progressPercent,
          statusReason: page.statusReason,
        })),
      })),
    });
  } catch (error) {
    console.error('lifecycle status failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      {
        generatedAt: null,
        available: false,
        workflowRunId: null,
        queue: null,
        stages: LIFECYCLE_STAGES.map((stage) => ({
          id: stage.id,
          workflowStatus: 'unavailable',
          executionStatus: 'UNAVAILABLE',
          jobCount: null,
          progressPercent: null,
          blockingIssues: 0,
          lastUpdatedAt: null,
          pages: stage.pages.map((page) => ({
            id: page.id,
            status: 'not_available',
            executionStatus: 'UNAVAILABLE',
            count: null,
            blocking: false,
            lastUpdatedAt: null,
          })),
        })),
      },
      { status: 200 },
    );
  }
}

function toUiStatus(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'completed';
    case 'ACTIVE':
    case 'PAUSING':
    case 'RECOVERING':
    case 'DEGRADED':
      return 'active';
    case 'BLOCKED':
    case 'FAILED':
    case 'EMERGENCY_STOPPED':
      return 'blocked';
    case 'UNAVAILABLE':
      return 'unavailable';
    case 'QUEUED':
    case 'WAITING':
    case 'PAUSED':
    case 'STOPPED':
      return 'pending';
    default:
      return 'pending';
  }
}

function toUiPageStatus(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'completed';
    case 'ACTIVE':
      return 'active';
    case 'WAITING':
    case 'QUEUED':
      return 'waiting';
    case 'BLOCKED':
      return 'blocked';
    case 'FAILED':
      return 'failed';
    case 'UNAVAILABLE':
      return 'not_available';
    case 'NOT_STARTED':
      return 'not_started';
    default:
      return 'not_started';
  }
}
