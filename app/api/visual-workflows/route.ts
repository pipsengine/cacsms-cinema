import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import {
  ensureWorkflowRunForJob,
  findLatestWorkflowRunId,
  getWorkflowStatusSnapshot,
  reconcileWorkflowRun,
} from '@/lib/visual-workflow/service';

export const dynamic = 'force-dynamic';

/** List / resolve latest workflow run. Authorization-ready (deferred auth). */
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId');
  const jobId = request.nextUrl.searchParams.get('jobId');

  try {
    if (jobId) {
      const byJob = await prisma.visualWorkflowRun.findUnique({ where: { jobId } });
      if (byJob) {
        await reconcileWorkflowRun(byJob.id);
        const snapshot = await getWorkflowStatusSnapshot(byJob.id);
        return NextResponse.json(snapshot);
      }
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
      const ensured = await ensureWorkflowRunForJob({
        jobId: job.id,
        projectId: job.projectId,
        correlationId: job.correlationId,
      });
      await reconcileWorkflowRun(ensured.id);
      return NextResponse.json(await getWorkflowStatusSnapshot(ensured.id));
    }

    const latestId = await findLatestWorkflowRunId(projectId);
    if (!latestId) {
      return NextResponse.json({
        workflowRunId: null,
        overallStatus: 'NOT_STARTED',
        stages: [],
        message: 'No persisted visual workflow run exists yet.',
      });
    }
    await reconcileWorkflowRun(latestId);
    return NextResponse.json(await getWorkflowStatusSnapshot(latestId));
  } catch (error) {
    console.error('visual-workflows GET failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load visual workflow status.' }, { status: 503 });
  }
}

/** Create a workflow run for a project (optionally bound to an existing job). */
export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get('Idempotency-Key')?.trim();
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'Idempotency-Key header is required.' }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { projectId?: string; jobId?: string; scriptId?: string };
    if (!body.projectId || typeof body.projectId !== 'string') {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 });
    }

    const existingIdempotent = await prisma.idempotencyRecord.findUnique({ where: { key: idempotencyKey } });
    if (existingIdempotent?.status === 'COMPLETED' && existingIdempotent.responseJson) {
      return NextResponse.json(JSON.parse(existingIdempotent.responseJson), {
        status: existingIdempotent.statusCode || 200,
        headers: { 'Idempotent-Replay': 'true' },
      });
    }

    let jobId = body.jobId;
    if (!jobId) {
      const job = await prisma.job.create({
        data: {
          projectId: body.projectId,
          status: 'DISCOVER',
          idempotencyKey: `workflow:${idempotencyKey}`,
        },
      });
      jobId = job.id;
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.projectId !== body.projectId) {
      return NextResponse.json({ error: 'Job not found for project.' }, { status: 404 });
    }

    const ensured = await ensureWorkflowRunForJob({
      jobId: job.id,
      projectId: job.projectId,
      scriptId: body.scriptId,
      correlationId: request.headers.get('X-Correlation-Id') || randomUUID(),
    });
    await reconcileWorkflowRun(ensured.id);
    const snapshot = await getWorkflowStatusSnapshot(ensured.id);

    await prisma.idempotencyRecord.upsert({
      where: { key: idempotencyKey },
      create: {
        key: idempotencyKey,
        scope: 'visual-workflows:create',
        requestHash: idempotencyKey,
        status: 'COMPLETED',
        statusCode: ensured.created ? 201 : 200,
        responseJson: JSON.stringify(snapshot),
        correlationId: snapshot?.correlationId || randomUUID(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      update: {
        status: 'COMPLETED',
        statusCode: ensured.created ? 201 : 200,
        responseJson: JSON.stringify(snapshot),
      },
    });

    return NextResponse.json(snapshot, { status: ensured.created ? 201 : 200 });
  } catch (error) {
    console.error('visual-workflows POST failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to create visual workflow run.' }, { status: 500 });
  }
}
