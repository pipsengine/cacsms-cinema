import { createHash } from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { prisma } from './db';
import { calculateSceneReadiness } from './script-metrics';

interface GeneratedScene {
  title: string;
  purpose: string;
  narrativeBeat: string;
  narration: string;
  visualIntention: string;
  locationPeriod: string;
  emotionalDirection: string;
  cameraDirection: string;
  soundDirection: string;
  durationSec: number;
}

interface GeneratedScreenplay {
  logline: string;
  genre: string;
  scenes: GeneratedScene[];
  continuityIssues?: Array<{ scenePosition?: number; code: string; severity: string; description: string; recommendedAction: string }>;
}

function requireText(value: unknown, field: string, maxLength = 20_000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) throw new Error(`SCRIPT_OUTPUT_INVALID: ${field} is invalid.`);
  return value.trim();
}

function parseScreenplay(raw: string): GeneratedScreenplay {
  let value: Record<string, unknown>;
  try { value = JSON.parse(raw) as Record<string, unknown>; } catch { throw new Error('SCRIPT_OUTPUT_INVALID: Provider response was not JSON.'); }
  if (!Array.isArray(value.scenes) || value.scenes.length < 1 || value.scenes.length > 50) throw new Error('SCRIPT_OUTPUT_INVALID: scenes must contain 1 to 50 items.');
  const scenes = value.scenes.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`SCRIPT_OUTPUT_INVALID: scene ${index + 1} is invalid.`);
    const scene = item as Record<string, unknown>;
    const durationSec = Number(scene.durationSec);
    if (!Number.isInteger(durationSec) || durationSec < 10 || durationSec > 900) throw new Error(`SCRIPT_OUTPUT_INVALID: scene ${index + 1} duration is invalid.`);
    return {
      title: requireText(scene.title, 'title', 500), purpose: requireText(scene.purpose, 'purpose'), narrativeBeat: requireText(scene.narrativeBeat, 'narrativeBeat', 200),
      narration: requireText(scene.narration, 'narration'), visualIntention: requireText(scene.visualIntention, 'visualIntention'),
      locationPeriod: requireText(scene.locationPeriod, 'locationPeriod'), emotionalDirection: requireText(scene.emotionalDirection, 'emotionalDirection'),
      cameraDirection: requireText(scene.cameraDirection, 'cameraDirection'), soundDirection: requireText(scene.soundDirection, 'soundDirection'), durationSec,
    };
  });
  const continuityIssues = Array.isArray(value.continuityIssues) ? value.continuityIssues.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const issue = item as Record<string, unknown>;
    if (typeof issue.code !== 'string' || typeof issue.description !== 'string' || typeof issue.recommendedAction !== 'string') return [];
    return [{ scenePosition: typeof issue.scenePosition === 'number' ? issue.scenePosition : undefined, code: issue.code, severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(issue.severity)) ? String(issue.severity) : 'MEDIUM', description: issue.description, recommendedAction: issue.recommendedAction }];
  }) : [];
  return { logline: requireText(value.logline, 'logline'), genre: requireText(value.genre, 'genre', 200), scenes, continuityIssues };
}

