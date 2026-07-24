import { NextResponse } from 'next/server';
import { loadAudienceDemand } from '@/lib/content-intelligence/audience-demand';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadAudienceDemand());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load audience demand';
    return NextResponse.json({ message }, { status: 400 });
  }
}
