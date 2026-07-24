import { NextResponse } from 'next/server';
import { loadTrendIntelligence } from '@/lib/content-intelligence/trends';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadTrendIntelligence());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load trend intelligence';
    return NextResponse.json({ message }, { status: 400 });
  }
}
