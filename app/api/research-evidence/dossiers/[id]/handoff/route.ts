import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { ResearchService } from '@/lib/research-evidence';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const service = new ResearchService();
    const result = await service.handoff(
      id,
      request.headers.get('idempotency-key') ?? randomUUID(),
    );
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dossier handoff failed';
    return NextResponse.json({ message }, { status: 400 });
  }
}
