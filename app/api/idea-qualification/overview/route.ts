import { NextResponse } from 'next/server';
import { QualificationRepository } from '@/lib/idea-qualification';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const repo = new QualificationRepository();
    return NextResponse.json(await repo.overview());
  } catch (error) {
    console.error('IQ overview failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      {
        available: false,
        reason:
          error instanceof Error
            ? error.message.replace(/password|secret|token/gi, '[redacted]')
            : 'Idea Qualification unavailable',
      },
      { status: 200 },
    );
  }
}
