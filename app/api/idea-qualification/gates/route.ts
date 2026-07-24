import { NextResponse } from 'next/server';
import { loadMandatoryGates } from '@/lib/idea-qualification/gates';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadMandatoryGates());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load mandatory gates';
    return NextResponse.json({ message }, { status: 400 });
  }
}
