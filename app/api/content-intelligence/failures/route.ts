import { NextResponse } from 'next/server';
import { loadFailureRecovery } from '@/lib/content-intelligence/failures';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadFailureRecovery());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load failure recovery';
    return NextResponse.json({ message }, { status: 400 });
  }
}
