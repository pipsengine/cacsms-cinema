import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { applyWorkflowControl } from '@/lib/visual-workflow/service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workflowRunId: string; stageId: string }> },
) {
  const { workflowRunId, stageId } = await context.params;
  const idempotencyKey = request.headers.get('Idempotency-Key')?.trim();
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'Idempotency-Key header is required.' }, { status: 400 });
  }

  const correlationId = request.headers.get('X-Correlation-Id')?.trim() || randomUUID();
  const body = (await request.json().catch(() => ({}))) as { expectedVersion?: number; reason?: string };

  const existing = await prisma.idempotencyRecord.findUnique({ where: { key: idempotencyKey } });
  if (existing?.status === 'COMPLETED' && existing.responseJson) {
    return NextResponse.json(JSON.parse(existing.responseJson), {
      status: existing.statusCode || 200,
      headers: { 'Idempotent-Replay': 'true' },
    });
  }

  const result = await applyWorkflowControl({
    workflowRunId,
    action: 'retry',
    stageId,
    reason: body.reason || `Retry stage ${stageId}`,
    correlationId,
    expectedVersion: body.expectedVersion,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const payload = { workflowRunId, stageId, ...result };
  await prisma.idempotencyRecord.upsert({
    where: { key: idempotencyKey },
    create: {
      key: idempotencyKey,
      scope: `visual-workflows:retry:${stageId}`,
      requestHash: idempotencyKey,
      status: 'COMPLETED',
      statusCode: 200,
      responseJson: JSON.stringify(payload),
      correlationId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    update: {
      status: 'COMPLETED',
      statusCode: 200,
      responseJson: JSON.stringify(payload),
    },
  });

  return NextResponse.json(payload);
}
