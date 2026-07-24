import { NextResponse } from 'next/server';
import { loadOpportunityScoring } from '@/lib/content-intelligence/opportunity-scoring';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadOpportunityScoring());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load opportunity scoring';
    return NextResponse.json({ message }, { status: 400 });
  }
}
