import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { validateAndStoreImage } from '../lib/image-integrity';
import { normalizeStorageKey } from '../lib/storage/local-storage';
import type { AssetStorage, StoredObject } from '../lib/storage/types';

class MemoryStorage implements AssetStorage {
  objects = new Map<string, Buffer>();

  async put(key: string, bytes: Buffer): Promise<StoredObject> {
    this.objects.set(key, Buffer.from(bytes));
    return { key, byteSize: bytes.length, sha256: 'calculated-by-validator' };
  }

  async get(key: string): Promise<Buffer> {
    const bytes = this.objects.get(key);
    if (!bytes) throw new Error('not found');
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  deliveryUrl(key: string): string {
    return `/api/assets/${key}`;
  }
}

test('valid image passes decode, pixel, storage, and read-back gates', async () => {
  const width = 256;
  const height = 256;
  const pixels = Buffer.alloc(width * height * 3);
  for (let index = 0; index < pixels.length; index += 3) {
    const value = (index / 3 + Math.floor(index / 3 / width)) % 2 === 0 ? 0 : 255;
    pixels[index] = value;
    pixels[index + 1] = 255 - value;
    pixels[index + 2] = value;
  }
  const png = await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
  const result = await validateAndStoreImage(png, new MemoryStorage(), 'jobs/test/candidates');

  assert.equal(result.passed, true);
  assert.equal(result.signatureValid, true);
  assert.equal(result.decoded, true);
  assert.equal(result.storageWriteOk, true);
  assert.equal(result.readBackOk, true);
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.width, width);
  assert.equal(result.height, height);
});

test('uniform image is rejected before storage', async () => {
  const storage = new MemoryStorage();
  const png = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const result = await validateAndStoreImage(png, storage, 'jobs/test/candidates');

  assert.equal(result.passed, false);
  assert.equal(result.failureCode, 'LOW_PIXEL_VARIANCE');
  assert.equal(storage.objects.size, 0);
});

test('storage keys cannot escape the configured root', () => {
  assert.throws(() => normalizeStorageKey('../../secrets.txt'), /INVALID_STORAGE_KEY/);
  assert.throws(() => normalizeStorageKey('jobs//asset.png'), /INVALID_STORAGE_KEY/);
  assert.equal(normalizeStorageKey('jobs/id/asset.png'), 'jobs/id/asset.png');
});
