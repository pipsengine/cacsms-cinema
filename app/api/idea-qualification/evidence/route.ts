import { NextResponse } from 'next/server';
import { loadEvidenceSufficiency } from '@/lib/idea-qualification/evidence';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadEvidenceSufficiency());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load evidence sufficiency';
    return NextResponse.json({ message }, { status: 400 });
  }
}
