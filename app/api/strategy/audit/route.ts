import { NextResponse } from 'next/server';
import { StrategyRepository } from '@/lib/strategy';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const repo = new StrategyRepository();
    return NextResponse.json(await repo.listStrategyAudit());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load strategy audit';
    return NextResponse.json({ message }, { status: 400 });
  }
}
