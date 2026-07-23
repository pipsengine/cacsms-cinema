import { prisma } from '@/lib/db';
import type { IntelligenceOverview, Opportunity, OpportunityStatus } from './contracts';

type PackageRow = {
  strategy_version_id: string;
  version_number: number;
  checksum: string;
  status: string;
};

type RunRow = {
  id: string;
  status: string;
  started_at: Date | null;
};

type CountRow = { status: string; count: number | bigint };
type BlockerRow = { id: string; severity: string; message: string };

export class IntelligenceRepository {
  async overview(): Promise<IntelligenceOverview> {
    try {
      const packages = await prisma.$queryRaw<PackageRow[]>`
        SELECT TOP 1
          CONVERT(varchar(36), strategy_version_id) AS strategy_version_id,
          version_number,
          checksum,
          status
        FROM ci_strategy_packages
        WHERE status = 'ACKNOWLEDGED'
        ORDER BY acknowledged_at DESC
      `;

      const runs = await prisma.$queryRaw<RunRow[]>`
        SELECT TOP 1
          CONVERT(varchar(36), id) AS id,
          status,
          started_at
        FROM ci_discovery_runs
        ORDER BY created_at DESC
      `;

      const counts = await prisma.$queryRaw<CountRow[]>`
        SELECT status, COUNT(*) AS count
        FROM ci_opportunities
        GROUP BY status
      `;

      const blockers = await prisma.$queryRaw<BlockerRow[]>`
        SELECT TOP 20
          CONVERT(varchar(36), id) AS id,
          severity,
          message
        FROM ci_blockers
        WHERE resolved_at IS NULL
        ORDER BY created_at DESC
      `;

      const packageRow = packages[0];
      const run = runs[0];
      const metrics = Object.fromEntries(
        counts.map((row) => [String(row.status).toLowerCase(), Number(row.count)]),
      );

      return {
        available: true,
        strategy: packageRow
          ? {
              versionId: packageRow.strategy_version_id,
              versionNumber: Number(packageRow.version_number),
              checksum: packageRow.checksum,
              status: packageRow.status,
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
          'sources',
          'signals',
          'candidates',
          'verification',
          'duplicates',
          'scoring',
          'ranking',
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
            : 'Content Intelligence tables are unavailable. Run the CI migration.',
      };
    }
  }

  async list(): Promise<Opportunity[]> {
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
        created_at AS createdAt
      FROM ci_opportunities
      ORDER BY created_at DESC
    `;

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      status: row.status as OpportunityStatus,
      domain: row.domain,
      geography: row.geography ?? undefined,
      audience: row.audience ?? undefined,
      score: Number(row.score),
      confidence: Number(row.confidence),
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
