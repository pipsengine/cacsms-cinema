import { NextResponse } from 'next/server';
import { loadCompetitorIntelligence } from '@/lib/content-intelligence/competitors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadCompetitorIntelligence());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load competitor intelligence';
    return NextResponse.json({ message }, { status: 400 });
  }
}
