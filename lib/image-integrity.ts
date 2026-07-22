import { createHash, randomUUID } from 'crypto';
import sharp from 'sharp';
import type { AssetStorage } from './storage/types';

const BROWSER_SAFE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export interface ImageIntegrityOptions {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxBytes?: number;
  minPixelVariance?: number;
}

export interface ImageIntegrityResult {
  passed: boolean;
  failureCode?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  byteSize: number;
  pixelVariance?: number;
  alphaCoverage?: number;
  signatureValid: boolean;
  decoded: boolean;
  storageWriteOk: boolean;
  readBackOk: boolean;
  browserSafe: boolean;
  sha256?: string;
  storageKey?: string;
  deliveryUrl?: string;
  evidence: string[];
}

function detectMime(bytes: Buffer): string | undefined {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return undefined;
}

function extensionFor(mimeType: string): string {
  return mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1];
}

function failed(base: ImageIntegrityResult, failureCode: string, evidence: string): ImageIntegrityResult {
  return { ...base, passed: false, failureCode, evidence: [...base.evidence, evidence] };
}

export async function validateAndStoreImage(
  bytes: Buffer,
  storage: AssetStorage,
  keyPrefix: string,
  options: ImageIntegrityOptions = {}
): Promise<ImageIntegrityResult> {
  const limits = {
    minWidth: options.minWidth ?? 256,
    minHeight: options.minHeight ?? 256,
    maxWidth: options.maxWidth ?? 8192,
    maxHeight: options.maxHeight ?? 8192,
    maxBytes: options.maxBytes ?? 25 * 1024 * 1024,
    minPixelVariance: options.minPixelVariance ?? 2,
  };
  let result: ImageIntegrityResult = {
    passed: false,
    byteSize: bytes.length,
    signatureValid: false,
    decoded: false,
    storageWriteOk: false,
    readBackOk: false,
    browserSafe: false,
    evidence: [],
  };

  if (!bytes.length) return failed(result, 'EMPTY_FILE', 'The provider returned zero bytes.');
  if (bytes.length > limits.maxBytes) return failed(result, 'FILE_TOO_LARGE', `File exceeds ${limits.maxBytes} bytes.`);

  const mimeType = detectMime(bytes);
  result = { ...result, mimeType, signatureValid: Boolean(mimeType), browserSafe: Boolean(mimeType && BROWSER_SAFE_MIME_TYPES.has(mimeType)) };
  if (!mimeType) return failed(result, 'INVALID_SIGNATURE', 'The bytes do not have a supported PNG, JPEG, or WebP signature.');
  if (!result.browserSafe) return failed(result, 'UNSAFE_MIME_TYPE', `${mimeType} is not approved for browser delivery.`);

  try {
    const image = sharp(bytes, { failOn: 'error', limitInputPixels: limits.maxWidth * limits.maxHeight });
    const [metadata, stats, raw] = await Promise.all([
      image.metadata(),
      image.stats(),
      image.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    ]);
    const width = metadata.width;
    const height = metadata.height;
    if (!width || !height) return failed({ ...result, decoded: true }, 'MISSING_DIMENSIONS', 'The decoder did not report dimensions.');
    const pixelVariance = stats.channels.slice(0, 3).reduce((sum, channel) => sum + channel.stdev ** 2, 0) / Math.min(3, stats.channels.length);
    let transparentPixels = 0;
    for (let index = 3; index < raw.data.length; index += raw.info.channels) if (raw.data[index] < 255) transparentPixels += 1;
    const alphaCoverage = transparentPixels / (width * height);
    result = { ...result, decoded: true, width, height, pixelVariance, alphaCoverage };
    if (width < limits.minWidth || height < limits.minHeight) return failed(result, 'DIMENSIONS_TOO_SMALL', `${width}x${height} is below the minimum.`);
    if (width > limits.maxWidth || height > limits.maxHeight) return failed(result, 'DIMENSIONS_TOO_LARGE', `${width}x${height} exceeds the maximum.`);
    if (pixelVariance < limits.minPixelVariance) return failed(result, 'LOW_PIXEL_VARIANCE', 'The decoded image is effectively blank or uniform.');
  } catch (error) {
    return failed(result, 'DECODE_FAILED', error instanceof Error ? error.message : String(error));
  }

  const digest = createHash('sha256').update(bytes).digest('hex');
  const storageKey = `${keyPrefix}/${digest.slice(0, 2)}/${digest}-${randomUUID()}.${extensionFor(mimeType)}`;
  try {
    const stored = await storage.put(storageKey, bytes);
    result = { ...result, storageWriteOk: true, storageKey: stored.key, sha256: digest };
    const readBack = await storage.get(stored.key);
    const readBackHash = createHash('sha256').update(readBack).digest('hex');
    if (readBackHash !== digest || readBack.length !== bytes.length) {
      await storage.delete(stored.key).catch(() => undefined);
      return failed(result, 'STORAGE_READBACK_MISMATCH', 'Stored bytes did not match the validated payload.');
    }
    return { ...result, passed: true, readBackOk: true, deliveryUrl: storage.deliveryUrl(stored.key), evidence: [...result.evidence, 'Signature, decode, dimensions, pixel variance, atomic write, and read-back hash passed.'] };
  } catch (error) {
    if (result.storageKey) await storage.delete(result.storageKey).catch(() => undefined);
    return failed(result, 'STORAGE_WRITE_FAILED', error instanceof Error ? error.message : String(error));
  }
}
