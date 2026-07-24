import { NextResponse } from 'next/server';
import { loadIntelligenceAudit } from '@/lib/content-intelligence/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadIntelligenceAudit());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load intelligence audit';
    return NextResponse.json({ message }, { status: 400 });
  }
}
