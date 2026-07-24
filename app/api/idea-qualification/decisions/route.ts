import { NextResponse } from 'next/server';
import { loadDecisionRegister } from '@/lib/idea-qualification/decisions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadDecisionRegister());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load decision register';
    return NextResponse.json({ message }, { status: 400 });
  }
}
