import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateSceneReadiness } from '@/lib/script-metrics';

const textFields = ['title', 'purpose', 'narrativeBeat', 'narration', 'visualIntention', 'locationPeriod', 'emotionalDirection', 'cameraDirection', 'soundDirection'] as const;

export async function PATCH(request: NextRequest, context: { params: Promise<{ scriptId: string; sceneId: string }> }) {
  const { scriptId, sceneId } = await context.params;
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: { code: 'INVALID_SCENE', message: 'A JSON body is required.' } }, { status: 400 });
  const data: Record<string, string | number> = {};
  for (const field of textFields) {
    if (typeof body[field] !== 'string' || (body[field] as string).length > 20_000) return NextResponse.json({ error: { code: 'INVALID_SCENE', message: `${field} must be a string.` } }, { status: 400 });
    data[field] = (body[field] as string).trim();
  }
  if (typeof body.durationSec !== 'number' || !Number.isInteger(body.durationSec) || body.durationSec < 1 || body.durationSec > 3600) return NextResponse.json({ error: { code: 'INVALID_SCENE', message: 'durationSec must be between 1 and 3600.' } }, { status: 400 });
  data.durationSec = body.durationSec;
  const readinessScore = calculateSceneReadiness(data as unknown as Parameters<typeof calculateSceneReadiness>[0]);
  const result = await prisma.$transaction(async (transaction) => {
    const script = await transaction.script.findFirst({ where: { id: scriptId, deletedAt: null }, include: { scenes: { orderBy: { position: 'asc' }, include: { evidence: true } }, continuityIssues: true } });
    const existing = script?.scenes.find((scene) => scene.id === sceneId);
    if (!script || !existing) return null;
    if (typeof body.version === 'number' && existing.version !== body.version) throw new Error('SCENE_VERSION_CONFLICT');
    await transaction.scriptRevision.create({ data: { scriptId, version: script.version, snapshotJson: JSON.stringify(script), changeSummary: `Updated scene ${existing.sceneNumber}`, actorType: 'OPERATOR', actorId: 'local-operator', correlationId } });
    const scene = await transaction.scriptScene.update({ where: { id: sceneId }, data: { ...data, readinessScore, version: { increment: 1 }, staleAt: new Date() } });
    await transaction.script.update({ where: { id: scriptId }, data: { version: { increment: 1 }, status: 'DRAFT' } });
    await transaction.outboxEvent.create({ data: { aggregateType: 'Script', aggregateId: scriptId, eventType: 'ScriptSceneUpdated', payloadJson: JSON.stringify({ scriptId, sceneId, readinessScore, downstreamAssetsStale: true }), correlationId } });
    return scene;
  }, { timeout: 30_000 }).catch((error) => {
    if (error instanceof Error && error.message === 'SCENE_VERSION_CONFLICT') return 'CONFLICT' as const;
    throw error;
  });
  if (result === 'CONFLICT') return NextResponse.json({ error: { code: 'SCENE_VERSION_CONFLICT', message: 'This scene was modified elsewhere. Reload before saving.' } }, { status: 409 });
  if (!result) return NextResponse.json({ error: { code: 'SCENE_NOT_FOUND', message: 'Scene not found.' } }, { status: 404 });
  return NextResponse.json(result);
}
