import { NextResponse } from 'next/server';
import { loadQualificationScoring } from '@/lib/idea-qualification/qualification-scoring';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadQualificationScoring());
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to load qualification scoring';
    return NextResponse.json({ message }, { status: 400 });
  }
}
