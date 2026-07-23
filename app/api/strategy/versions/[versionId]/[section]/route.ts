import { NextRequest, NextResponse } from 'next/server';
import { SectionKey, StrategyRecord, StrategyRepository } from '@/lib/strategy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ versionId: string; section: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { versionId, section } = await params;
    const sectionKey = SectionKey.parse(section);
    const repo = new StrategyRepository();
    return NextResponse.json(await repo.list(versionId, sectionKey));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list strategy records';
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { versionId, section } = await params;
    const sectionKey = SectionKey.parse(section);
    const body = StrategyRecord.parse(await request.json());
    const repo = new StrategyRepository();
    const created = await repo.create(versionId, sectionKey, body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create strategy record';
    const status = message.includes('Only draft') ? 409 : 400;
    return NextResponse.json({ message }, { status });
  }
}
