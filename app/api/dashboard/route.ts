import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [
      projectCount,
      statusGroups,
      approvedAssetCount,
      candidateCount,
      attemptSummary,
      successfulAttempts,
      recentJobs,
      control,
      evaluationSummary,
      fileValidationCount,
      failedFileValidationCount,
      rejectedCandidateCount,
      repairInProgressCount,
      criticalDefectCount,
      continuityDefectCount,
      geographyDefectCount,
    ] = await Promise.all([
      prisma.project.count({ where: { deletedAt: null } }),
      prisma.job.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.asset.count({ where: { status: 'APPROVED' } }),
      prisma.candidate.count(),
      prisma.generationAttempt.aggregate({
        _count: { _all: true },
        _sum: { cost: true },
        _avg: { durationMs: true },
      }),
      prisma.generationAttempt.count({ where: { status: 'SUCCESS' } }),
      prisma.job.findMany({
        take: 8,
        orderBy: { updatedAt: 'desc' },
        where: { deletedAt: null },
        include: {
          project: { select: { name: true } },
          attempts: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { providerUsed: true, durationMs: true, status: true },
          },
          _count: { select: { candidates: true, attempts: true } },
        },
      }),
      prisma.systemControl.findUnique({ where: { id: 'global' } }),
      prisma.qualityEvaluation.aggregate({ _avg: { score: true } }),
      prisma.fileValidation.count(),
      prisma.fileValidation.count({ where: { passed: false } }),
      prisma.candidate.count({ where: { status: 'REJECTED' } }),
      prisma.repairAction.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      prisma.imageDefect.count({ where: { severity: 'CRITICAL', status: 'OPEN' } }),
      prisma.imageDefect.count({ where: { code: { contains: 'CONTINUITY' }, status: 'OPEN' } }),
      prisma.imageDefect.count({ where: { code: { contains: 'GEOGRAPH' }, status: 'OPEN' } }),
    ]);

    const queue = Object.fromEntries(
      statusGroups.map((group) => [group.status, group._count._all])
    );
    const terminalStatuses = ['COMPLETED', 'FAILED', 'CANCELLED', 'HUMAN_EXCEPTION_REQUIRED'];
    const activeJobs = statusGroups
      .filter((group) => group.status.startsWith('PROCESSING:'))
      .reduce((total, group) => total + group._count._all, 0);
    const queuedJobs = statusGroups
      .filter((group) => !terminalStatuses.includes(group.status) && !group.status.startsWith('PROCESSING:'))
      .reduce((total, group) => total + group._count._all, 0);
    const completedJobs = queue.COMPLETED ?? 0;
    const exceptionJobs = queue.HUMAN_EXCEPTION_REQUIRED ?? 0;
    const totalAttempts = attemptSummary._count._all;

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      system: {
        api: 'operational',
        database: 'connected',
        isHealthy: true,
        controlState: control?.desiredState ?? 'STOPPED',
        controlVersion: control?.version ?? 0,
        controlUpdatedAt: control?.updatedAt.toISOString() ?? null,
      },
      metrics: {
        projects: projectCount,
        activeJobs,
        queuedJobs,
        completedJobs,
        exceptionJobs,
        approvedAssets: approvedAssetCount,
        candidates: candidateCount,
        totalAttempts,
        successRate: totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0,
        averageLatencyMs: attemptSummary._avg.durationMs ?? 0,
        totalCost: attemptSummary._sum.cost ?? 0,
        blankImageRate: fileValidationCount > 0 ? (failedFileValidationCount / fileValidationCount) * 100 : null,
        averageQuality: evaluationSummary._avg.score !== null ? evaluationSummary._avg.score * 100 : null,
      },
      quality: {
        criticalFailures: Math.max(criticalDefectCount, exceptionJobs),
        repairsInProgress: repairInProgressCount,
        rejectedCandidates: rejectedCandidateCount,
        continuityViolations: continuityDefectCount,
        geographicFailures: geographyDefectCount,
      },
      queue,
      recentJobs: recentJobs.map((job) => ({
        id: job.id,
        sceneId: job.sceneId,
        projectName: job.project.name,
        status: job.status,
        priority: job.priority,
        updatedAt: job.updatedAt.toISOString(),
        attemptCount: job._count.attempts,
        candidateCount: job._count.candidates,
        provider: job.attempts[0]?.providerUsed ?? null,
        latestAttemptStatus: job.attempts[0]?.status ?? null,
        failureCode: job.failureCode,
        evidence: job.failureCode ? 'Human exception required' : job.status === 'COMPLETED' ? 'Delivery verified' : 'Stage evidence persisted',
      })),
    });
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    return NextResponse.json(
      { error: 'Dashboard data is unavailable', correlationId: crypto.randomUUID() },
      { status: 503 }
    );
  }
}
