import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { applyWorkflowControl } from '@/lib/visual-workflow/service';

export const dynamic = 'force-dynamic';

const ACTIONS = ['start', 'pause', 'resume', 'stop', 'emergency-stop', 'recover'] as const;
type ActionPath = (typeof ACTIONS)[number];

function toAction(value: ActionPath): 'start' | 'pause' | 'resume' | 'stop' | 'emergency_stop' | 'recover' {
  return value === 'emergency-stop' ? 'emergency_stop' : value;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workflowRunId: string; action: string }> },
) {
  const { workflowRunId, action: rawAction } = await context.params;
  if (!(ACTIONS as readonly string[]).includes(rawAction)) {
    return NextResponse.json({ error: 'Unknown control action.' }, { status: 404 });
  }

  const idempotencyKey = request.headers.get('Idempotency-Key')?.trim();
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'Idempotency-Key header is required.' }, { status: 400 });
  }

  const correlationId = request.headers.get('X-Correlation-Id')?.trim() || randomUUID();
  const body = (await request.json().catch(() => ({}))) as {
    reason?: string;
    expectedVersion?: number;
    confirmEmergencyStop?: boolean;
  };

  if (rawAction === 'emergency-stop' && body.confirmEmergencyStop !== true) {
    return NextResponse.json(
      { error: 'Emergency stop requires confirmEmergencyStop: true.' },
      { status: 400 },
    );
  }

  const existing = await prisma.idempotencyRecord.findUnique({ where: { key: idempotencyKey } });
  if (existing?.status === 'COMPLETED' && existing.responseJson) {
    return NextResponse.json(JSON.parse(existing.responseJson), {
      status: existing.statusCode || 200,
      headers: { 'Idempotent-Replay': 'true' },
    });
  }

  const result = await applyWorkflowControl({
    workflowRunId,
    action: toAction(rawAction as ActionPath),
    reason: body.reason,
    correlationId,
    expectedVersion: body.expectedVersion,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const payload = { workflowRunId, ...result };
  await prisma.idempotencyRecord.upsert({
    where: { key: idempotencyKey },
    create: {
      key: idempotencyKey,
      scope: `visual-workflows:${rawAction}`,
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
