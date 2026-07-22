import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  LIFECYCLE_STAGES,
  deriveWorkflowStatusFromQueue,
  stageJobCount,
} from '@/apps/web/config/lifecycle-navigation';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [statusGroups, exceptionCount, recentJob] = await Promise.all([
      prisma.job.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.job.count({ where: { deletedAt: null, status: 'HUMAN_EXCEPTION_REQUIRED' } }),
      prisma.job.findFirst({
        where: { deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ]);

    const queue = Object.fromEntries(
      statusGroups.map((group) => [group.status, group._count._all]),
    );

    const stages = LIFECYCLE_STAGES.map((stage) => {
      const workflowStatus = deriveWorkflowStatusFromQueue(queue, stage);
      const jobCount = stageJobCount(queue, stage) ?? 0;
      const blockingIssues = stage.id === 'quality' ? exceptionCount : 0;

      return {
        id: stage.id,
        workflowStatus,
        jobCount,
        progressPercent: null as number | null,
        blockingIssues,
        lastUpdatedAt: recentJob?.updatedAt?.toISOString() ?? null,
        pages: stage.pages.map((page) => {
          let status:
            | 'ready'
            | 'active'
            | 'waiting'
            | 'blocked'
            | 'failed'
            | 'completed'
            | 'not_started'
            | 'not_available' = page.capability === 'not_available' ? 'not_available' : 'not_started';
          let count: number | null = null;

          if (page.capability === 'live') {
            if (page.id === 'generation-queue' || page.id === 'image-generator' || page.id === 'active-job') {
              count = jobCount;
              status = workflowStatus === 'active' ? 'active' : jobCount > 0 ? 'waiting' : 'ready';
            } else if (page.id === 'exceptions') {
              count = exceptionCount;
              status = exceptionCount > 0 ? 'blocked' : 'ready';
            } else {
              status = 'ready';
            }
          }

          return {
            id: page.id,
            status,
            count,
            blocking: status === 'blocked',
            lastUpdatedAt: recentJob?.updatedAt?.toISOString() ?? null,
          };
        }),
      };
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      available: true,
      queue,
      stages,
    });
  } catch {
    return NextResponse.json(
      {
        generatedAt: null,
        available: false,
        queue: null,
        stages: LIFECYCLE_STAGES.map((stage) => ({
          id: stage.id,
          workflowStatus: 'unavailable',
          jobCount: null,
          progressPercent: null,
          blockingIssues: 0,
          lastUpdatedAt: null,
          pages: stage.pages.map((page) => ({
            id: page.id,
            status: page.capability === 'not_available' ? 'not_available' : 'not_started',
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
