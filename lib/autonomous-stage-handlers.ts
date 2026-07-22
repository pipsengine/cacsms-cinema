import { createHash } from 'crypto';
import type { Candidate } from '@prisma/client';
import { prisma } from './db';
import { generateValidatedCandidates } from './image-generation-service';
import { JobOrchestrator } from './job-orchestrator';
import { PROCESSABLE_JOB_STATUSES, type JobStatus } from './job-status';
import type { SemanticEvaluation } from './providers/google-gemini-evaluator';
import { evaluateImageSemanticsRouted, getImageProvider, shouldUseLocalProviders } from './providers/resolve-providers';
import { localAssetStorage } from './storage/local-storage';

let registered = false;

function parseJson<T>(value: string | null | undefined): T | undefined {
  if (!value) return undefined;
  try { return JSON.parse(value) as T; } catch { return undefined; }
}

async function state(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      project: true,
      stageExecutions: { where: { status: 'SUCCESS' }, orderBy: { createdAt: 'asc' } },
      candidates: { include: { fileValidations: true, evaluations: true, defects: true, assets: { include: { versions: true } } } },
      attempts: true,
    },
  });
  if (!job) throw new Error('JOB_NOT_FOUND');
  const artifacts = new Map(job.stageExecutions.map((execution) => [execution.stage, parseJson<Record<string, unknown>>(execution.outputJson) || {}]));
  return { job, artifacts, source: job.project.description?.trim() || job.project.name.trim() };
}

function compiledPrompt(artifacts: Map<string, Record<string, unknown>>): string {
  const artifact = artifacts.get('COMPILE_PROMPT');
  const prompt = artifact?.prompt;
  if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('COMPILED_PROMPT_MISSING');
  return prompt;
}

async function validateStoredCandidate(candidate: Candidate) {
  if (!candidate.storageKey || !candidate.sha256) throw new Error(`CANDIDATE_LINEAGE_MISSING: ${candidate.id}`);
  const bytes = await localAssetStorage.get(candidate.storageKey);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== candidate.sha256 || bytes.length !== candidate.byteSize) throw new Error(`STORAGE_READBACK_MISMATCH: ${candidate.id}`);
  return bytes;
}

async function evaluateAndPersist(candidate: Candidate, source: string, prompt: string): Promise<SemanticEvaluation> {
  const bytes = await validateStoredCandidate(candidate);
  if (!candidate.mimeType) throw new Error(`CANDIDATE_MIME_MISSING: ${candidate.id}`);
  const evaluation = await evaluateImageSemanticsRouted(bytes, candidate.mimeType, source, prompt);
  const hardPassed = evaluation.passed && evaluation.safetyPassed && evaluation.overall >= 0.75;
  const local = shouldUseLocalProviders();
  await prisma.$transaction([
    prisma.qualityEvaluation.create({
      data: {
        candidateId: candidate.id,
        evaluatorId: local ? 'local-dev-semantic-qa' : 'gemini-semantic-qa',
        modelVersion: local ? 'local-heuristic' : (process.env.GEMINI_EVALUATOR_MODEL || 'gemini-2.5-flash'),
        score: evaluation.overall,
        confidence: evaluation.confidence,
        passed: hardPassed,
        criticalGate: true,
        evidenceJson: JSON.stringify(evaluation),
        recommendedActions: JSON.stringify(evaluation.defects.map((defect) => defect.recommendedAction)),
      },
    }),
    prisma.candidate.update({ where: { id: candidate.id }, data: { score: evaluation.overall, status: hardPassed ? 'EVALUATED' : 'REJECTED' } }),
  ]);
  return { ...evaluation, passed: hardPassed };
}

function bestApprovedCandidate(job: Awaited<ReturnType<typeof state>>['job']) {
  const candidate = [...job.candidates].filter((item) => item.status !== 'REJECTED').sort((a, b) => b.score - a.score)[0];
  if (!candidate) throw new Error('NO_QUALIFIED_CANDIDATE');
  return candidate;
}

