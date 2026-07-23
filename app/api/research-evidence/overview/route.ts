import { NextResponse } from 'next/server';
import { ResearchRepository } from '@/lib/research-evidence';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const repo = new ResearchRepository();
    return NextResponse.json(await repo.overview());
  } catch (error) {
    console.error('research overview failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      {
        available: false,
        reason:
          error instanceof Error
            ? error.message.replace(/password|secret|token/gi, '[redacted]')
            : 'Research & Evidence unavailable',
      },
      { status: 200 },
    );
  }
}
