import { prisma } from '@/lib/db';
import type { ResearchOverview, ResearchRecord, ResearchStatus } from './contracts';

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

export class ResearchRepository {
  async overview(): Promise<ResearchOverview> {
    try {
      const intakes = await prisma.$queryRaw<IntakeRow[]>`
        SELECT TOP 1
          CONVERT(varchar(36), id) AS id,
          CONVERT(varchar(36), source_run_id) AS source_run_id,
          checksum,
          status,
          received_at
        FROM re_intake_packages
        WHERE status = 'ACKNOWLEDGED'
        ORDER BY acknowledged_at DESC
      `;

      const cycles = await prisma.$queryRaw<CycleRow[]>`
        SELECT TOP 1
          CONVERT(varchar(36), id) AS id,
          status,
          started_at
        FROM re_cycles
        ORDER BY created_at DESC
      `;

      const counts = await prisma.$queryRaw<CountRow[]>`
        SELECT status, COUNT(*) AS count
        FROM re_claims
        GROUP BY status
      `;

      const blockers = await prisma.$queryRaw<BlockerRow[]>`
        SELECT TOP 20
          CONVERT(varchar(36), id) AS id,
          severity,
          message
        FROM re_blockers
        WHERE resolved_at IS NULL
        ORDER BY created_at DESC
      `;

      const intake = intakes[0];
      const run = cycles[0];
      const metrics = Object.fromEntries(
        counts.map((row) => [String(row.status).toLowerCase(), Number(row.count)]),
      ) as Record<string, number>;
      metrics.verifiedClaims = metrics.verified ?? 0;

      return {
        available: true,
        intake: intake
          ? {
              packageId: intake.id,
              projectId: intake.source_run_id,
              checksum: intake.checksum,
              status: intake.status,
              receivedAt: intake.received_at.toISOString(),
            }
          : undefined,
        run: run
          ? {
              id: run.id,
              status: run.status,
              startedAt: run.started_at?.toISOString() ?? new Date(0).toISOString(),
            }
          : undefined,
        metrics,
        pipeline: [
          'intake',
          'planning',
          'discovery',
          'extraction',
          'claim_mapping',
          'verification',
          'rights',
          'dossier',
          'handoff',
        ].map((stage) => ({
          stage,
          status: run?.status ?? 'NOT_STARTED',
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
            : 'Research & Evidence tables are unavailable. Run the research migration.',
      };
    }
  }

  async list(): Promise<ResearchRecord[]> {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        summary: string;
        recordType: string;
        status: string;
        authorityScore: number | null;
        confidence: number | string | null;
        claimCoverage: number | null;
        rightsStatus: string | null;
        createdAt: Date;
      }>
    >`
      SELECT TOP 200
        CONVERT(varchar(36), id) AS id,
        claim_text AS title,
        claim_text AS summary,
        'CLAIM' AS recordType,
        CASE
          WHEN status = 'VERIFIED' THEN 'READY'
          WHEN status = 'UNVERIFIED' THEN 'VERIFYING'
          ELSE status
        END AS status,
        NULL AS authorityScore,
        confidence,
        NULL AS claimCoverage,
        NULL AS rightsStatus,
        created_at AS createdAt
      FROM re_claims
      ORDER BY created_at DESC
    `;

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      recordType: row.recordType,
      status: row.status as ResearchStatus,
      authorityScore: row.authorityScore ?? undefined,
      confidence: row.confidence == null ? undefined : Number(row.confidence),
      claimCoverage: row.claimCoverage ?? undefined,
      rightsStatus: row.rightsStatus ?? undefined,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
