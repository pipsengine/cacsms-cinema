import { NextResponse } from 'next/server';
import { loadKnowledgeGaps } from '@/lib/content-intelligence/knowledge-gaps';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadKnowledgeGaps());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load knowledge gaps';
    return NextResponse.json({ message }, { status: 400 });
  }
}
