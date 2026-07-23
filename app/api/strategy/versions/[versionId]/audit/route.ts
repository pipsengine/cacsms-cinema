import { NextResponse } from 'next/server';
import { StrategyRepository } from '@/lib/strategy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ versionId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { versionId } = await params;
    const repo = new StrategyRepository();
    return NextResponse.json(await repo.listAudit(versionId));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load audit events';
    return NextResponse.json({ message }, { status: 400 });
  }
}
