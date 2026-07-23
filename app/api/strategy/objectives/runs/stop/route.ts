import { NextRequest, NextResponse } from 'next/server';
import { StrategyService } from '@/lib/strategy';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { runId?: string };
    const service = new StrategyService();
    const result = await service.stopObjectivesRun(body.runId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to stop objectives autonomy';
    return NextResponse.json({ message }, { status: 400 });
  }
}
