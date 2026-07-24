import { NextResponse } from 'next/server';
import { loadTopicOpportunities } from '@/lib/content-intelligence/topic-opportunities';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadTopicOpportunities());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load topic opportunities';
    return NextResponse.json({ message }, { status: 400 });
  }
}
