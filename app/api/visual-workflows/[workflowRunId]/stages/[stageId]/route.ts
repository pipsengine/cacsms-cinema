import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowStatusSnapshot, reconcileWorkflowRun } from '@/lib/visual-workflow/service';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ workflowRunId: string; stageId: string }> },
) {
  const { workflowRunId, stageId } = await context.params;
  try {
    await reconcileWorkflowRun(workflowRunId);
    const snapshot = await getWorkflowStatusSnapshot(workflowRunId);
    if (!snapshot) return NextResponse.json({ error: 'Workflow run not found.' }, { status: 404 });
    const stage = snapshot.stages.find((item) => item.stageId === stageId);
    if (!stage) return NextResponse.json({ error: 'Stage not found.' }, { status: 404 });
    return NextResponse.json({ workflowRunId, stage });
  } catch {
    return NextResponse.json({ error: 'Unable to load stage.' }, { status: 503 });
  }
}
