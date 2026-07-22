import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isJobStatus } from '@/lib/job-status';

// GET all jobs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const projectId = searchParams.get('projectId');

    const jobs = await prisma.job.findMany({
      where: {
        ...(status && { status }),
        ...(projectId && { projectId }),
      },
      include: {
        project: true,
        attempts: true,
        candidates: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(jobs);
  } catch (error) {
    console.error('Failed to fetch jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

// POST create new job
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    }

    const { projectId, sceneId, status = 'DISCOVER', budget, priority = 0 } = body as Record<string, unknown>;

    if (typeof projectId !== 'string' || !projectId.trim()) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }
    if (sceneId !== undefined && typeof sceneId !== 'string') {
      return NextResponse.json({ error: 'sceneId must be a string' }, { status: 400 });
    }
    if (!isJobStatus(status)) {
      return NextResponse.json({ error: 'Invalid job status' }, { status: 400 });
    }
    if (budget !== undefined && (typeof budget !== 'number' || !Number.isFinite(budget) || budget < 0)) {
      return NextResponse.json({ error: 'budget must be a non-negative number' }, { status: 400 });
    }
    if (typeof priority !== 'number' || !Number.isInteger(priority)) {
      return NextResponse.json({ error: 'priority must be an integer' }, { status: 400 });
    }

    const job = await prisma.job.create({
      data: {
        projectId,
        sceneId,
        status,
        budget,
        priority,
      },
      include: {
        project: true,
        attempts: true,
        candidates: true,
      },
    });

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    console.error('Failed to create job:', error);
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    );
  }
}
