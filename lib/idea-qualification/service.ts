import { createHash, randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import type { IntakePackage } from './contracts';

export class QualificationService {
  /**
   * Verify and acknowledge a Content Intelligence intake package.
   * When fields are omitted, builds from the latest CI discovery run with opportunities
   * (or fails honestly if none exist).
   */
  async consumeIntake(input: Partial<IntakePackage> = {}) {
    let sourceRunId = input.sourceRunId;
    let strategyVersionId = input.strategyVersionId;
    let checksum = input.checksum;
    let packageJson = input.packageJson;

    if (!sourceRunId || !strategyVersionId || !checksum || !packageJson) {
      const built = await this.buildIntakeFromContentIntelligence();
      sourceRunId = built.sourceRunId;
      strategyVersionId = built.strategyVersionId;
      checksum = built.checksum;
      packageJson = built.packageJson;
    }

    const hash = createHash('sha256').update(packageJson).digest('hex');
    if (hash.toLowerCase() !== checksum.toLowerCase()) {
      throw new Error('Content Intelligence package checksum mismatch');
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          MERGE iq_intake_packages WITH (HOLDLOCK) AS t
          USING (
            SELECT
              CONVERT(uniqueidentifier, ${sourceRunId}) AS source_run_id,
              ${checksum} AS checksum
          ) AS s
          ON t.source_run_id = s.source_run_id AND t.checksum = s.checksum
          WHEN NOT MATCHED THEN
            INSERT (
              source_run_id, strategy_version_id, checksum, package_json,
              status, received_at, acknowledged_at
            )
            VALUES (
              CONVERT(uniqueidentifier, ${sourceRunId}),
              CONVERT(uniqueidentifier, ${strategyVersionId}),
              ${checksum},
              ${packageJson},
              ${'ACKNOWLEDGED'},
              sysutcdatetime(),
              sysutcdatetime()
            )
          WHEN MATCHED AND t.status <> 'ACKNOWLEDGED' THEN
            UPDATE SET status = 'ACKNOWLEDGED', acknowledged_at = sysutcdatetime();
        `;

        await tx.$executeRaw`
          UPDATE ci_handoffs
          SET status = 'ACKNOWLEDGED',
              acknowledged_at = sysutcdatetime()
          WHERE checksum = ${checksum}
            AND status IN ('PENDING', 'DISPATCHED')
        `;

        await tx.$executeRaw`
          INSERT INTO iq_audit_events(action, actor_type, reason, new_value)
          VALUES (
            ${'INTAKE_PACKAGE_ACKNOWLEDGED'},
            ${'SERVICE'},
            ${'Consumed Content Intelligence package after checksum verification'},
            ${checksum}
          )
        `;
      },
      { isolationLevel: 'Serializable' },
    );

    return { status: 'ACKNOWLEDGED', checksum: hash };
  }

  private async buildIntakeFromContentIntelligence(): Promise<IntakePackage> {
    const runs = await prisma.$queryRaw<
      Array<{
        runId: string;
        strategyVersionId: string;
        packageChecksum: string;
      }>
    >`
      SELECT TOP 1
        CONVERT(varchar(36), r.id) AS runId,
        CONVERT(varchar(36), p.strategy_version_id) AS strategyVersionId,
        p.checksum AS packageChecksum
      FROM ci_discovery_runs r
      JOIN ci_strategy_packages p ON p.id = r.strategy_package_id
      WHERE p.status = 'ACKNOWLEDGED'
      ORDER BY r.created_at DESC
    `;

    const run = runs[0];
    if (!run) {
      throw new Error('No Content Intelligence discovery run available to consume');
    }

    const opportunities = await prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        summary: string;
        domain: string;
        geography: string | null;
        audience: string | null;
        status: string;
        score: number | string;
        confidence: number | string;
      }>
    >`
      SELECT
        CONVERT(varchar(36), id) AS id,
        title,
        summary,
        domain,
        geography,
        audience,
        status,
        score,
        confidence
      FROM ci_opportunities
      WHERE run_id = CONVERT(uniqueidentifier, ${run.runId})
      ORDER BY score DESC, created_at DESC
    `;

    if (!opportunities.length) {
      throw new Error(
        'No Content Intelligence candidate package available. Discovery must produce verified opportunities first.',
      );
    }

    const packageJson = JSON.stringify({
      sourceRunId: run.runId,
      strategyVersionId: run.strategyVersionId,
      strategyChecksum: run.packageChecksum,
      candidates: opportunities.map((row) => ({
        opportunityId: row.id,
        title: row.title,
        summary: row.summary,
        domain: row.domain,
        geography: row.geography,
        audience: row.audience,
        status: row.status,
        score: Number(row.score),
        confidence: Number(row.confidence),
      })),
      generatedAt: new Date().toISOString(),
    });
    const checksum = createHash('sha256').update(packageJson).digest('hex');

    return {
      sourceRunId: run.runId,
      strategyVersionId: run.strategyVersionId,
      checksum,
      packageJson,
    };
  }

  async startCycle(idempotencyKey: string) {
    return prisma.$transaction(
      async (tx) => {
        const intake = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT TOP 1 CONVERT(varchar(36), id) AS id
          FROM iq_intake_packages WITH (UPDLOCK, HOLDLOCK)
          WHERE status = 'ACKNOWLEDGED'
          ORDER BY acknowledged_at DESC
        `;
        if (!intake[0]) {
          throw new Error('No acknowledged Content Intelligence intake package');
        }

        const existing = await tx.$queryRaw<Array<{ id: string; status: string }>>`
          SELECT CONVERT(varchar(36), id) AS id, status
          FROM iq_cycles
          WHERE idempotency_key = ${idempotencyKey}
        `;
        if (existing[0]) {
          return { cycleId: existing[0].id, status: existing[0].status };
        }

        const id = randomUUID();
        const payload = JSON.stringify({ cycleId: id });

        await tx.$executeRaw`
          INSERT INTO iq_cycles(id, intake_package_id, idempotency_key, status, started_at)
          VALUES (
            CONVERT(uniqueidentifier, ${id}),
            CONVERT(uniqueidentifier, ${intake[0].id}),
            ${idempotencyKey},
            ${'QUEUED'},
            sysutcdatetime()
          )
        `;
        await tx.$executeRaw`
          INSERT INTO iq_jobs(cycle_id, job_type, status, payload_json)
          VALUES (
            CONVERT(uniqueidentifier, ${id}),
            ${'QUALIFY_CANDIDATES'},
            ${'PENDING'},
            ${payload}
          )
        `;
        await tx.$executeRaw`
          INSERT INTO iq_outbox(event_type, aggregate_id, payload_json)
          VALUES (
            ${'QUALIFICATION_CYCLE_REQUESTED'},
            CONVERT(uniqueidentifier, ${id}),
            ${payload}
          )
        `;
        await tx.$executeRaw`
          INSERT INTO iq_audit_events(cycle_id, action, actor_type, reason)
          VALUES (
            CONVERT(uniqueidentifier, ${id}),
            ${'QUALIFICATION_CYCLE_QUEUED'},
            ${'DEVELOPMENT_USER'},
            ${'Qualification cycle queued; worker must evaluate with real evidence providers'}
          )
        `;

        return { cycleId: id, status: 'QUEUED' };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async handoff(candidateId: string, idempotencyKey: string) {
    return prisma.$transaction(
      async (tx) => {
        const candidates = await tx.$queryRaw<
          Array<{
            id: string;
            title: string;
            summary: string;
            status: string;
            score: number | string;
          }>
        >`
          SELECT
            CONVERT(varchar(36), id) AS id,
            title,
            summary,
            status,
            score
          FROM iq_candidates WITH (UPDLOCK, HOLDLOCK)
          WHERE id = CONVERT(uniqueidentifier, ${candidateId})
        `;

        const row = candidates[0];
        if (!row) throw new Error('Candidate not found');
        if (row.status !== 'SELECTED') {
          throw new Error('Only a selected candidate may be handed off');
        }

        const payload = JSON.stringify({
          candidateId: row.id,
          title: row.title,
          summary: row.summary,
          score: Number(row.score),
        });
        const checksum = createHash('sha256').update(payload).digest('hex');

        await tx.$executeRaw`
          IF NOT EXISTS (SELECT 1 FROM iq_handoffs WHERE idempotency_key = ${idempotencyKey})
          BEGIN
            INSERT INTO iq_handoffs(candidate_id, status, idempotency_key, checksum, payload_json)
            VALUES (
              CONVERT(uniqueidentifier, ${candidateId}),
              ${'PENDING'},
              ${idempotencyKey},
              ${checksum},
              ${payload}
            );
            INSERT INTO iq_outbox(event_type, aggregate_id, payload_json)
            VALUES (
              ${'CONTENT_PROJECT_CREATE_REQUESTED'},
              CONVERT(uniqueidentifier, ${candidateId}),
              ${payload}
            );
          END
        `;

        return { status: 'PENDING', checksum };
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
