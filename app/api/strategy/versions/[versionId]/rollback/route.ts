import { NextResponse } from 'next/server';
import { StrategyRepository } from '@/lib/strategy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ versionId: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { versionId } = await params;
    const repo = new StrategyRepository();
    const result = await repo.rollbackToDraft(versionId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Rollback failed';
    return NextResponse.json({ message }, { status: 400 });
  }
}
