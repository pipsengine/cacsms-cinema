import { NextResponse } from 'next/server';
import { loadRankingSelection } from '@/lib/content-intelligence/ranking';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadRankingSelection());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load ranking & selection';
    return NextResponse.json({ message }, { status: 400 });
  }
}