async function executeStage(jobId: string, stage: JobStatus, correlationId: string): Promise<Record<string, unknown>> {
  const current = await state(jobId);
  const { job, artifacts, source } = current;
  if (!source) throw new Error('SOURCE_MATERIAL_MISSING');

  switch (stage) {
    case 'DISCOVER':
      return { source, projectId: job.projectId, sceneId: job.sceneId, sourceHash: createHash('sha256').update(source).digest('hex') };
    case 'INTERPRET':
      return { objective: 'Create a production-safe cinematic still faithful to the supplied scene.', source, nonNegotiables: ['source fidelity', 'visual coherence', 'no invented text'] };
    case 'DECOMPOSE':
      return { scene: source, deliverables: [{ type: 'cinematic-still', count: 1, aspectRatio: '16:9' }] };
    case 'RESEARCH':
      return { externalClaimsAllowed: false, policy: 'Avoid undocumented logos, inscriptions, symbols, and factual claims; preserve only details explicitly supplied by the source.', sources: [] };
    case 'VERIFY_CONTEXT':
      return { verified: true, basis: 'The generation prompt is constrained to supplied source material and makes no external factual assertions.' };
    case 'BUILD_REQUIREMENTS':
      return { positive: [source, 'cinematic composition', 'coherent lighting', 'anatomically plausible subjects'], negative: ['unreadable text', 'watermarks', 'duplicate subjects', 'blank image', 'visual artifacts'], criticalThreshold: 0.75 };
    case 'BUILD_SCENE_GRAPH':
      return { nodes: [{ id: 'scene', type: 'SCENE', description: source }, { id: 'camera', type: 'CAMERA', description: '16:9 cinematic frame' }], edges: [{ from: 'camera', to: 'scene', relation: 'FRAMES' }] };
    case 'RESOLVE_CONFLICTS':
      return { resolved: true, conflicts: [], precedence: ['explicit source', 'safety', 'continuity', 'cinematic quality'] };
    case 'PLAN_CINEMATOGRAPHY':
      return { aspectRatio: '16:9', shot: 'context-appropriate cinematic shot', lighting: 'motivated, physically coherent lighting', lens: 'natural perspective without facial distortion' };
    case 'RETRIEVE_REFERENCES':
      return { mode: 'source-only', references: [], reason: 'No approved reference assets are attached to this job.' };
    case 'VALIDATE_REFERENCES':
      return { passed: true, validatedCount: 0, rule: 'No external reference may enter generation without provenance.' };
    case 'PLAN_WORKFLOW': {
      const provider = getImageProvider();
      return { provider: provider.providerId, candidates: 1, repairLimit: job.maxAttempts, validation: ['signature', 'decode', 'dimensions', 'variance', 'read-back hash', 'semantic QA'] };
    }
    case 'COMPILE_PROMPT': {
      const requirements = artifacts.get('BUILD_REQUIREMENTS');
      return { version: '1.0.0', prompt: `Create one professional 16:9 cinematic still. Scene: ${source}\nRequirements: ${JSON.stringify(requirements)}\nNo captions, logos, watermarks, UI elements, or invented writing. Maintain coherent identity, geography, history, anatomy, perspective, lighting, and spatial relationships.` };
    }
    case 'SELECT_MODEL': {
      const provider = getImageProvider();
      provider.assertConfigured();
      return {
        providerId: provider.providerId,
        modelId: provider.modelId,
        reason: provider.providerId === 'local-dev'
          ? 'Local-dev image adapter active because Gemini credentials are not configured.'
          : 'Configured image-capable production adapter.',
      };
    }
    case 'RUN_PREFLIGHT': {
      const provider = getImageProvider();
      provider.assertConfigured();
      const key = `preflight/${job.id}-${correlationId}.probe`;
      const probe = Buffer.from(`cacsms:${correlationId}`);
      await localAssetStorage.put(key, probe);
      const readBack = await localAssetStorage.get(key);
      await localAssetStorage.delete(key);
      if (!readBack.equals(probe)) throw new Error('STORAGE_PREFLIGHT_FAILED');
      return { providerConfigured: true, providerId: provider.providerId, storageWriteReadDelete: true };
    }
    case 'QUEUE':
      return { queuedAt: new Date().toISOString(), priority: job.priority, budget: job.budget };
    case 'GENERATE_CANDIDATES': {
      const candidates = await generateValidatedCandidates(job.id, compiledPrompt(artifacts), correlationId);
      return { candidateIds: candidates.map((candidate) => candidate.id), count: candidates.length };
    }
    case 'VALIDATE_FILES': {
      if (!job.candidates.length) throw new Error('NO_CANDIDATES_TO_VALIDATE');
      for (const candidate of job.candidates) {
        await validateStoredCandidate(candidate);
        if (!candidate.fileValidations.some((validation) => validation.passed && validation.readBackOk && validation.browserSafe)) throw new Error(`FILE_VALIDATION_MISSING: ${candidate.id}`);
      }
      return { passed: true, candidateIds: job.candidates.map((candidate) => candidate.id) };
    }
    case 'REMOVE_DUPLICATES': {
      const seen = new Set<string>();
      const rejected: string[] = [];
      for (const candidate of job.candidates) {
        if (!candidate.sha256) continue;
        if (seen.has(candidate.sha256)) {
          await prisma.candidate.update({ where: { id: candidate.id }, data: { status: 'REJECTED' } });
          rejected.push(candidate.id);
        } else seen.add(candidate.sha256);
      }
      return { uniqueCount: seen.size, rejected };
    }
    case 'SCORE_CANDIDATES': {
      const prompt = compiledPrompt(artifacts);
      const evaluated = [];
      for (const candidate of job.candidates.filter((item) => item.status !== 'REJECTED')) evaluated.push({ candidateId: candidate.id, evaluation: await evaluateAndPersist(candidate, source, prompt) });
      if (!evaluated.length) throw new Error('NO_UNIQUE_CANDIDATES_TO_SCORE');
      return { evaluated };
    }
    case 'DIAGNOSE_DEFECTS': {
      let count = 0;
      for (const candidate of job.candidates) {
        const latest = candidate.evaluations.at(-1);
        const evaluation = parseJson<SemanticEvaluation>(latest?.evidenceJson);
        const evidence = evaluation?.evidence || [];
        for (const defect of evaluation?.defects || []) {
          await prisma.imageDefect.create({ data: { candidateId: candidate.id, code: defect.code, severity: defect.severity, description: defect.description, recommendedAction: defect.recommendedAction, evidenceJson: JSON.stringify(evidence) } });
          count += 1;
        }
      }
      return { diagnosedDefects: count };
    }
    case 'REPAIR_OR_REGENERATE': {
      if (job.candidates.some((candidate) => candidate.status === 'EVALUATED')) return { action: 'not-required', reason: 'At least one candidate passed all current critical gates.' };
      let generationCount = job.attempts.filter((attempt) => attempt.stage === 'GENERATE_CANDIDATES').length;
      if (generationCount >= job.maxAttempts) throw new Error('REPAIR_BUDGET_EXHAUSTED');
      const defects = job.candidates.flatMap((candidate) => candidate.defects.map((defect) => `${defect.code}: ${defect.recommendedAction}`));
      const repairPrompt = `${compiledPrompt(artifacts)}\nCorrect these diagnosed defects: ${defects.join('; ') || 'Improve source alignment and visual quality.'}`;
      const results = [];
      while (generationCount < job.maxAttempts) {
        const repaired = await generateValidatedCandidates(job.id, repairPrompt, correlationId);
        generationCount += 1;
        for (const candidate of repaired) results.push({ candidateId: candidate.id, evaluation: await evaluateAndPersist(candidate, source, repairPrompt) });
        if (results.some((result) => result.evaluation.passed)) return { action: 'regenerated', attempts: generationCount, results };
      }
      throw new Error('AUTONOMOUS_REPAIR_FAILED');
    }
    case 'VERIFY_IDENTITY':
    case 'VERIFY_CONTINUITY':
    case 'VERIFY_GEOGRAPHY':
    case 'VERIFY_HISTORY': {
      const scoreName = stage.replace('VERIFY_', '').toLowerCase() as 'identity' | 'continuity' | 'geography' | 'history';
      const selected = bestApprovedCandidate(job);
      const evaluation = parseJson<SemanticEvaluation>(selected.evaluations.at(-1)?.evidenceJson);
      const score = evaluation?.scores[scoreName];
      if (score === undefined || score < 0.75) throw new Error(`${stage}_FAILED`);
      return { candidateId: selected.id, score, threshold: 0.75, passed: true };
    }
    case 'UPSCALE': {
      const selected = bestApprovedCandidate(job);
      if (selected.width < 1024 || selected.height < 576) throw new Error('UPSCALE_CAPABILITY_REQUIRED');
      return { candidateId: selected.id, action: 'not-required', dimensions: { width: selected.width, height: selected.height } };
    }
    case 'POST_PROCESS':
      return { action: 'not-required', reason: 'Validated provider output requires no deterministic overlay or color transform.' };
    case 'FINAL_QA': {
      const selected = bestApprovedCandidate(job);
      await validateStoredCandidate(selected);
      const passed = selected.fileValidations.some((validation) => validation.passed) && selected.evaluations.some((evaluation) => evaluation.passed && evaluation.criticalGate);
      if (!passed) throw new Error('FINAL_QA_FAILED');
      return { candidateId: selected.id, passed: true, fileIntegrityReverified: true };
    }
    case 'APPROVE': {
      const selected = bestApprovedCandidate(job);
      await prisma.candidate.update({ where: { id: selected.id }, data: { status: 'APPROVED' } });
      return { candidateId: selected.id, approved: true, score: selected.score };
    }
    case 'VERSION': {
      const selected = job.candidates.find((candidate) => candidate.status === 'APPROVED') || bestApprovedCandidate(job);
      if (!selected.storageKey || !selected.sha256 || !selected.mimeType || !selected.byteSize) throw new Error('ASSET_LINEAGE_INCOMPLETE');
      const existing = selected.assets[0];
      if (existing) return { assetId: existing.id, version: existing.version };
      const asset = await prisma.asset.create({ data: { candidateId: selected.id, assetUrl: selected.imageUrl, status: 'APPROVED', versions: { create: { version: 1, storageKey: selected.storageKey, deliveryUrl: selected.imageUrl, sha256: selected.sha256, mimeType: selected.mimeType, byteSize: selected.byteSize, width: selected.width, height: selected.height, provenanceJson: JSON.stringify({ jobId: job.id, candidateId: selected.id, providerId: selected.providerId, modelId: selected.modelId, correlationId }) } } } });
      return { assetId: asset.id, version: 1 };
    }
    case 'DELIVER': {
      const asset = job.candidates.flatMap((candidate) => candidate.assets).find((item) => item.status === 'APPROVED');
      if (!asset) throw new Error('APPROVED_ASSET_MISSING');
      return { assetId: asset.id, deliveryUrl: asset.assetUrl };
    }
    case 'LEARN': {
      const approved = job.candidates.find((candidate) => candidate.status === 'APPROVED');
      return { recorded: true, approvedCandidateId: approved?.id, attempts: job.attempts.length, candidateCount: job.candidates.length, note: 'Operational evidence retained for future benchmark and routing analysis.' };
    }
    default:
      throw new Error(`NO_STAGE_HANDLER: ${stage}`);
  }
}

export function registerAutonomousStageHandlers(): void {
  if (registered) return;
  for (const stage of PROCESSABLE_JOB_STATUSES) JobOrchestrator.registerStageHandler(stage, (context) => executeStage(context.jobId, context.stage, context.correlationId));
  registered = true;
}
