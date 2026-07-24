import { NextResponse } from 'next/server';
import { loadStrategicFit } from '@/lib/idea-qualification/strategic-fit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadStrategicFit());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load strategic fit';
    return NextResponse.json({ message }, { status: 400 });
  }
}
