import { NextResponse } from 'next/server';
import { loadCandidatePool } from '@/lib/idea-qualification/candidate-pool';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadCandidatePool());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load candidate pool';
    return NextResponse.json({ message }, { status: 400 });
  }
}
