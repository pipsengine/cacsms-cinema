import { NextResponse } from 'next/server';
import { loadQualificationHandoffs } from '@/lib/content-intelligence/handoffs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadQualificationHandoffs());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load qualification handoffs';
    return NextResponse.json({ message }, { status: 400 });
  }
}
