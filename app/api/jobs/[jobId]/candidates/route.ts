import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const candidates = await prisma.candidate.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(candidates);
  } catch (error) {
    console.error('Failed to fetch candidates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch candidates' },
      { status: 500 }
    );
  }
}

