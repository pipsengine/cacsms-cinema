import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_request: Request, context: { params: Promise<{ scriptId: string }> }) {
  const { scriptId } = await context.params;
  const script = await prisma.script.findFirst({
    where: { id: scriptId, deletedAt: null },
    include: {
      project: true,
      scenes: { orderBy: { position: 'asc' }, include: { evidence: true, continuityIssues: true } },
      continuityIssues: { orderBy: { createdAt: 'desc' } },
      revisions: { take: 10, orderBy: { version: 'desc' } },
      automationRuns: { take: 10, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!script) return NextResponse.json({ error: { code: 'SCRIPT_NOT_FOUND', message: 'Script not found.' } }, { status: 404 });
  return NextResponse.json(script);
}
