import { NextRequest, NextResponse } from 'next/server';
import { SectionKey, StrategyRecord, StrategyRepository } from '@/lib/strategy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ versionId: string; section: string; recordId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { versionId, section, recordId } = await params;
    const sectionKey = SectionKey.parse(section);
    const body = StrategyRecord.parse(await request.json());
    const repo = new StrategyRepository();
    const updated = await repo.update(versionId, sectionKey, recordId, body);
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update strategy record';
    const status = message.includes('Only draft')
      ? 409
      : message.includes('not found')
        ? 404
        : 400;
    return NextResponse.json({ message }, { status });
  }
}
