import { createHash, randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import type { ConsumeStrategyInput } from './contracts';

export class IntelligenceService {
  /**
   * Persist and acknowledge a Strategy Package after SHA-256 verification.
   * When body fields are omitted, consumes the currently ACTIVE Stage 01 package.
   */
  async consumeStrategy(input: ConsumeStrategyInput = {}) {
    let strategyVersionId = input.strategyVersionId;
    let versionNumber = input.versionNumber;
    let checksum = input.checksum;
    let packageJson = input.packageJson;

    if (!strategyVersionId || !versionNumber || !checksum || !packageJson) {
      const active = await prisma.$queryRaw<
        Array<{
          versionId: string;
          versionNumber: number;
          checksum: string;
          packageJson: string;
          handoffId: string | null;
        }>
      >`
        SELECT TOP 1
          CONVERT(varchar(36), v.id) AS versionId,
          v.version_number AS versionNumber,
          p.checksum AS checksum,
          p.package_json AS packageJson,
          CONVERT(varchar(36), h.id) AS handoffId
        FROM content_strategy_versions v
        JOIN strategy_packages p ON p.version_id = v.id
        OUTER APPLY (
          SELECT TOP 1 id
          FROM strategy_handoffs
          WHERE package_id = p.id
          ORDER BY created_at DESC
        ) h
        WHERE v.status = 'ACTIVE'
        ORDER BY v.effective_date DESC
      `;

      const row = active[0];
      if (!row) {
        throw new Error('No ACTIVE Strategy Package available to consume');
      }
      strategyVersionId = row.versionId;
      versionNumber = Number(row.versionNumber);
      checksum = row.checksum;
      packageJson = row.packageJson;

      const hash = createHash('sha256').update(packageJson).digest('hex');
      if (hash !== checksum) {
        throw new Error('Strategy package checksum mismatch');
      }

      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          MERGE ci_strategy_packages WITH (HOLDLOCK) AS t
          USING (
            SELECT
              CONVERT(uniqueidentifier, ${strategyVersionId}) AS version_id,
              ${checksum} AS checksum
          ) AS s
          ON t.strategy_version_id = s.version_id AND t.checksum = s.checksum
          WHEN NOT MATCHED THEN
            INSERT (strategy_version_id, version_number, checksum, package_json, status, acknowledged_at)
            VALUES (
              CONVERT(uniqueidentifier, ${strategyVersionId}),
              ${versionNumber},
              ${checksum},
              ${packageJson},
              ${'ACKNOWLEDGED'},
              sysutcdatetime()
            )
          WHEN MATCHED AND t.status <> 'ACKNOWLEDGED' THEN
            UPDATE SET status = 'ACKNOWLEDGED', acknowledged_at = sysutcdatetime();
        `;

        if (row.handoffId) {
          await tx.$executeRaw`
            UPDATE strategy_handoffs
            SET status = 'ACKNOWLEDGED',
                acknowledged_checksum = ${checksum},
                consumed_at = sysutcdatetime(),
                updated_at = sysutcdatetime()
            WHERE id = CONVERT(uniqueidentifier, ${row.handoffId})
              AND status <> 'ACKNOWLEDGED'
          `;
        }

        await tx.$executeRaw`
          INSERT INTO ci_audit_events(action, actor_type, reason, new_value)
          VALUES (
            ${'STRATEGY_PACKAGE_ACKNOWLEDGED'},
            ${'SERVICE'},
            ${'Consumed active Stage 01 package after checksum verification'},
            ${checksum}
          )
        `;
      });

      return { status: 'ACKNOWLEDGED', checksum };
    }

    const hash = createHash('sha256').update(packageJson).digest('hex');
    if (hash !== checksum) {
      throw new Error('Strategy package checksum mismatch');
    }

    await prisma.$executeRaw`
      MERGE ci_strategy_packages WITH (HOLDLOCK) AS t
      USING (
        SELECT
          CONVERT(uniqueidentifier, ${strategyVersionId}) AS version_id,
          ${checksum} AS checksum
      ) AS s
      ON t.strategy_version_id = s.version_id AND t.checksum = s.checksum
      WHEN NOT MATCHED THEN
        INSERT (strategy_version_id, version_number, checksum, package_json, status, acknowledged_at)
        VALUES (
          CONVERT(uniqueidentifier, ${strategyVersionId}),
          ${versionNumber},
          ${checksum},
          ${packageJson},
          ${'ACKNOWLEDGED'},
          sysutcdatetime()
        )
      WHEN MATCHED AND t.status <> 'ACKNOWLEDGED' THEN
        UPDATE SET status = 'ACKNOWLEDGED', acknowledged_at = sysutcdatetime();
    `;

    return { status: 'ACKNOWLEDGED', checksum: hash };
  }

  async startRun(idempotencyKey: string) {
    return prisma.$transaction(
      async (tx) => {
        const active = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT TOP 1 CONVERT(varchar(36), id) AS id
          FROM ci_strategy_packages WITH (UPDLOCK, HOLDLOCK)
          WHERE status = 'ACKNOWLEDGED'
          ORDER BY acknowledged_at DESC
        `;
        if (!active[0]) {
          throw new Error('No acknowledged Strategy Package');
        }

        const existing = await tx.$queryRaw<Array<{ id: string; status: string }>>`
          SELECT CONVERT(varchar(36), id) AS id, status
          FROM ci_discovery_runs
          WHERE idempotency_key = ${idempotencyKey}
        `;
        if (existing[0]) {
          return { runId: existing[0].id, status: existing[0].status };
        }

        const id = randomUUID();
        const payload = JSON.stringify({ runId: id });

        await tx.$executeRaw`
          INSERT INTO ci_discovery_runs(id, strategy_package_id, idempotency_key, status, started_at)
          VALUES (
            CONVERT(uniqueidentifier, ${id}),
            CONVERT(uniqueidentifier, ${active[0].id}),
            ${idempotencyKey},
            ${'QUEUED'},
            sysutcdatetime()
          )
        `;
        await tx.$executeRaw`
          INSERT INTO ci_outbox(event_type, aggregate_id, payload_json)
          VALUES (
            ${'DISCOVERY_RUN_REQUESTED'},
            CONVERT(uniqueidentifier, ${id}),
            ${payload}
          )
        `;
        await tx.$executeRaw`
          INSERT INTO ci_audit_events(run_id, action, actor_type, reason)
          VALUES (
            CONVERT(uniqueidentifier, ${id}),
            ${'DISCOVERY_RUN_QUEUED'},
            ${'DEVELOPMENT_USER'},
            ${'Discovery run queued; worker must execute with real providers'}
          )
        `;

        return { runId: id, status: 'QUEUED' };
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
