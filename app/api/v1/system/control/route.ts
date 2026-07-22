import { createHash, randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const ACTION_STATES = {
  start: 'RUNNING',
  pause: 'PAUSED',
  resume: 'RUNNING',
  stop: 'STOPPED',
  emergency_stop: 'EMERGENCY_STOP',
} as const;

export async function GET() {
  const control = await prisma.systemControl.findUnique({ where: { id: 'global' } });
  return NextResponse.json(control ?? {
    id: 'global',
    desiredState: 'STOPPED',
    reason: null,
    version: 0,
    updatedAt: null,
  });
}

export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get('idempotency-key');
  const correlationId = request.headers.get('x-correlation-id') ?? randomUUID();
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Idempotency-Key header is required.' }, correlationId },
      { status: 400 }
    );
  }

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: { code: 'INVALID_BODY', message: 'A JSON object is required.' }, correlationId }, { status: 400 });
  }
  const { action, reason } = body as Record<string, unknown>;
  if (typeof action !== 'string' || !(action in ACTION_STATES)) {
    return NextResponse.json({ error: { code: 'INVALID_ACTION', message: 'Unsupported system control action.' }, correlationId }, { status: 400 });
  }
  if (reason !== undefined && typeof reason !== 'string') {
    return NextResponse.json({ error: { code: 'INVALID_REASON', message: 'reason must be a string.' }, correlationId }, { status: 400 });
  }

  const scope = 'system-control';
  const requestHash = createHash('sha256').update(JSON.stringify({ action, reason: reason ?? null })).digest('hex');
  const existing = await prisma.idempotencyRecord.findUnique({ where: { key: idempotencyKey } });
  if (existing) {
    if (existing.scope !== scope || existing.requestHash !== requestHash) {
      return NextResponse.json({ error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Key was already used for a different request.' }, correlationId }, { status: 409 });
    }
    if (existing.status === 'COMPLETED' && existing.responseJson) {
      return NextResponse.json(JSON.parse(existing.responseJson), { status: existing.statusCode ?? 200 });
    }
    return NextResponse.json({ error: { code: 'REQUEST_IN_PROGRESS', message: 'The matching request is still processing.' }, correlationId }, { status: 409 });
  }

  const desiredState = ACTION_STATES[action as keyof typeof ACTION_STATES];
  try {
    const result = await prisma.$transaction(async (transaction) => {
      await transaction.idempotencyRecord.create({
        data: { key: idempotencyKey, scope, requestHash, correlationId, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      });
      const before = await transaction.systemControl.findUnique({ where: { id: 'global' } });
      const control = await transaction.systemControl.upsert({
        where: { id: 'global' },
        create: { id: 'global', desiredState, reason: typeof reason === 'string' ? reason : null, correlationId },
        update: { desiredState, reason: typeof reason === 'string' ? reason : null, correlationId, version: { increment: 1 } },
      });

      if (desiredState === 'EMERGENCY_STOP') {
        await transaction.job.updateMany({
          where: { status: { notIn: ['COMPLETED', 'FAILED', 'CANCELLED'] }, deletedAt: null },
          data: { cancelRequestedAt: new Date(), version: { increment: 1 } },
        });
      }

      await transaction.auditEvent.create({
        data: {
          actorType: 'OPERATOR',
          actorId: 'local-operator',
          action: `SYSTEM_${action.toUpperCase()}`,
          entityType: 'SystemControl',
          entityId: 'global',
          beforeJson: before ? JSON.stringify(before) : null,
          afterJson: JSON.stringify(control),
          correlationId,
          ipAddress: request.headers.get('x-forwarded-for'),
        },
      });
      await transaction.outboxEvent.create({
        data: {
          aggregateType: 'SystemControl',
          aggregateId: 'global',
          eventType: `System${action.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join('')}`,
          payloadJson: JSON.stringify({ desiredState, reason: reason ?? null }),
          correlationId,
        },
      });
      const response = { control, correlationId };
      await transaction.idempotencyRecord.update({
        where: { key: idempotencyKey },
        data: { status: 'COMPLETED', statusCode: 200, responseJson: JSON.stringify(response) },
      });
      return response;
    }, { maxWait: 10000, timeout: 30000 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('System control mutation failed:', error);
    return NextResponse.json({ error: { code: 'CONTROL_UPDATE_FAILED', message: 'System control could not be updated.' }, correlationId }, { status: 500 });
  }
}
