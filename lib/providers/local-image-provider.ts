import { createHash } from 'crypto';
import sharp from 'sharp';
import type { GeneratedImage, ImageGenerationRequest, ImageProvider } from './image-provider';

const WIDTH = 1280;
const HEIGHT = 720;

function hashToRgb(seed: string, salt: string): { r: number; g: number; b: number } {
  const digest = createHash('sha256').update(`${seed}:${salt}`).digest();
  return { r: digest[0], g: digest[1], b: digest[2] };
}

/**
 * Deterministic cinematic still for local/dev when Gemini credentials are absent.
 * Produces a real PNG with enough pixel variance to pass integrity gates.
 */
export class LocalImageProvider implements ImageProvider {
  readonly providerId = 'local-dev';
  readonly modelId = 'local-sharp-cinematic';

  assertConfigured(): void {
    // Always available; no external credentials required.
  }

  async generate(request: ImageGenerationRequest): Promise<GeneratedImage[]> {
    if (!request.prompt.trim()) throw new Error('INVALID_GENERATION_REQUEST: Prompt is empty.');

    const top = hashToRgb(request.prompt, 'sky');
    const bottom = hashToRgb(request.prompt, 'ground');
    const accent = hashToRgb(request.prompt, 'accent');

    const svg = `
      <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgb(${top.r},${top.g},${top.b})"/>
            <stop offset="100%" stop-color="rgb(${bottom.r},${bottom.g},${bottom.b})"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <rect x="${Math.floor(WIDTH * 0.12)}" y="${Math.floor(HEIGHT * 0.28)}" width="${Math.floor(WIDTH * 0.76)}" height="${Math.floor(HEIGHT * 0.44)}" fill="rgb(${accent.r},${accent.g},${accent.b})" opacity="0.55"/>
        <circle cx="${Math.floor(WIDTH * 0.78)}" cy="${Math.floor(HEIGHT * 0.22)}" r="${Math.floor(HEIGHT * 0.09)}" fill="rgb(${(accent.r + 80) % 256},${(accent.g + 40) % 256},${(accent.b + 20) % 256})"/>
        <rect x="0" y="${HEIGHT - 48}" width="${WIDTH}" height="48" fill="rgba(0,0,0,0.35)"/>
      </svg>
    `;

    const bytes = await sharp(Buffer.from(svg)).png().toBuffer();
    return [{
      bytes,
      mimeType: 'image/png',
      providerId: this.providerId,
      modelId: this.modelId,
      finishReason: 'LOCAL_DEV',
      usage: { promptTokens: 0, candidateTokens: 0, totalTokens: 0 },
    }];
  }
}
