import { createHash } from 'crypto';
import { prisma } from './db';
import { validateAndStoreImage, type ImageIntegrityResult } from './image-integrity';
import { GoogleGeminiImageProvider } from './providers/google-gemini-image-provider';
import type { GeneratedImage } from './providers/image-provider';
import { localAssetStorage } from './storage/local-storage';

export async function generateValidatedCandidates(jobId: string, prompt: string, correlationId: string) {
  const provider = new GoogleGeminiImageProvider();
  provider.assertConfigured();
  const startedAt = Date.now();
  const attempt = await prisma.generationAttempt.create({
    data: {
      jobId,
      stage: 'GENERATE_CANDIDATES',
      status: 'IN_PROGRESS',
      providerUsed: provider.providerId,
      modelUsed: provider.modelId,
      correlationId,
    },
  });

  const storedKeys: string[] = [];
  try {
    const generated = await provider.generate({ prompt, aspectRatio: '16:9', imageSize: '1K' });
    const validated: Array<{
      image: GeneratedImage;
      validation: ImageIntegrityResult & Required<Pick<ImageIntegrityResult, 'storageKey' | 'deliveryUrl' | 'sha256' | 'width' | 'height' | 'mimeType'>>;
    }> = [];
    for (const image of generated) {
      const validation = await validateAndStoreImage(image.bytes, localAssetStorage, `jobs/${jobId}/candidates`);
      if (!validation.passed || !validation.storageKey || !validation.deliveryUrl || !validation.sha256 || !validation.width || !validation.height || !validation.mimeType) {
        throw new Error(`${validation.failureCode || 'IMAGE_INTEGRITY_FAILED'}: ${validation.evidence.join(' ')}`);
      }
      storedKeys.push(validation.storageKey);
      if (image.mimeType !== validation.mimeType) throw new Error(`PROVIDER_MIME_MISMATCH: Declared ${image.mimeType}, decoded ${validation.mimeType}.`);
      validated.push({ image, validation: validation as ImageIntegrityResult & Required<Pick<ImageIntegrityResult, 'storageKey' | 'deliveryUrl' | 'sha256' | 'width' | 'height' | 'mimeType'>> });
    }
    const created = await prisma.$transaction(async (transaction) => {
      const candidates = [];
      for (const { image, validation } of validated) {
        const candidate = await transaction.candidate.create({
          data: {
          jobId,
          imageUrl: validation.deliveryUrl,
          storageKey: validation.storageKey,
          sha256: validation.sha256,
          mimeType: validation.mimeType,
          byteSize: validation.byteSize,
          width: validation.width,
          height: validation.height,
          providerId: image.providerId,
          modelId: image.modelId,
          metadata: JSON.stringify({ finishReason: image.finishReason, usage: image.usage, promptSha256: createHash('sha256').update(prompt).digest('hex') }),
          fileValidations: {
            create: {
              passed: true,
              mimeType: validation.mimeType,
              signatureValid: validation.signatureValid,
              decoded: validation.decoded,
              width: validation.width,
              height: validation.height,
              byteSize: validation.byteSize,
              pixelVariance: validation.pixelVariance,
              alphaCoverage: validation.alphaCoverage,
              storageWriteOk: validation.storageWriteOk,
              readBackOk: validation.readBackOk,
              browserSafe: validation.browserSafe,
              sha256: validation.sha256,
              evidenceJson: JSON.stringify(validation.evidence),
            },
          },
          },
        });
        candidates.push(candidate);
      }
      await transaction.generationAttempt.update({
        where: { id: attempt.id },
        data: { status: 'SUCCESS', durationMs: Date.now() - startedAt },
      });
      return candidates;
    }, { timeout: 30_000 });
    return created;
  } catch (error) {
    for (const key of storedKeys) await localAssetStorage.delete(key).catch(() => undefined);
    await prisma.generationAttempt.update({
      where: { id: attempt.id },
      data: { status: 'FAILED', durationMs: Date.now() - startedAt, errorMessage: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}
