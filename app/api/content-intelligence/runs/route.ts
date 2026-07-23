import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { IntelligenceService } from '@/lib/content-intelligence';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const service = new IntelligenceService();
    const result = await service.startRun(
      request.headers.get('idempotency-key') ?? randomUUID(),
    );
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start discovery run';
    return NextResponse.json({ message }, { status: 400 });
  }
}
