import { NextResponse } from 'next/server';
import { IntelligenceRepository } from '@/lib/content-intelligence';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const repo = new IntelligenceRepository();
    return NextResponse.json(await repo.overview());
  } catch (error) {
    console.error('CI overview failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      {
        available: false,
        reason:
          error instanceof Error
            ? error.message.replace(/password|secret|token/gi, '[redacted]')
            : 'Content Intelligence unavailable',
      },
      { status: 200 },
    );
  }
}
