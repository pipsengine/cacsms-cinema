import { NextResponse } from 'next/server';
import { loadPortfolioBalance } from '@/lib/content-intelligence/portfolio';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadPortfolioBalance());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load portfolio balance';
    return NextResponse.json({ message }, { status: 400 });
  }
}
