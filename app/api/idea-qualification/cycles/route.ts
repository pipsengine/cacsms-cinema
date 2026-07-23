import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { QualificationService } from '@/lib/idea-qualification';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const service = new QualificationService();
    const result = await service.startCycle(
      request.headers.get('idempotency-key') ?? randomUUID(),
    );
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start qualification cycle';
    return NextResponse.json({ message }, { status: 400 });
  }
}
