import { createHash, randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { REQUIRED_SECTIONS } from './contracts';

export class StrategyService {
  async validate(versionId: string, idempotencyKey?: string | null) {
    return prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.$queryRaw<Array<{ id: string; status: string }>>`
          SELECT CONVERT(varchar(36), id) AS id, status
          FROM strategy_validation_runs
          WHERE version_id = CONVERT(uniqueidentifier, ${versionId})
            AND idempotency_key = ${idempotencyKey}
        `;
        if (existing[0]) return existing[0];
      }

      const runId = randomUUID();
      await tx.$executeRaw`
        INSERT INTO strategy_validation_runs(id, version_id, idempotency_key, status)
        VALUES (
          CONVERT(uniqueidentifier, ${runId}),
          CONVERT(uniqueidentifier, ${versionId}),
          ${idempotencyKey ?? null},
          ${'RUNNING'}
        )
      `;

      const counts = await tx.$queryRaw<Array<{ section_key: string; total: number | bigint }>>`
        SELECT section_key, COUNT(*) AS total
        FROM strategy_records
        WHERE version_id = CONVERT(uniqueidentifier, ${versionId})
          AND archived_at IS NULL
          AND status = 'ACTIVE'
        GROUP BY section_key
      `;
      const present = new Set(counts.map((row) => row.section_key));

      for (const key of REQUIRED_SECTIONS) {
        const passed = present.has(key) ? 1 : 0;
        const code = `REQUIRED_${key.toUpperCase().replaceAll('-', '_')}`;
        const explanation = passed
          ? 'Requirement satisfied'
          : 'At least one active record is required';
        await tx.$executeRaw`
          INSERT INTO strategy_validation_results(
            run_id, rule_code, rule_version, severity, passed, blocking, section_key, explanation, recommendation
          ) VALUES (
            CONVERT(uniqueidentifier, ${runId}),
            ${code},
            1,
            ${'CRITICAL'},
            ${passed},
            1,
            ${key},
            ${explanation},
            ${'Configure this section'}
          )
        `;
      }

      const ready = REQUIRED_SECTIONS.every((key) => present.has(key));
      const nextStatus = ready ? 'READY' : 'INVALID';

      await tx.$executeRaw`
        UPDATE strategy_validation_runs
        SET status = 'COMPLETED', completed_at = sysutcdatetime()
        WHERE id = CONVERT(uniqueidentifier, ${runId})
      `;
      await tx.$executeRaw`
        UPDATE content_strategy_versions
        SET status = ${nextStatus}, last_validated_at = sysutcdatetime(), updated_at = sysutcdatetime()
        WHERE id = CONVERT(uniqueidentifier, ${versionId})
      `;

      return { id: runId, status: nextStatus };
    });
  }

  async activate(versionId: string, idempotencyKey: string) {
    return prisma.$transaction(
      async (tx) => {
        const versions = await tx.$queryRaw<
          Array<{
            id: string;
            strategyId: string;
            name: string;
            status: string;
            version_number: number;
          }>
        >`
          SELECT
            CONVERT(varchar(36), v.id) AS id,
            CONVERT(varchar(36), s.id) AS strategyId,
            s.name AS name,
            v.status AS status,
            v.version_number AS version_number
          FROM content_strategy_versions v WITH (UPDLOCK, HOLDLOCK)
          JOIN content_strategies s ON s.id = v.strategy_id
          WHERE v.id = CONVERT(uniqueidentifier, ${versionId})
        `;

        const version = versions[0];
        if (!version) throw new Error('Version not found');
        if (version.status === 'ACTIVE') return { status: 'ACTIVE', idempotent: true as const };
        if (version.status !== 'READY') throw new Error('Version must be READY');

        const rows = await tx.$queryRaw<
          Array<{
            section_key: string;
            record_name: string;
            status: string;
            priority: number;
            configuration_json: string;
          }>
        >`
          SELECT section_key, record_name, status, priority, configuration_json
          FROM strategy_records
          WHERE version_id = CONVERT(uniqueidentifier, ${versionId})
            AND archived_at IS NULL
          ORDER BY section_key, priority DESC
        `;

        const payload = {
          strategyId: version.strategyId,
          strategyVersionId: version.id,
          versionNumber: Number(version.version_number),
          effectiveDate: new Date().toISOString(),
          records: rows.map((row) => ({
            section_key: row.section_key,
            record_name: row.record_name,
            status: row.status,
            priority: Number(row.priority),
            configuration: JSON.parse(row.configuration_json || '{}'),
          })),
          generatedAt: new Date().toISOString(),
        };

        const json = JSON.stringify(payload);
        const checksum = createHash('sha256').update(json).digest('hex');
        const packageId = randomUUID();
        const handoffId = randomUUID();

        await tx.$executeRaw`
          UPDATE content_strategy_versions
          SET status = 'SUPERSEDED', updated_at = sysutcdatetime()
          WHERE strategy_id = CONVERT(uniqueidentifier, ${version.strategyId})
            AND status = 'ACTIVE'
        `;
        await tx.$executeRaw`
          UPDATE content_strategy_versions
          SET status = 'ACTIVE', effective_date = sysutcdatetime(), updated_at = sysutcdatetime()
          WHERE id = CONVERT(uniqueidentifier, ${versionId})
        `;
        await tx.$executeRaw`
          INSERT INTO strategy_packages(id, version_id, checksum, package_json)
          VALUES (
            CONVERT(uniqueidentifier, ${packageId}),
            CONVERT(uniqueidentifier, ${versionId}),
            ${checksum},
            ${json}
          )
        `;
        await tx.$executeRaw`
          INSERT INTO strategy_handoffs(id, package_id, status)
          VALUES (
            CONVERT(uniqueidentifier, ${handoffId}),
            CONVERT(uniqueidentifier, ${packageId}),
            ${'PENDING'}
          )
        `;
        await tx.$executeRaw`
          INSERT INTO strategy_outbox(event_type, aggregate_id, payload_json)
          VALUES (
            ${'STRATEGY_ACTIVATED'},
            CONVERT(uniqueidentifier, ${handoffId}),
            ${json}
          )
        `;
        await tx.$executeRaw`
          INSERT INTO strategy_audit_events(version_id, action, actor_type, request_id, new_value)
          VALUES (
            CONVERT(uniqueidentifier, ${versionId}),
            ${'VERSION_ACTIVATED'},
            ${'SYSTEM'},
            ${idempotencyKey},
            ${json}
          )
        `;

        return { status: 'ACTIVE', checksum, handoffId };
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
