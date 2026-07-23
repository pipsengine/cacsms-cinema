import { createHash, randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { REQUIRED_SECTIONS, isMutableStrategyStatus, type SectionKey } from './contracts';
import { OBJECTIVES_POLICY } from './objectives-policy';
import { DOMAINS_POLICY } from './domains-policy';
import { StrategyRepository } from './repository';

export class StrategyService {
  private readonly repo = new StrategyRepository();

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

  async startObjectivesRun(idempotencyKey: string) {
    await this.repo.ensureDraft();
    await this.repo.ensureAutonomyRunsTable();

    const overview = await this.repo.overview();
    if (!overview.versionId) throw new Error('No strategy version available');
    if (!isMutableStrategyStatus(overview.status)) {
      throw new Error('Activated strategy history is immutable; stop requires a mutable version');
    }

    const versionId = overview.versionId;
    const section: SectionKey = 'objectives';

    const existing = await prisma.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT CONVERT(varchar(36), id) AS id, status
      FROM strategy_autonomy_runs
      WHERE idempotency_key = ${idempotencyKey}
    `;
    if (existing[0]) {
      return { runId: existing[0].id, status: existing[0].status };
    }

    const active = await prisma.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT TOP 1 CONVERT(varchar(36), id) AS id, status
      FROM strategy_autonomy_runs
      WHERE version_id = CONVERT(uniqueidentifier, ${versionId})
        AND section_key = ${section}
        AND status IN ('QUEUED', 'RUNNING')
      ORDER BY created_at DESC
    `;
    if (active[0]) {
      return { runId: active[0].id, status: active[0].status };
    }

    const runId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO strategy_autonomy_runs(
        id, version_id, section_key, idempotency_key, status, started_at
      )
      VALUES (
        CONVERT(uniqueidentifier, ${runId}),
        CONVERT(uniqueidentifier, ${versionId}),
        ${section},
        ${idempotencyKey},
        ${'RUNNING'},
        sysutcdatetime()
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO strategy_audit_events(version_id, action, actor_type, request_id, reason)
      VALUES (
        CONVERT(uniqueidentifier, ${versionId}),
        ${'OBJECTIVES_AUTONOMY_STARTED'},
        ${'SYSTEM'},
        ${idempotencyKey},
        ${'Human start; system generates policy objectives without form input'}
      )
    `;

    return this.executeObjectivesRun(runId, versionId);
  }

  async stopObjectivesRun(runId?: string | null) {
    await this.repo.ensureAutonomyRunsTable();
    const overview = await this.repo.overview();
    if (!overview.versionId) throw new Error('No strategy version available');

    const target =
      runId ||
      (
        await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT TOP 1 CONVERT(varchar(36), id) AS id
          FROM strategy_autonomy_runs
          WHERE version_id = CONVERT(uniqueidentifier, ${overview.versionId})
            AND section_key = ${'objectives'}
            AND status IN ('QUEUED', 'RUNNING')
          ORDER BY created_at DESC
        `
      )[0]?.id;

    if (!target) {
      return { runId: null, status: 'IDLE' as const };
    }

    await prisma.$executeRaw`
      UPDATE strategy_autonomy_runs
      SET
        cancel_requested = 1,
        updated_at = sysutcdatetime()
      WHERE id = CONVERT(uniqueidentifier, ${target})
        AND status IN ('QUEUED', 'RUNNING')
    `;
    await prisma.$executeRaw`
      INSERT INTO strategy_audit_events(version_id, action, actor_type, reason)
      VALUES (
        CONVERT(uniqueidentifier, ${overview.versionId}),
        ${'OBJECTIVES_AUTONOMY_STOP_REQUESTED'},
        ${'DEVELOPMENT_USER'},
        ${'Human stop'}
      )
    `;

    return { runId: target, status: 'STOP_REQUESTED' as const };
  }

  /** Reconcile Field & Domain Profiles from system policy (no fabricated metrics). */
  async reconcileDomains(versionId?: string) {
    await this.repo.ensureDraft();
    const overview = await this.repo.overview();
    const targetVersionId = versionId ?? overview.versionId;
    if (!targetVersionId) throw new Error('No strategy version available');
    if (!isMutableStrategyStatus(overview.status) && !versionId) {
      throw new Error('Activated strategy history is immutable');
    }

    const existing = await this.repo.list(targetVersionId, 'domains');
    // Replace generic section stubs with detailed domain policy profiles.
    for (const record of existing) {
      const key = String(record.configuration?.systemKey ?? '');
      if (key === 'policy.domains' && record.id) {
        await this.repo.update(targetVersionId, 'domains', record.id, {
          name: record.name,
          description: record.description ?? '',
          status: 'ARCHIVED',
          priority: record.priority,
          configuration: { ...record.configuration, archivedReason: 'Superseded by domain policy profiles' },
          effectiveFrom: record.effectiveFrom ?? null,
          effectiveTo: record.effectiveTo ?? null,
        });
      }
    }

    const live = (await this.repo.list(targetVersionId, 'domains')).filter(
      (record) => record.status !== 'ARCHIVED',
    );
    const byKey = new Map(
      live
        .map((record) => [String(record.configuration?.systemKey ?? ''), record] as const)
        .filter(([key]) => Boolean(key)),
    );

    let created = 0;
    let updated = 0;
    for (const policy of DOMAINS_POLICY) {
      const systemKey = String(policy.configuration.systemKey);
      const prior = byKey.get(systemKey);
      if (prior?.id) {
        await this.repo.update(targetVersionId, 'domains', prior.id, {
          ...policy,
          id: prior.id,
        });
        updated += 1;
      } else {
        const record = await this.repo.create(targetVersionId, 'domains', policy);
        if (record.id) byKey.set(systemKey, record);
        created += 1;
      }
    }

    await prisma.$executeRaw`
      INSERT INTO strategy_audit_events(version_id, action, actor_type, new_value, reason)
      VALUES (
        CONVERT(uniqueidentifier, ${targetVersionId}),
        ${'DOMAINS_POLICY_RECONCILED'},
        ${'SYSTEM'},
        ${JSON.stringify({ created, updated, policyCount: DOMAINS_POLICY.length })},
        ${'Field & domain profiles reconciled from system policy; no coverage metrics fabricated'}
      )
    `;

    return { created, updated, total: DOMAINS_POLICY.length };
  }

  private async executeObjectivesRun(runId: string, versionId: string) {
    let created = 0;
    let updated = 0;
    let cancelled = false;

    try {
      const existing = await this.repo.list(versionId, 'objectives');
      const byKey = new Map(
        existing
          .map((record) => [String(record.configuration?.systemKey ?? ''), record] as const)
          .filter(([key]) => Boolean(key)),
      );

      for (const policy of OBJECTIVES_POLICY) {
        const flags = await prisma.$queryRaw<Array<{ cancelRequested: boolean | number }>>`
          SELECT cancel_requested AS cancelRequested
          FROM strategy_autonomy_runs
          WHERE id = CONVERT(uniqueidentifier, ${runId})
        `;
        if (flags[0] && Boolean(flags[0].cancelRequested)) {
          cancelled = true;
          break;
        }

        const systemKey = String(policy.configuration.systemKey);
        const prior = byKey.get(systemKey);
        if (prior?.id) {
          await this.repo.update(versionId, 'objectives', prior.id, {
            ...policy,
            id: prior.id,
          });
          updated += 1;
        } else {
          const record = await this.repo.create(versionId, 'objectives', policy);
          if (record.id) byKey.set(systemKey, record);
          created += 1;
        }
      }

      const summary = JSON.stringify({
        created,
        updated,
        policyCount: OBJECTIVES_POLICY.length,
        metricsFabricated: false,
      });
      const status = cancelled ? 'CANCELLED' : 'COMPLETED';

      await prisma.$executeRaw`
        UPDATE strategy_autonomy_runs
        SET
          status = ${status},
          summary_json = ${summary},
          completed_at = sysutcdatetime(),
          updated_at = sysutcdatetime()
        WHERE id = CONVERT(uniqueidentifier, ${runId})
      `;
      await prisma.$executeRaw`
        INSERT INTO strategy_audit_events(version_id, action, actor_type, new_value, reason)
        VALUES (
          CONVERT(uniqueidentifier, ${versionId}),
          ${cancelled ? 'OBJECTIVES_AUTONOMY_CANCELLED' : 'OBJECTIVES_AUTONOMY_COMPLETED'},
          ${'SYSTEM'},
          ${summary},
          ${cancelled ? 'Stopped by human' : 'Policy objectives reconciled; baselines remain UNMEASURED'}
        )
      `;

      return { runId, status, created, updated };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Objectives autonomy failed';
      await prisma.$executeRaw`
        UPDATE strategy_autonomy_runs
        SET
          status = ${'FAILED'},
          failure_reason = ${message},
          completed_at = sysutcdatetime(),
          updated_at = sysutcdatetime()
        WHERE id = CONVERT(uniqueidentifier, ${runId})
      `;
      throw error;
    }
  }
}
