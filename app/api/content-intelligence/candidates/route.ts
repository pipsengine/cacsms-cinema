import { NextResponse } from 'next/server';
import { candidateInput } from '@/lib/content-intelligence';
import { loadCandidateIdeas } from '@/lib/content-intelligence/candidates';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadCandidateIdeas());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load candidate ideas';
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = candidateInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid candidate', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { message: 'Use the discovery worker to persist provenance-linked candidates' },
    { status: 501 },
  );
}
