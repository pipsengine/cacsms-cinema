import type { ImageProvider } from './image-provider';
import { GoogleGeminiImageProvider } from './google-gemini-image-provider';
import { LocalImageProvider } from './local-image-provider';
import { evaluateImageSemantics as evaluateWithGemini, type SemanticEvaluation } from './google-gemini-evaluator';
import { evaluateImageSemanticsLocal } from './local-evaluator';

export type ProviderMode = 'auto' | 'local' | 'gemini';

const PLACEHOLDER_KEYS = new Set([
  '',
  'MY_GEMINI_API_KEY',
  'your_gemini_api_key_here',
]);

export function getProviderMode(): ProviderMode {
  const raw = (process.env.PROVIDER_MODE || 'auto').trim().toLowerCase();
  if (raw === 'local' || raw === 'gemini' || raw === 'auto') return raw;
  return 'auto';
}

export function isGeminiConfigured(apiKey = process.env.GEMINI_API_KEY): boolean {
  if (!apiKey) return false;
  const trimmed = apiKey.trim();
  if (!trimmed) return false;
  if (PLACEHOLDER_KEYS.has(trimmed)) return false;
  if (/^demo/i.test(trimmed)) return false;
  if (trimmed.length < 20) return false;
  return true;
}

export function shouldUseLocalProviders(): boolean {
  const mode = getProviderMode();
  if (mode === 'local') return true;
  if (mode === 'gemini') return false;
  return !isGeminiConfigured();
}

export function getImageProvider(): ImageProvider {
  if (shouldUseLocalProviders()) return new LocalImageProvider();
  return new GoogleGeminiImageProvider();
}

export async function evaluateImageSemanticsRouted(
  bytes: Buffer,
  mimeType: string,
  source: string,
  compiledPrompt: string,
): Promise<SemanticEvaluation> {
  if (shouldUseLocalProviders()) {
    return evaluateImageSemanticsLocal(bytes, mimeType, source, compiledPrompt);
  }
  return evaluateWithGemini(bytes, mimeType, source, compiledPrompt);
}

export function getScriptProviderMeta(): { providerId: string; modelId: string } {
  if (shouldUseLocalProviders()) {
    return { providerId: 'local-dev', modelId: 'local-script-template' };
  }
  return {
    providerId: 'google-gemini',
    modelId: process.env.GEMINI_SCRIPT_MODEL || 'gemini-2.5-flash',
  };
}
