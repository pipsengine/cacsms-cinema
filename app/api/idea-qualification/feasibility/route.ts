import { NextResponse } from 'next/server';
import { loadProductionFeasibility } from '@/lib/idea-qualification/feasibility';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadProductionFeasibility());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load production feasibility';
    return NextResponse.json({ message }, { status: 400 });
  }
}
