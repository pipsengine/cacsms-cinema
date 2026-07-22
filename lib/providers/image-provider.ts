export interface ImageGenerationRequest {
  prompt: string;
  aspectRatio?: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
  imageSize?: '1K' | '2K' | '4K';
}

export interface GeneratedImage {
  bytes: Buffer;
  mimeType: string;
  providerId: string;
  modelId: string;
  finishReason?: string;
  usage: Record<string, number>;
}

export interface ImageProvider {
  readonly providerId: string;
  readonly modelId: string;
  assertConfigured(): void;
  generate(request: ImageGenerationRequest): Promise<GeneratedImage[]>;
}
