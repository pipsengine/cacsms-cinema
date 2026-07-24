import { NextRequest, NextResponse } from 'next/server';
import { StrategyRepository } from '@/lib/strategy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const left = request.nextUrl.searchParams.get('left');
    const right = request.nextUrl.searchParams.get('right');
    if (!left || !right) {
      return NextResponse.json({ message: 'left and right version ids are required' }, { status: 400 });
    }
    const repo = new StrategyRepository();
    return NextResponse.json(await repo.compareVersions(left, right));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to compare versions';
    return NextResponse.json({ message }, { status: 400 });
  }
}