export async function runAutonomousScriptGeneration(scriptId: string, correlationId: string) {
  const script = await prisma.script.findUnique({ where: { id: scriptId }, include: { project: true, scenes: { orderBy: { position: 'asc' }, include: { evidence: true } }, continuityIssues: true } });
  if (!script || script.deletedAt) throw new Error('SCRIPT_NOT_FOUND');
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_SCRIPT_MODEL || 'gemini-2.5-flash';
  const input = JSON.stringify({ title: script.title, logline: script.logline, genre: script.genre, targetDurationSec: script.targetDurationSec, project: { name: script.project.name, description: script.project.description }, existingScenes: script.scenes });
  const run = await prisma.scriptAutomationRun.create({ data: { scriptId, status: 'RUNNING', stage: 'GENERATE_AND_VALIDATE', providerId: 'google-gemini', modelId: model, inputHash: createHash('sha256').update(input).digest('hex'), correlationId, startedAt: new Date() } });
  try {
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') throw new Error('PROVIDER_NOT_CONFIGURED: GEMINI_API_KEY is missing.');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: `Create a production-ready screenplay structure from this persisted brief. Return JSON only with logline, genre, scenes, and continuityIssues. Every scene must include title, purpose, narrativeBeat, narration, visualIntention, locationPeriod, emotionalDirection, cameraDirection, soundDirection, and integer durationSec. Preserve supplied facts, do not invent citations, make total duration close to target, and list uncertainty or continuity problems instead of hiding them.\nINPUT:\n${input}` }] }],
      config: { responseMimeType: 'application/json', temperature: 0.25 },
    });
    if (!response.text) throw new Error('SCRIPT_PROVIDER_EMPTY_RESPONSE');
    const generated = parseScreenplay(response.text);
    const completedAt = new Date();
    const result = await prisma.$transaction(async (transaction) => {
      const nextVersion = script.version + 1;
      await transaction.scriptRevision.create({ data: { scriptId, version: script.version, snapshotJson: JSON.stringify(script), changeSummary: 'Snapshot before autonomous screenplay generation', actorType: 'SYSTEM', actorId: 'script-autonomy', correlationId } });
      await transaction.scriptContinuityIssue.deleteMany({ where: { scriptId } });
      await transaction.scriptScene.deleteMany({ where: { scriptId } });
      const createdScenes = [];
      for (let index = 0; index < generated.scenes.length; index += 1) {
        const scene = generated.scenes[index];
        createdScenes.push(await transaction.scriptScene.create({ data: { scriptId, position: index + 1, sceneNumber: String(index + 1).padStart(2, '0'), ...scene, status: 'DRAFT', readinessScore: calculateSceneReadiness(scene) } }));
      }
      for (const issue of generated.continuityIssues || []) {
        const scene = issue.scenePosition ? createdScenes[issue.scenePosition - 1] : undefined;
        await transaction.scriptContinuityIssue.create({ data: { scriptId, sceneId: scene?.id, code: issue.code, severity: issue.severity, description: issue.description, recommendedAction: issue.recommendedAction } });
      }
      await transaction.script.update({ where: { id: scriptId }, data: { logline: generated.logline, genre: generated.genre, version: nextVersion, status: 'DRAFT' } });
      await transaction.scriptAutomationRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', stage: 'COMPLETED', outputJson: JSON.stringify({ sceneCount: createdScenes.length, continuityIssueCount: generated.continuityIssues?.length || 0 }), completedAt } });
      await transaction.auditEvent.create({ data: { actorType: 'SYSTEM', actorId: 'script-autonomy', action: 'SCRIPT_AUTONOMOUS_GENERATION_COMPLETED', entityType: 'Script', entityId: scriptId, afterJson: JSON.stringify({ version: nextVersion, scenes: createdScenes.length }), correlationId } });
      await transaction.outboxEvent.create({ data: { aggregateType: 'Script', aggregateId: scriptId, eventType: 'ScriptGenerated', payloadJson: JSON.stringify({ scriptId, version: nextVersion, sceneCount: createdScenes.length }), correlationId } });
      return { runId: run.id, scriptId, version: nextVersion, sceneCount: createdScenes.length };
    }, { timeout: 60_000 });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failureCode = classifyScriptFailure(message);
    await prisma.$transaction([
      prisma.scriptAutomationRun.update({ where: { id: run.id }, data: { status: 'HUMAN_EXCEPTION_REQUIRED', stage: 'FAILED', failureCode, errorJson: JSON.stringify({ message }), completedAt: new Date() } }),
      prisma.auditEvent.create({ data: { actorType: 'SYSTEM', actorId: 'script-autonomy', action: 'SCRIPT_AUTONOMOUS_GENERATION_FAILED', entityType: 'Script', entityId: scriptId, afterJson: JSON.stringify({ failureCode, message }), correlationId } }),
      prisma.outboxEvent.create({ data: { aggregateType: 'Script', aggregateId: scriptId, eventType: 'ScriptHumanExceptionRequired', payloadJson: JSON.stringify({ scriptId, failureCode }), correlationId } }),
    ]);
    throw error;
  }
}

export function classifyScriptFailure(message: string): string {
  if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) return 'PROVIDER_API_KEY_INVALID';
  if (message.startsWith('PROVIDER_NOT_CONFIGURED')) return 'PROVIDER_NOT_CONFIGURED';
  if (message.startsWith('SCRIPT_OUTPUT_INVALID')) return 'SCRIPT_OUTPUT_INVALID';
  if (message.startsWith('SCRIPT_PROVIDER_EMPTY_RESPONSE')) return 'SCRIPT_PROVIDER_EMPTY_RESPONSE';
  return 'SCRIPT_AUTOMATION_FAILED';
}
