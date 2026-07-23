import { NextResponse } from 'next/server';
import { StrategyRepository } from '@/lib/strategy';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const repo = new StrategyRepository();
    return NextResponse.json(await repo.overview());
  } catch (error) {
    console.error('strategy overview failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      {
        available: false,
        reason:
          error instanceof Error
            ? error.message.replace(/password|secret|token/gi, '[redacted]')
            : 'Strategy service unavailable',
      },
      { status: 200 },
    );
  }
}
