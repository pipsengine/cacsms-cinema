import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { ResearchService } from '@/lib/research-evidence';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const service = new ResearchService();
    const result = await service.startCycle(
      request.headers.get('idempotency-key') ?? randomUUID(),
    );
    return NextResponse.json({ runId: result.cycleId, status: result.status }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start research run';
    return NextResponse.json({ message }, { status: 400 });
  }
}
