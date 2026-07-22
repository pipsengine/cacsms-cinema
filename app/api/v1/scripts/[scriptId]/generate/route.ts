import { createHash, randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { classifyScriptFailure, runAutonomousScriptGeneration } from '@/lib/script-autonomy';

export async function POST(request: NextRequest, context: { params: Promise<{ scriptId: string }> }) {
  const idempotencyKey = request.headers.get('idempotency-key')?.trim();
  if (!idempotencyKey) return NextResponse.json({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Idempotency-Key header is required.' } }, { status: 400 });
  const { scriptId } = await context.params;
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const scope = `script-generate:${scriptId}`;
  const requestHash = createHash('sha256').update(scriptId).digest('hex');
  const existing = await prisma.idempotencyRecord.findUnique({ where: { key: idempotencyKey } });
  if (existing) {
    if (existing.scope !== scope || existing.requestHash !== requestHash) return NextResponse.json({ error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Key was used for another request.' } }, { status: 409 });
    if (existing.responseJson) return NextResponse.json(JSON.parse(existing.responseJson), { status: existing.statusCode || 200, headers: { 'Idempotent-Replay': 'true' } });
    return NextResponse.json({ error: { code: 'REQUEST_IN_PROGRESS', message: 'Generation is already in progress.' } }, { status: 409 });
  }
  await prisma.idempotencyRecord.create({ data: { key: idempotencyKey, scope, requestHash, correlationId, expiresAt: new Date(Date.now() + 86_400_000) } });
  try {
    const result = await runAutonomousScriptGeneration(scriptId, correlationId);
    const response = { ...result, correlationId };
    await prisma.idempotencyRecord.update({ where: { key: idempotencyKey }, data: { status: 'COMPLETED', statusCode: 200, responseJson: JSON.stringify(response) } });
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const response = { error: { code: classifyScriptFailure(message), message }, correlationId };
    await prisma.idempotencyRecord.update({ where: { key: idempotencyKey }, data: { status: 'COMPLETED', statusCode: 422, responseJson: JSON.stringify(response) } });
    return NextResponse.json(response, { status: 422 });
  }
}
