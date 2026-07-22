import { GoogleGenAI } from '@google/genai';

export interface SemanticEvaluation {
  overall: number;
  confidence: number;
  passed: boolean;
  safetyPassed: boolean;
  scores: {
    promptAlignment: number;
    identity: number;
    continuity: number;
    geography: number;
    history: number;
    composition: number;
    artifactFree: number;
  };
  evidence: string[];
  defects: Array<{ code: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; description: string; recommendedAction: string }>;
}

function bounded(value: unknown): number {
  const number = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new Error('EVALUATOR_INVALID_RESPONSE: Score must be between 0 and 1.');
  return number;
}

export async function evaluateImageSemantics(bytes: Buffer, mimeType: string, source: string, compiledPrompt: string): Promise<SemanticEvaluation> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') throw new Error('PROVIDER_NOT_CONFIGURED: GEMINI_API_KEY is missing.');
  const model = process.env.GEMINI_EVALUATOR_MODEL || 'gemini-2.5-flash';
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [
        { text: `Act as a strict cinema image QA evaluator. Compare the image with the source and compiled prompt. Return JSON only with: overall, confidence, passed, safetyPassed, scores {promptAlignment, identity, continuity, geography, history, composition, artifactFree}, evidence (string array), defects (array of {code,severity,description,recommendedAction}). Every score is 0..1. passed must be false when safety fails, overall < 0.75, or any critical requirement is visibly violated. Do not invent evidence.\nSOURCE:\n${source}\nCOMPILED PROMPT:\n${compiledPrompt}` },
        { inlineData: { data: bytes.toString('base64'), mimeType } },
      ],
    }],
    config: { responseMimeType: 'application/json', temperature: 0 },
  });
  const raw = response.text;
  if (!raw) throw new Error('EVALUATOR_EMPTY_RESPONSE: No evaluation JSON returned.');
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('EVALUATOR_INVALID_RESPONSE: Response was not valid JSON.');
  }
  const scores = parsed.scores as Record<string, unknown> | undefined;
  if (!scores) throw new Error('EVALUATOR_INVALID_RESPONSE: scores is required.');
  const defects = Array.isArray(parsed.defects) ? parsed.defects : [];
  const evidence = Array.isArray(parsed.evidence) ? parsed.evidence.filter((item): item is string => typeof item === 'string') : [];
  return {
    overall: bounded(parsed.overall),
    confidence: bounded(parsed.confidence),
    passed: parsed.passed === true,
    safetyPassed: parsed.safetyPassed === true,
    scores: {
      promptAlignment: bounded(scores.promptAlignment),
      identity: bounded(scores.identity),
      continuity: bounded(scores.continuity),
      geography: bounded(scores.geography),
      history: bounded(scores.history),
      composition: bounded(scores.composition),
      artifactFree: bounded(scores.artifactFree),
    },
    evidence,
    defects: defects.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const defect = item as Record<string, unknown>;
      const severity = defect.severity;
      if (typeof defect.code !== 'string' || typeof defect.description !== 'string' || typeof defect.recommendedAction !== 'string' || !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(severity))) return [];
      return [{ code: defect.code, severity: severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', description: defect.description, recommendedAction: defect.recommendedAction }];
    }),
  };
}
