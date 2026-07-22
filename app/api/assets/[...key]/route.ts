import { NextRequest, NextResponse } from 'next/server';
import { localAssetStorage, normalizeStorageKey } from '@/lib/storage/local-storage';

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export async function GET(_request: NextRequest, context: { params: Promise<{ key: string[] }> }) {
  try {
    const { key } = await context.params;
    const storageKey = normalizeStorageKey(key.map(decodeURIComponent).join('/'));
    const extension = storageKey.split('.').pop()?.toLowerCase() || '';
    const mimeType = MIME_BY_EXTENSION[extension];
    if (!mimeType) return NextResponse.json({ error: 'Unsupported asset type' }, { status: 415 });
    const bytes = await localAssetStorage.get(storageKey);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(bytes.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }
}
