import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'fs/promises';
import path from 'path';
import type { AssetStorage, StoredObject } from './types';

const DEFAULT_ROOT = path.join(process.cwd(), 'storage', 'assets');

function storageRoot(): string {
  return path.resolve(process.env.ASSET_STORAGE_ROOT || DEFAULT_ROOT);
}

export function normalizeStorageKey(key: string): string {
  const normalized = key.replaceAll('\\', '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('\0')) throw new Error('INVALID_STORAGE_KEY');
  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('INVALID_STORAGE_KEY');
  }
  return segments.join('/');
}

function resolveKey(key: string): string {
  const root = storageRoot();
  const resolved = path.resolve(root, ...normalizeStorageKey(key).split('/'));
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('INVALID_STORAGE_KEY');
  return resolved;
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export class LocalAssetStorage implements AssetStorage {
  async put(key: string, bytes: Buffer): Promise<StoredObject> {
    if (!bytes.length) throw new Error('EMPTY_STORAGE_WRITE');
    const safeKey = normalizeStorageKey(key);
    const destination = resolveKey(safeKey);
    await mkdir(path.dirname(destination), { recursive: true });
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, bytes, { flag: 'wx' });
      await rename(temporary, destination);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
    return { key: safeKey, byteSize: bytes.length, sha256: sha256(bytes) };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(resolveKey(key));
  }

  async delete(key: string): Promise<void> {
    await rm(resolveKey(key), { force: true });
  }

  deliveryUrl(key: string): string {
    return `/api/assets/${normalizeStorageKey(key).split('/').map(encodeURIComponent).join('/')}`;
  }
}

export const localAssetStorage = new LocalAssetStorage();
