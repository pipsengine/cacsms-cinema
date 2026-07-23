import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ workflowRunId: string }> },
) {
  const { workflowRunId } = await context.params;
  try {
    const exceptions = await prisma.visualWorkflowException.findMany({
      where: { workflowRunId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({
      workflowRunId,
      items: exceptions.map((item) => ({
        id: item.id,
        stageId: item.stageId,
        classification: item.classification,
        severity: item.severity,
        blocking: item.blocking,
        status: item.status,
        safeDescription: item.safeDescription,
        retryEligible: item.retryEligible,
        createdAt: item.createdAt.toISOString(),
        resolvedAt: item.resolvedAt?.toISOString() ?? null,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Unable to load exceptions.' }, { status: 503 });
  }
}
