import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { StrategyService } from '@/lib/strategy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ versionId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { versionId } = await params;
    const service = new StrategyService();
    const result = await service.activate(
      versionId,
      request.headers.get('idempotency-key') ?? randomUUID(),
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Activation failed';
    return NextResponse.json({ message }, { status: 400 });
  }
}
