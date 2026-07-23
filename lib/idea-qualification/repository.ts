import { prisma } from '@/lib/db';
import type { Candidate, QualificationOverview, QualificationStatus } from './contracts';

type IntakeRow = {
  id: string;
  source_run_id: string;
  checksum: string;
  status: string;
  received_at: Date;
};

type CycleRow = {
  id: string;
  status: string;
  started_at: Date | null;
};

type CountRow = { status: string; count: number | bigint };
type BlockerRow = { id: string; severity: string; message: string };

export class QualificationRepository {
  async overview(): Promise<QualificationOverview> {
    try {
      const intakes = await prisma.$queryRaw<IntakeRow[]>`
        SELECT TOP 1
          CONVERT(varchar(36), id) AS id,
          CONVERT(varchar(36), source_run_id) AS source_run_id,
          checksum,
          status,
          received_at
        FROM iq_intake_packages
        WHERE status = 'ACKNOWLEDGED'
        ORDER BY acknowledged_at DESC
      `;

      const cycles = await prisma.$queryRaw<CycleRow[]>`
        SELECT TOP 1
          CONVERT(varchar(36), id) AS id,
          status,
          started_at
        FROM iq_cycles
        ORDER BY created_at DESC
      `;

      const counts = await prisma.$queryRaw<CountRow[]>`
        SELECT status, COUNT(*) AS count
        FROM iq_candidates
        GROUP BY status
      `;

      const blockers = await prisma.$queryRaw<BlockerRow[]>`
        SELECT TOP 20
          CONVERT(varchar(36), id) AS id,
          severity,
          message
        FROM iq_blockers
        WHERE resolved_at IS NULL
        ORDER BY created_at DESC
      `;

      const intake = intakes[0];
      const cycle = cycles[0];
      const metrics = Object.fromEntries(
        counts.map((row) => [String(row.status).toLowerCase(), Number(row.count)]),
      );

      return {
        available: true,
        intake: intake
          ? {
              packageId: intake.id,
              runId: intake.source_run_id,
              checksum: intake.checksum,
              status: intake.status,
              receivedAt: intake.received_at.toISOString(),
            }
          : undefined,
        cycle: cycle
          ? {
              id: cycle.id,
              status: cycle.status,
              startedAt: cycle.started_at?.toISOString() ?? new Date(0).toISOString(),
            }
          : undefined,
        metrics,
        pipeline: [
          'intake',
          'normalisation',
          'evidence',
          'duplicates',
          'scoring',
          'gates',
          'ranking',
          'decision',
          'handoff',
        ].map((stage) => ({
          stage,
          status: cycle?.status ?? 'NOT_STARTED',
          count: 0,
        })),
        blockers: blockers.map((row) => ({
          id: row.id,
          severity: row.severity,
          message: row.message,
        })),
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      return {
        available: false,
        reason:
          error instanceof Error
            ? error.message.replace(/password|secret|token/gi, '[redacted]')
            : 'Idea Qualification tables are unavailable. Run the IQ migration.',
      };
    }
  }

  async list(): Promise<Candidate[]> {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        summary: string;
        status: string;
        domain: string;
        geography: string | null;
        audience: string | null;
        score: number | string;
        confidence: number | string;
        gateStatus: string;
        decision: string | null;
        createdAt: Date;
      }>
    >`
      SELECT TOP 200
        CONVERT(varchar(36), id) AS id,
        title,
        summary,
        status,
        domain,
        geography,
        audience,
        score,
        confidence,
        gate_status AS gateStatus,
        decision,
        created_at AS createdAt
      FROM iq_candidates
      ORDER BY created_at DESC
    `;

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      status: row.status as QualificationStatus,
      domain: row.domain,
      geography: row.geography ?? undefined,
      audience: row.audience ?? undefined,
      score: Number(row.score),
      confidence: Number(row.confidence),
      gateStatus: row.gateStatus,
      decision: row.decision ?? undefined,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
