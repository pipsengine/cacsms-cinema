import { NextResponse } from 'next/server';
import { loadAudienceValue } from '@/lib/idea-qualification/audience-value';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadAudienceValue());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load audience value';
    return NextResponse.json({ message }, { status: 400 });
  }
}
