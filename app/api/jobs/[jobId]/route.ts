import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { jobId } = await params;
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        project: true,
        stageExecutions: { orderBy: { createdAt: 'asc' } },
        attempts: { orderBy: { createdAt: 'asc' } },
        candidates: { include: { fileValidations: true, evaluations: true, defects: true, assets: { include: { versions: true } } } },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error('Failed to fetch job:', error);
    return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { jobId } = await params;
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    }

    const { status, budget, priority } = body as Record<string, unknown>;
    if (status !== undefined) return NextResponse.json({ error: 'Lifecycle status is worker-managed and cannot be patched.' }, { status: 400 });
    if (budget !== undefined && (typeof budget !== 'number' || !Number.isFinite(budget) || budget < 0)) {
      return NextResponse.json({ error: 'budget must be a non-negative number' }, { status: 400 });
    }
    if (priority !== undefined && (typeof priority !== 'number' || !Number.isInteger(priority))) {
      return NextResponse.json({ error: 'priority must be an integer' }, { status: 400 });
    }

    const job = await prisma.job.update({
      where: { id: jobId },
      data: {
        ...(budget !== undefined && { budget }),
        ...(priority !== undefined && { priority }),
      },
      include: {
        project: true,
        attempts: true,
        candidates: true,
      },
    });

    return NextResponse.json(job);
  } catch (error) {
    console.error('Failed to update job:', error);
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { jobId } = await params;
    await prisma.job.update({ where: { id: jobId }, data: { cancelRequestedAt: new Date(), deletedAt: new Date(), version: { increment: 1 } } });
    return NextResponse.json({ message: 'Job cancellation and soft deletion recorded.' });
  } catch (error) {
    console.error('Failed to delete job:', error);
    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 });
  }
}
