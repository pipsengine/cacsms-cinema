import { NextRequest, NextResponse } from 'next/server';
import { consumeStrategyInput, IntelligenceService } from '@/lib/content-intelligence';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = consumeStrategyInput.safeParse(raw ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid strategy package payload', issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const service = new IntelligenceService();
    return NextResponse.json(await service.consumeStrategy(parsed.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Strategy consume failed';
    return NextResponse.json({ message }, { status: 400 });
  }
}
