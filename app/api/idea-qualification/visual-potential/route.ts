import { NextResponse } from 'next/server';
import { loadVisualPotential } from '@/lib/idea-qualification/visual-potential';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadVisualPotential());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load visual potential';
    return NextResponse.json({ message }, { status: 400 });
  }
}
