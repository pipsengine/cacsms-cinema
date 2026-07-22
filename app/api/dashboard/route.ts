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
      failedAttempts,
      recentJobs,
    ] = await Promise.all([
      prisma.project.count(),
      prisma.job.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.asset.count({ where: { status: 'APPROVED' } }),
      prisma.candidate.count(),
      prisma.generationAttempt.aggregate({
        _count: { _all: true },
        _sum: { cost: true },
        _avg: { durationMs: true },
      }),
      prisma.generationAttempt.count({ where: { status: 'SUCCESS' } }),
      prisma.generationAttempt.count({ where: { status: 'FAILED' } }),
      prisma.job.findMany({
        take: 8,
        orderBy: { updatedAt: 'desc' },
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
    ]);

    const queue = Object.fromEntries(
      statusGroups.map((group) => [group.status, group._count._all])
    );
    const activeJobs = statusGroups
      .filter((group) => !['COMPLETED', 'FAILED'].includes(group.status))
      .reduce((total, group) => total + group._count._all, 0);
    const completedJobs = queue.COMPLETED ?? 0;
    const totalAttempts = attemptSummary._count._all;

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      system: {
        api: 'operational',
        database: 'connected',
        isHealthy: failedAttempts === 0 || failedAttempts / Math.max(totalAttempts, 1) < 0.1,
      },
      metrics: {
        projects: projectCount,
        activeJobs,
        completedJobs,
        approvedAssets: approvedAssetCount,
        candidates: candidateCount,
        totalAttempts,
        successRate: totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0,
        averageLatencyMs: attemptSummary._avg.durationMs ?? 0,
        totalCost: attemptSummary._sum.cost ?? 0,
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
