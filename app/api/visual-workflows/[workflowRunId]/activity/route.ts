import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workflowRunId: string }> },
) {
  const { workflowRunId } = await context.params;
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 50)));
  const cursor = request.nextUrl.searchParams.get('cursor');

  try {
    const events = await prisma.visualWorkflowEvent.findMany({
      where: { workflowRunId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return NextResponse.json({
      workflowRunId,
      items: events.map((event) => ({
        id: event.id,
        stageId: event.stageId,
        eventType: event.eventType,
        previousStatus: event.previousStatus,
        newStatus: event.newStatus,
        actorType: event.actorType,
        createdAt: event.createdAt.toISOString(),
      })),
      nextCursor: events.length === limit ? events[events.length - 1]?.id ?? null : null,
    });
  } catch {
    return NextResponse.json({ error: 'Unable to load activity.' }, { status: 503 });
  }
}
