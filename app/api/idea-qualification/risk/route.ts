import { NextResponse } from 'next/server';
import { loadRiskSensitivity } from '@/lib/idea-qualification/risk';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadRiskSensitivity());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load risk & sensitivity';
    return NextResponse.json({ message }, { status: 400 });
  }
}
