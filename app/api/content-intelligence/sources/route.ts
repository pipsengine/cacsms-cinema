import { NextResponse } from 'next/server';
import { loadSourceRegistry } from '@/lib/content-intelligence/sources';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadSourceRegistry());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load source registry';
    return NextResponse.json({ message }, { status: 400 });
  }
}
