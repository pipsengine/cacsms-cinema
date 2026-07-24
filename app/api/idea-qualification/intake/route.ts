import { NextResponse } from 'next/server';
import { loadIntelligenceIntake } from '@/lib/idea-qualification/intake';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadIntelligenceIntake());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load intelligence intake';
    return NextResponse.json({ message }, { status: 400 });
  }
}
