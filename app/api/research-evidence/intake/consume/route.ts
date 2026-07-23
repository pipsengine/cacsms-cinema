import { NextRequest, NextResponse } from 'next/server';
import { intakePackage, ResearchService } from '@/lib/research-evidence';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = intakePackage.partial().safeParse(raw ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid intake package', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const hasPartial =
      Boolean(data.projectId) ||
      Boolean(data.ideaQualificationHandoffId) ||
      Boolean(data.strategyVersionId) ||
      Boolean(data.checksum) ||
      Boolean(data.packageJson);

    if (hasPartial) {
      const full = intakePackage.safeParse(data);
      if (!full.success) {
        return NextResponse.json(
          { message: 'Invalid intake package', issues: full.error.issues },
          { status: 400 },
        );
      }
      const service = new ResearchService();
      return NextResponse.json(await service.consumeIntake(full.data));
    }

    const service = new ResearchService();
    return NextResponse.json(await service.consumeIntake({}));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Intake consume failed';
    return NextResponse.json({ message }, { status: 400 });
  }
}
