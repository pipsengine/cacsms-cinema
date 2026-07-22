import { NextRequest, NextResponse } from 'next/server';
import { SystemStatusMonitor } from '@/lib/system-status';

export async function GET(request: NextRequest) {
  try {
    const status = await SystemStatusMonitor.getStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Failed to get system status:', error);
    return NextResponse.json(
      { error: 'Failed to get system status' },
      { status: 500 }
    );
  }
}
