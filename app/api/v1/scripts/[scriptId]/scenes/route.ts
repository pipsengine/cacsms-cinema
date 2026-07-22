import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest, context: { params: Promise<{ scriptId: string }> }) {
  const { scriptId } = await context.params;
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const result = await prisma.$transaction(async (transaction) => {
    const script = await transaction.script.findFirst({ where: { id: scriptId, deletedAt: null }, include: { scenes: { orderBy: { position: 'asc' }, include: { evidence: true } }, continuityIssues: true } });
    if (!script) return null;
    await transaction.scriptRevision.create({ data: { scriptId, version: script.version, snapshotJson: JSON.stringify(script), changeSummary: 'Scene added', actorType: 'OPERATOR', actorId: 'local-operator', correlationId } });
    const position = (script.scenes.at(-1)?.position || 0) + 1;
    const scene = await transaction.scriptScene.create({ data: { scriptId, position, sceneNumber: String(position).padStart(2, '0'), title: 'Untitled Scene', narrativeBeat: 'Context', durationSec: 60 } });
    await transaction.script.update({ where: { id: scriptId }, data: { version: { increment: 1 }, status: 'DRAFT' } });
    await transaction.outboxEvent.create({ data: { aggregateType: 'Script', aggregateId: scriptId, eventType: 'ScriptSceneAdded', payloadJson: JSON.stringify({ scriptId, sceneId: scene.id, position }), correlationId } });
    return scene;
  }, { timeout: 30_000 });
  if (!result) return NextResponse.json({ error: { code: 'SCRIPT_NOT_FOUND', message: 'Script not found.' } }, { status: 404 });
  return NextResponse.json(result, { status: 201 });
}
