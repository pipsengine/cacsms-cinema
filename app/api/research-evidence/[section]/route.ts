import { NextResponse } from 'next/server';
import { sectionKeys, ResearchRepository } from '@/lib/research-evidence';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ section: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { section } = await params;
    if (!sectionKeys.includes(section as (typeof sectionKeys)[number])) {
      return NextResponse.json({ message: 'Unknown section' }, { status: 404 });
    }
    const repo = new ResearchRepository();
    return NextResponse.json(await repo.list());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list research records';
    return NextResponse.json({ message }, { status: 400 });
  }
}
