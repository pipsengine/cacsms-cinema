import { GoogleGenAI } from '@google/genai';
import type { GeneratedImage, ImageGenerationRequest, ImageProvider } from './image-provider';

export class GoogleGeminiImageProvider implements ImageProvider {
  readonly providerId = 'google-gemini';
  readonly modelId: string;
  private readonly apiKey?: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.modelId = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
  }

  assertConfigured(): void {
    if (!this.apiKey || this.apiKey === 'MY_GEMINI_API_KEY') throw new Error('PROVIDER_NOT_CONFIGURED: GEMINI_API_KEY is missing.');
    if (!this.modelId.trim()) throw new Error('PROVIDER_NOT_CONFIGURED: GEMINI_IMAGE_MODEL is missing.');
  }

  async generate(request: ImageGenerationRequest): Promise<GeneratedImage[]> {
    this.assertConfigured();
    if (!request.prompt.trim()) throw new Error('INVALID_GENERATION_REQUEST: Prompt is empty.');
    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const response = await ai.models.generateContent({
      model: this.modelId,
      contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: request.aspectRatio || '16:9',
          imageSize: request.imageSize || '1K',
        },
      },
    });
    const usage = response.usageMetadata;
    const usageRecord: Record<string, number> = {};
    if (usage?.promptTokenCount !== undefined) usageRecord.promptTokens = usage.promptTokenCount;
    if (usage?.candidatesTokenCount !== undefined) usageRecord.candidateTokens = usage.candidatesTokenCount;
    if (usage?.totalTokenCount !== undefined) usageRecord.totalTokens = usage.totalTokenCount;

    const images: GeneratedImage[] = [];
    for (const candidate of response.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        const data = part.inlineData?.data;
        if (!data) continue;
        images.push({
          bytes: Buffer.from(data, 'base64'),
          mimeType: part.inlineData?.mimeType || 'application/octet-stream',
          providerId: this.providerId,
          modelId: this.modelId,
          finishReason: candidate.finishReason,
          usage: usageRecord,
        });
      }
    }
    if (!images.length) throw new Error('PROVIDER_EMPTY_RESPONSE: Gemini returned no image parts.');
    return images;
  }
}
