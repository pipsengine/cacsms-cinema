import { NextResponse } from 'next/server';
import { loadQualifiedRanking } from '@/lib/idea-qualification/ranking';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadQualifiedRanking());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load qualified ranking';
    return NextResponse.json({ message }, { status: 400 });
  }
}
