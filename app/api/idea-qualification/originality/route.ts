import { NextResponse } from 'next/server';
import { loadOriginality } from '@/lib/idea-qualification/originality';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadOriginality());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load originality analysis';
    return NextResponse.json({ message }, { status: 400 });
  }
}
