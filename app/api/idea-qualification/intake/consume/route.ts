import { NextRequest, NextResponse } from 'next/server';
import { intakePackage, QualificationService } from '@/lib/idea-qualification';

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
      Boolean(data.sourceRunId) ||
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
      const service = new QualificationService();
      return NextResponse.json(await service.consumeIntake(full.data));
    }

    const service = new QualificationService();
    return NextResponse.json(await service.consumeIntake({}));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Intake consume failed';
    return NextResponse.json({ message }, { status: 400 });
  }
}
