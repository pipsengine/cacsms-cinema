import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const attempts = await prisma.generationAttempt.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(attempts);
  } catch (error) {
    console.error('Failed to fetch attempts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attempts' },
      { status: 500 }
    );
  }
}
