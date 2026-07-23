import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowStatusSnapshot, reconcileWorkflowRun } from '@/lib/visual-workflow/service';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ workflowRunId: string }> },
) {
  const { workflowRunId } = await context.params;
  if (!workflowRunId) return NextResponse.json({ error: 'workflowRunId is required.' }, { status: 400 });

  try {
    await reconcileWorkflowRun(workflowRunId);
    const snapshot = await getWorkflowStatusSnapshot(workflowRunId);
    if (!snapshot) return NextResponse.json({ error: 'Workflow run not found.' }, { status: 404 });
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('workflow status failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load workflow status.' }, { status: 503 });
  }
}
