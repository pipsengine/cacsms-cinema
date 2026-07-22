import { createHash, randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const includeScript = {
  project: { select: { id: true, name: true, description: true } },
  scenes: { orderBy: { position: 'asc' as const }, include: { evidence: true, continuityIssues: true } },
  continuityIssues: { orderBy: { createdAt: 'desc' as const } },
  automationRuns: { take: 5, orderBy: { createdAt: 'desc' as const } },
};

export async function GET() {
  const scripts = await prisma.script.findMany({ where: { deletedAt: null }, include: includeScript, orderBy: { updatedAt: 'desc' } });
  return NextResponse.json(scripts);
}

export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get('idempotency-key')?.trim();
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  if (!idempotencyKey) return NextResponse.json({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Idempotency-Key header is required.' } }, { status: 400 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.projectId !== 'string' || !body.projectId.trim() || typeof body.title !== 'string' || !body.title.trim()) return NextResponse.json({ error: { code: 'INVALID_SCRIPT', message: 'projectId and title are required.' } }, { status: 400 });
  const requestHash = createHash('sha256').update(JSON.stringify({ projectId: body.projectId, title: body.title, targetDurationSec: body.targetDurationSec ?? 900 })).digest('hex');
  const existing = await prisma.idempotencyRecord.findUnique({ where: { key: idempotencyKey } });
  if (existing?.responseJson) {
    const replay = JSON.parse(existing.responseJson) as { id?: string };
    const script = replay.id ? await prisma.script.findUnique({ where: { id: replay.id }, include: includeScript }) : null;
    if (script) return NextResponse.json(script, { status: existing.statusCode || 200, headers: { 'Idempotent-Replay': 'true' } });
  }
  if (existing) return NextResponse.json({ error: { code: 'REQUEST_IN_PROGRESS', message: 'Matching request is in progress.' } }, { status: 409 });
  const targetDurationSec = typeof body.targetDurationSec === 'number' && Number.isInteger(body.targetDurationSec) && body.targetDurationSec >= 60 && body.targetDurationSec <= 21_600 ? body.targetDurationSec : 900;
  try {
    const script = await prisma.$transaction(async (transaction) => {
      await transaction.idempotencyRecord.create({ data: { key: idempotencyKey, scope: 'script-create', requestHash, correlationId, expiresAt: new Date(Date.now() + 86_400_000) } });
      const created = await transaction.script.create({ data: { projectId: body.projectId as string, title: (body.title as string).trim(), targetDurationSec, scenes: { create: { position: 1, sceneNumber: '01', title: 'Untitled Scene', narrativeBeat: 'Opening hook', durationSec: 60 } } }, include: includeScript });
      await transaction.auditEvent.create({ data: { actorType: 'OPERATOR', actorId: 'local-operator', action: 'SCRIPT_CREATED', entityType: 'Script', entityId: created.id, afterJson: JSON.stringify({ title: created.title, projectId: created.projectId }), correlationId } });
      await transaction.outboxEvent.create({ data: { aggregateType: 'Script', aggregateId: created.id, eventType: 'ScriptCreated', payloadJson: JSON.stringify({ scriptId: created.id, projectId: created.projectId }), correlationId } });
      await transaction.idempotencyRecord.update({ where: { key: idempotencyKey }, data: { status: 'COMPLETED', statusCode: 201, responseJson: JSON.stringify({ id: created.id }) } });
      return created;
    }, { timeout: 30_000 });
    return NextResponse.json(script, { status: 201 });
  } catch (error) {
    console.error('Script creation failed:', error);
    return NextResponse.json({ error: { code: 'SCRIPT_CREATE_FAILED', message: 'Script could not be created.' }, correlationId }, { status: 500 });
  }
}
