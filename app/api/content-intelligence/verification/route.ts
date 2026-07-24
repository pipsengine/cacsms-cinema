import { NextResponse } from 'next/server';
import { loadEvidenceVerification } from '@/lib/content-intelligence/verification';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadEvidenceVerification());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load evidence verification';
    return NextResponse.json({ message }, { status: 400 });
  }
}
