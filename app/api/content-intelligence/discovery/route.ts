import { NextResponse } from 'next/server';
import { loadDiscoveryRuns } from '@/lib/content-intelligence/discovery';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadDiscoveryRuns());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load discovery runs';
    return NextResponse.json({ message }, { status: 400 });
  }
}
