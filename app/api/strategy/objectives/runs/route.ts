import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { StrategyService } from '@/lib/strategy';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const service = new StrategyService();
    const result = await service.startObjectivesRun(
      request.headers.get('idempotency-key') ?? randomUUID(),
    );
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start objectives autonomy';
    return NextResponse.json({ message }, { status: 400 });
  }
}
