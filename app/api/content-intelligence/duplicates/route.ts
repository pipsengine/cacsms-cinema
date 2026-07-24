import { NextResponse } from 'next/server';
import { loadDuplicateDetection } from '@/lib/content-intelligence/duplicates';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadDuplicateDetection());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load duplicate detection';
    return NextResponse.json({ message }, { status: 400 });
  }
}
