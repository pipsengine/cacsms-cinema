import { createHash, randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { REQUIRED_SECTIONS, isMutableStrategyStatus, type SectionKey } from './contracts';
import { OBJECTIVES_POLICY } from './objectives-policy';
import { DOMAINS_POLICY } from './domains-policy';
import { GEOGRAPHIES_POLICY } from './geographies-policy';
import { AUDIENCES_POLICY } from './audiences-policy';
import { EDITORIAL_POLICY } from './editorial-policy';
import { FORMATS_POLICY } from './formats-policy';
import { CHANNELS_POLICY } from './channels-policy';
import { LOCALISATION_POLICY } from './localisation-policy';
import { SOURCE_POLICY } from './source-policy';
import { RISK_POLICY } from './risk-policy';
import { SELECTION_THRESHOLDS } from './selection-thresholds';
import { PORTFOLIO_POLICY } from './portfolio';
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

      const activeConfigs = await tx.$queryRaw<
        Array<{ section_key: string; configuration_json: string }>
      >`
        SELECT section_key, configuration_json
        FROM strategy_records
        WHERE version_id = CONVERT(uniqueidentifier, ${versionId})
          AND archived_at IS NULL
          AND status = 'ACTIVE'
      `;
      const policyOnly = new Set<string>();
      const bySection = new Map<string, string[]>();
      for (const row of activeConfigs) {
        const list = bySection.get(row.section_key) ?? [];
        list.push(row.configuration_json || '{}');
        bySection.set(row.section_key, list);
      }
      for (const [section, configs] of bySection) {
        const allStubs = configs.every((raw) => {
          try {
            const config = JSON.parse(raw) as { systemKey?: string };
            const key = String(config.systemKey ?? '');
            return !key || key.startsWith('policy.');
          } catch {
            return true;
          }
        });
        if (allStubs) policyOnly.add(section);
      }

      for (const key of REQUIRED_SECTIONS) {
        const passed = present.has(key) ? 1 : 0;
        const code = `REQUIRED_${key.toUpperCase().replaceAll('-', '_')}`;
        const explanation = passed
          ? `Expected ≥1 ACTIVE record; actual ${bySection.get(key)?.length ?? 0}`
          : 'Expected ≥1 ACTIVE record; actual 0';
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
            ${passed ? 'Section presence satisfied' : 'Start Stage 01 autonomy so this section materialises'}
          )
        `;

        if (passed && policyOnly.has(key)) {
          await tx.$executeRaw`
            INSERT INTO strategy_validation_results(
              run_id, rule_code, rule_version, severity, passed, blocking, section_key, explanation, recommendation
            ) VALUES (
              CONVERT(uniqueidentifier, ${runId}),
              ${`STUB_ONLY_${key.toUpperCase().replaceAll('-', '_')}`},
              1,
              ${'WARNING'},
              0,
              0,
              ${key},
              ${'Section has ACTIVE records but only baseline policy stubs — reconcile system policy rules'},
              ${'Allow Stage 01 reconcile to replace stubs with system policy records'}
            )
          `;
        }
      }

      const presenceReady = REQUIRED_SECTIONS.every((key) => present.has(key));
      const nextStatus = presenceReady ? 'READY' : 'INVALID';
      const stubCount = [...policyOnly].filter((key) => present.has(key)).length;

      const handoffPassed = presenceReady ? 1 : 0;
      await tx.$executeRaw`
        INSERT INTO strategy_validation_results(
          run_id, rule_code, rule_version, severity, passed, blocking, section_key, explanation, recommendation
        ) VALUES (
          CONVERT(uniqueidentifier, ${runId}),
          ${'HANDOFF_CONTENT_INTELLIGENCE'},
          1,
          ${presenceReady ? (stubCount > 0 ? 'WARNING' : 'INFO') : 'CRITICAL'},
          ${handoffPassed},
          ${presenceReady ? 0 : 1},
          ${null},
          ${
            presenceReady
              ? stubCount > 0
                ? `Mandatory sections present; ${stubCount} section(s) still on baseline stubs`
                : 'All Stage 01 mandatory sections have ACTIVE records; package eligible for Content Intelligence handoff'
              : 'Handoff blocked until every mandatory section has at least one ACTIVE record'
          },
          ${
            presenceReady
              ? stubCount > 0
                ? 'Activate is allowed; continue reconcile to replace remaining stubs'
                : 'Proceed to activate when package status is READY'
              : 'Resolve failed mandatory checks first'
          }
        )
      `;

      await tx.$executeRaw`
        UPDATE strategy_validation_runs
        SET status = 'COMPLETED',
            completed_at = sysutcdatetime(),
            summary_json = ${JSON.stringify({
              presenceReady,
              stubOnlySections: [...policyOnly],
              stubCount,
              sectionCount: REQUIRED_SECTIONS.length,
            })}
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

  async reconcileGeographies(versionId?: string) {
    await this.repo.ensureDraft();
    const overview = await this.repo.overview();
    const targetVersionId = versionId ?? overview.versionId;
    if (!targetVersionId) throw new Error('No strategy version available');
    if (!isMutableStrategyStatus(overview.status) && !versionId) {
      throw new Error('Activated strategy history is immutable');
    }

    const existing = await this.repo.list(targetVersionId, 'geographies');
    for (const record of existing) {
      const key = String(record.configuration?.systemKey ?? '');
      if (key === 'policy.geographies' && record.id) {
        await this.repo.update(targetVersionId, 'geographies', record.id, {
          name: record.name,
          description: record.description ?? '',
          status: 'ARCHIVED',
          priority: record.priority,
          configuration: {
            ...record.configuration,
            archivedReason: 'Superseded by geography policy profiles',
          },
          effectiveFrom: record.effectiveFrom ?? null,
          effectiveTo: record.effectiveTo ?? null,
        });
      }
    }

    const live = (await this.repo.list(targetVersionId, 'geographies')).filter(
      (record) => record.status !== 'ARCHIVED',
    );
    const byKey = new Map(
      live
        .map((record) => [String(record.configuration?.systemKey ?? ''), record] as const)
        .filter(([key]) => Boolean(key)),
    );

    let created = 0;
    let updated = 0;
    for (const policy of GEOGRAPHIES_POLICY) {
      const systemKey = String(policy.configuration.systemKey);
      const prior = byKey.get(systemKey);
      if (prior?.id) {
        await this.repo.update(targetVersionId, 'geographies', prior.id, {
          ...policy,
          id: prior.id,
        });
        updated += 1;
      } else {
        const record = await this.repo.create(targetVersionId, 'geographies', policy);
        if (record.id) byKey.set(systemKey, record);
        created += 1;
      }
    }

    await prisma.$executeRaw`
      INSERT INTO strategy_audit_events(version_id, action, actor_type, new_value, reason)
      VALUES (
        CONVERT(uniqueidentifier, ${targetVersionId}),
        ${'GEOGRAPHIES_POLICY_RECONCILED'},
        ${'SYSTEM'},
        ${JSON.stringify({ created, updated, policyCount: GEOGRAPHIES_POLICY.length })},
        ${'Country & regional profiles reconciled from system policy; no census metrics fabricated'}
      )
    `;

    return { created, updated, total: GEOGRAPHIES_POLICY.length };
  }

  async reconcileAudiences(versionId?: string) {
    await this.repo.ensureDraft();
    const overview = await this.repo.overview();
    const targetVersionId = versionId ?? overview.versionId;
    if (!targetVersionId) throw new Error('No strategy version available');
    if (!isMutableStrategyStatus(overview.status) && !versionId) {
      throw new Error('Activated strategy history is immutable');
    }

    const existing = await this.repo.list(targetVersionId, 'audiences');
    for (const record of existing) {
      const key = String(record.configuration?.systemKey ?? '');
      if (key === 'policy.audiences' && record.id) {
        await this.repo.update(targetVersionId, 'audiences', record.id, {
          name: record.name,
          description: record.description ?? '',
          status: 'ARCHIVED',
          priority: record.priority,
          configuration: {
            ...record.configuration,
            archivedReason: 'Superseded by audience policy personas',
          },
          effectiveFrom: record.effectiveFrom ?? null,
          effectiveTo: record.effectiveTo ?? null,
        });
      }
    }

    const live = (await this.repo.list(targetVersionId, 'audiences')).filter(
      (record) => record.status !== 'ARCHIVED',
    );
    const byKey = new Map(
      live
        .map((record) => [String(record.configuration?.systemKey ?? ''), record] as const)
        .filter(([key]) => Boolean(key)),
    );

    let created = 0;
    let updated = 0;
    for (const policy of AUDIENCES_POLICY) {
      const systemKey = String(policy.configuration.systemKey);
      const prior = byKey.get(systemKey);
      if (prior?.id) {
        await this.repo.update(targetVersionId, 'audiences', prior.id, {
          ...policy,
          id: prior.id,
        });
        updated += 1;
      } else {
        const record = await this.repo.create(targetVersionId, 'audiences', policy);
        if (record.id) byKey.set(systemKey, record);
        created += 1;
      }
    }

    await prisma.$executeRaw`
      INSERT INTO strategy_audit_events(version_id, action, actor_type, new_value, reason)
      VALUES (
        CONVERT(uniqueidentifier, ${targetVersionId}),
        ${'AUDIENCES_POLICY_RECONCILED'},
        ${'SYSTEM'},
        ${JSON.stringify({ created, updated, policyCount: AUDIENCES_POLICY.length })},
        ${'Audience personas reconciled from system policy; no engagement metrics fabricated'}
      )
    `;

    return { created, updated, total: AUDIENCES_POLICY.length };
  }

  async reconcileEditorial(versionId?: string) {
    await this.repo.ensureDraft();
    const overview = await this.repo.overview();
    const targetVersionId = versionId ?? overview.versionId;
    if (!targetVersionId) throw new Error('No strategy version available');
    if (!isMutableStrategyStatus(overview.status) && !versionId) {
      throw new Error('Activated strategy history is immutable');
    }

    const existing = await this.repo.list(targetVersionId, 'editorial-policy');
    for (const record of existing) {
      const key = String(record.configuration?.systemKey ?? '');
      if (key === 'policy.editorial-policy' && record.id) {
        await this.repo.update(targetVersionId, 'editorial-policy', record.id, {
          name: record.name,
          description: record.description ?? '',
          status: 'ARCHIVED',
          priority: record.priority,
          configuration: {
            ...record.configuration,
            archivedReason: 'Superseded by editorial charter chapters',
          },
          effectiveFrom: record.effectiveFrom ?? null,
          effectiveTo: record.effectiveTo ?? null,
        });
      }
    }

    const live = (await this.repo.list(targetVersionId, 'editorial-policy')).filter(
      (record) => record.status !== 'ARCHIVED',
    );
    const byKey = new Map(
      live
        .map((record) => [String(record.configuration?.systemKey ?? ''), record] as const)
        .filter(([key]) => Boolean(key)),
    );

    let created = 0;
    let updated = 0;
    for (const policy of EDITORIAL_POLICY) {
      const systemKey = String(policy.configuration.systemKey);
      const prior = byKey.get(systemKey);
      if (prior?.id) {
        await this.repo.update(targetVersionId, 'editorial-policy', prior.id, {
          ...policy,
          id: prior.id,
        });
        updated += 1;
      } else {
        const record = await this.repo.create(targetVersionId, 'editorial-policy', policy);
        if (record.id) byKey.set(systemKey, record);
        created += 1;
      }
    }

    await prisma.$executeRaw`
      INSERT INTO strategy_audit_events(version_id, action, actor_type, new_value, reason)
      VALUES (
        CONVERT(uniqueidentifier, ${targetVersionId}),
        ${'EDITORIAL_POLICY_RECONCILED'},
        ${'SYSTEM'},
        ${JSON.stringify({ created, updated, policyCount: EDITORIAL_POLICY.length })},
        ${'Editorial & brand charter reconciled from system policy; no compliance scores fabricated'}
      )
    `;

    return { created, updated, total: EDITORIAL_POLICY.length };
  }

  async reconcileFormats(versionId?: string) {
    await this.repo.ensureDraft();
    const overview = await this.repo.overview();
    const targetVersionId = versionId ?? overview.versionId;
    if (!targetVersionId) throw new Error('No strategy version available');
    if (!isMutableStrategyStatus(overview.status) && !versionId) {
      throw new Error('Activated strategy history is immutable');
    }

    const existing = await this.repo.list(targetVersionId, 'formats');
    for (const record of existing) {
      const key = String(record.configuration?.systemKey ?? '');
      if (key === 'policy.formats' && record.id) {
        await this.repo.update(targetVersionId, 'formats', record.id, {
          name: record.name,
          description: record.description ?? '',
          status: 'ARCHIVED',
          priority: record.priority,
          configuration: {
            ...record.configuration,
            archivedReason: 'Superseded by content format production briefs',
          },
          effectiveFrom: record.effectiveFrom ?? null,
          effectiveTo: record.effectiveTo ?? null,
        });
      }
    }

    const live = (await this.repo.list(targetVersionId, 'formats')).filter(
      (record) => record.status !== 'ARCHIVED',
    );
    const byKey = new Map(
      live
        .map((record) => [String(record.configuration?.systemKey ?? ''), record] as const)
        .filter(([key]) => Boolean(key)),
    );

    let created = 0;
    let updated = 0;
    for (const policy of FORMATS_POLICY) {
      const systemKey = String(policy.configuration.systemKey);
      const prior = byKey.get(systemKey);
      if (prior?.id) {
        await this.repo.update(targetVersionId, 'formats', prior.id, {
          ...policy,
          id: prior.id,
        });
        updated += 1;
      } else {
        const record = await this.repo.create(targetVersionId, 'formats', policy);
        if (record.id) byKey.set(systemKey, record);
        created += 1;
      }
    }

    await prisma.$executeRaw`
      INSERT INTO strategy_audit_events(version_id, action, actor_type, new_value, reason)
      VALUES (
        CONVERT(uniqueidentifier, ${targetVersionId}),
        ${'FORMATS_POLICY_RECONCILED'},
        ${'SYSTEM'},
        ${JSON.stringify({ created, updated, policyCount: FORMATS_POLICY.length })},
        ${'Content format production briefs reconciled from system policy; no utilisation metrics fabricated'}
      )
    `;

    return { created, updated, total: FORMATS_POLICY.length };
  }

  async reconcileChannels(versionId?: string) {
    await this.repo.ensureDraft();
    const overview = await this.repo.overview();
    const targetVersionId = versionId ?? overview.versionId;
    if (!targetVersionId) throw new Error('No strategy version available');
    if (!isMutableStrategyStatus(overview.status) && !versionId) {
      throw new Error('Activated strategy history is immutable');
    }

    const existing = await this.repo.list(targetVersionId, 'channels');
    for (const record of existing) {
      const key = String(record.configuration?.systemKey ?? '');
      if (key === 'policy.channels' && record.id) {
        await this.repo.update(targetVersionId, 'channels', record.id, {
          name: record.name,
          description: record.description ?? '',
          status: 'ARCHIVED',
          priority: record.priority,
          configuration: {
            ...record.configuration,
            archivedReason: 'Superseded by channel enablement profiles',
          },
          effectiveFrom: record.effectiveFrom ?? null,
          effectiveTo: record.effectiveTo ?? null,
        });
      }
    }

    const live = (await this.repo.list(targetVersionId, 'channels')).filter(
      (record) => record.status !== 'ARCHIVED',
    );
    const byKey = new Map(
      live
        .map((record) => [String(record.configuration?.systemKey ?? ''), record] as const)
        .filter(([key]) => Boolean(key)),
    );

    let created = 0;
    let updated = 0;
    for (const policy of CHANNELS_POLICY) {
      const systemKey = String(policy.configuration.systemKey);
      const prior = byKey.get(systemKey);
      if (prior?.id) {
        await this.repo.update(targetVersionId, 'channels', prior.id, {
          ...policy,
          id: prior.id,
        });
        updated += 1;
      } else {
        const record = await this.repo.create(targetVersionId, 'channels', policy);
        if (record.id) byKey.set(systemKey, record);
        created += 1;
      }
    }

    await prisma.$executeRaw`
      INSERT INTO strategy_audit_events(version_id, action, actor_type, new_value, reason)
      VALUES (
        CONVERT(uniqueidentifier, ${targetVersionId}),
        ${'CHANNELS_POLICY_RECONCILED'},
        ${'SYSTEM'},
        ${JSON.stringify({ created, updated, policyCount: CHANNELS_POLICY.length })},
        ${'Channel enablement profiles reconciled; strategic enablement separated from provider availability; no reach metrics fabricated'}
      )
    `;

    return { created, updated, total: CHANNELS_POLICY.length };
  }

  async reconcileLocalisation(versionId?: string) {
    await this.repo.ensureDraft();
    const overview = await this.repo.overview();
    const targetVersionId = versionId ?? overview.versionId;
    if (!targetVersionId) throw new Error('No strategy version available');
    if (!isMutableStrategyStatus(overview.status) && !versionId) {
      throw new Error('Activated strategy history is immutable');
    }

    const existing = await this.repo.list(targetVersionId, 'localisation');
    for (const record of existing) {
      const key = String(record.configuration?.systemKey ?? '');
      if (key === 'policy.localisation' && record.id) {
        await this.repo.update(targetVersionId, 'localisation', record.id, {
          name: record.name,
          description: record.description ?? '',
          status: 'ARCHIVED',
          priority: record.priority,
          configuration: {
            ...record.configuration,
            archivedReason: 'Superseded by language & localisation kits',
          },
          effectiveFrom: record.effectiveFrom ?? null,
          effectiveTo: record.effectiveTo ?? null,
        });
      }
    }

    const live = (await this.repo.list(targetVersionId, 'localisation')).filter(
      (record) => record.status !== 'ARCHIVED',
    );
    const byKey = new Map(
      live
        .map((record) => [String(record.configuration?.systemKey ?? ''), record] as const)
        .filter(([key]) => Boolean(key)),
    );

    let created = 0;
    let updated = 0;
    for (const policy of LOCALISATION_POLICY) {
      const systemKey = String(policy.configuration.systemKey);
      const prior = byKey.get(systemKey);
      if (prior?.id) {
        await this.repo.update(targetVersionId, 'localisation', prior.id, {
          ...policy,
          id: prior.id,
        });
        updated += 1;
      } else {
        const record = await this.repo.create(targetVersionId, 'localisation', policy);
        if (record.id) byKey.set(systemKey, record);
        created += 1;
      }
    }

    await prisma.$executeRaw`
      INSERT INTO strategy_audit_events(version_id, action, actor_type, new_value, reason)
      VALUES (
        CONVERT(uniqueidentifier, ${targetVersionId}),
        ${'LOCALISATION_POLICY_RECONCILED'},
        ${'SYSTEM'},
        ${JSON.stringify({ created, updated, policyCount: LOCALISATION_POLICY.length })},
        ${'Language & localisation kits reconciled; cultural adaptation beyond literal translation; no fluency scores fabricated'}
      )
    `;

    return { created, updated, total: LOCALISATION_POLICY.length };
  }

  async reconcileSourcePolicy(versionId?: string) {
    await this.repo.ensureDraft();
    const overview = await this.repo.overview();
    const targetVersionId = versionId ?? overview.versionId;
    if (!targetVersionId) throw new Error('No strategy version available');
    if (!isMutableStrategyStatus(overview.status) && !versionId) {
      throw new Error('Activated strategy history is immutable');
    }

    const existing = await this.repo.list(targetVersionId, 'source-policy');
    for (const record of existing) {
      const key = String(record.configuration?.systemKey ?? '');
      if (key === 'policy.source-policy' && record.id) {
        await this.repo.update(targetVersionId, 'source-policy', record.id, {
          name: record.name,
          description: record.description ?? '',
          status: 'ARCHIVED',
          priority: record.priority,
          configuration: {
            ...record.configuration,
            archivedReason: 'Superseded by evidence & source policy classes',
          },
          effectiveFrom: record.effectiveFrom ?? null,
          effectiveTo: record.effectiveTo ?? null,
        });
      }
    }

    const live = (await this.repo.list(targetVersionId, 'source-policy')).filter(
      (record) => record.status !== 'ARCHIVED',
    );
    const byKey = new Map(
      live
        .map((record) => [String(record.configuration?.systemKey ?? ''), record] as const)
        .filter(([key]) => Boolean(key)),
    );

    let created = 0;
    let updated = 0;
    for (const policy of SOURCE_POLICY) {
      const systemKey = String(policy.configuration.systemKey);
      const prior = byKey.get(systemKey);
      if (prior?.id) {
        await this.repo.update(targetVersionId, 'source-policy', prior.id, {
          ...policy,
          id: prior.id,
        });
        updated += 1;
      } else {
        const record = await this.repo.create(targetVersionId, 'source-policy', policy);
        if (record.id) byKey.set(systemKey, record);
        created += 1;
      }
    }

    await prisma.$executeRaw`
      INSERT INTO strategy_audit_events(version_id, action, actor_type, new_value, reason)
      VALUES (
        CONVERT(uniqueidentifier, ${targetVersionId}),
        ${'SOURCE_POLICY_RECONCILED'},
        ${'SYSTEM'},
        ${JSON.stringify({ created, updated, policyCount: SOURCE_POLICY.length })},
        ${'Evidence & source policy classes reconciled; authority gates only; no fabricated authority scores'}
      )
    `;

    return { created, updated, total: SOURCE_POLICY.length };
  }

  async reconcileRiskPolicy(versionId?: string) {
    await this.repo.ensureDraft();
    const overview = await this.repo.overview();
    const targetVersionId = versionId ?? overview.versionId;
    if (!targetVersionId) throw new Error('No strategy version available');
    if (!isMutableStrategyStatus(overview.status) && !versionId) {
      throw new Error('Activated strategy history is immutable');
    }

    const existing = await this.repo.list(targetVersionId, 'risk-policy');
    for (const record of existing) {
      const key = String(record.configuration?.systemKey ?? '');
      if (key === 'policy.risk-policy' && record.id) {
        await this.repo.update(targetVersionId, 'risk-policy', record.id, {
          name: record.name,
          description: record.description ?? '',
          status: 'ARCHIVED',
          priority: record.priority,
          configuration: {
            ...record.configuration,
            archivedReason: 'Superseded by risk & sensitivity policy rules',
          },
          effectiveFrom: record.effectiveFrom ?? null,
          effectiveTo: record.effectiveTo ?? null,
        });
      }
    }

    const live = (await this.repo.list(targetVersionId, 'risk-policy')).filter(
      (record) => record.status !== 'ARCHIVED',
    );
    const byKey = new Map(
      live
        .map((record) => [String(record.configuration?.systemKey ?? ''), record] as const)
        .filter(([key]) => Boolean(key)),
    );

    let created = 0;
    let updated = 0;
    for (const policy of RISK_POLICY) {
      const systemKey = String(policy.configuration.systemKey);
      const prior = byKey.get(systemKey);
      if (prior?.id) {
        await this.repo.update(targetVersionId, 'risk-policy', prior.id, {
          ...policy,
          id: prior.id,
        });
        updated += 1;
      } else {
        const record = await this.repo.create(targetVersionId, 'risk-policy', policy);
        if (record.id) byKey.set(systemKey, record);
        created += 1;
      }
    }

    await prisma.$executeRaw`
      INSERT INTO strategy_audit_events(version_id, action, actor_type, new_value, reason)
      VALUES (
        CONVERT(uniqueidentifier, ${targetVersionId}),
        ${'RISK_POLICY_RECONCILED'},
        ${'SYSTEM'},
        ${JSON.stringify({ created, updated, policyCount: RISK_POLICY.length })},
        ${'Risk & sensitivity policies reconciled; severity labels only; no fabricated probability scores'}
      )
    `;

    return { created, updated, total: RISK_POLICY.length };
  }

  async reconcileSelectionThresholds(versionId?: string) {
    await this.repo.ensureDraft();
    const overview = await this.repo.overview();
    const targetVersionId = versionId ?? overview.versionId;
    if (!targetVersionId) throw new Error('No strategy version available');
    if (!isMutableStrategyStatus(overview.status) && !versionId) {
      throw new Error('Activated strategy history is immutable');
    }

    const existing = await this.repo.list(targetVersionId, 'selection-thresholds');
    for (const record of existing) {
      const key = String(record.configuration?.systemKey ?? '');
      if (key === 'policy.selection-thresholds' && record.id) {
        await this.repo.update(targetVersionId, 'selection-thresholds', record.id, {
          name: record.name,
          description: record.description ?? '',
          status: 'ARCHIVED',
          priority: record.priority,
          configuration: {
            ...record.configuration,
            archivedReason: 'Superseded by autonomous selection threshold rules',
          },
          effectiveFrom: record.effectiveFrom ?? null,
          effectiveTo: record.effectiveTo ?? null,
        });
      }
    }

    const live = (await this.repo.list(targetVersionId, 'selection-thresholds')).filter(
      (record) => record.status !== 'ARCHIVED',
    );
    const byKey = new Map(
      live
        .map((record) => [String(record.configuration?.systemKey ?? ''), record] as const)
        .filter(([key]) => Boolean(key)),
    );

    let created = 0;
    let updated = 0;
    for (const policy of SELECTION_THRESHOLDS) {
      const systemKey = String(policy.configuration.systemKey);
      const prior = byKey.get(systemKey);
      if (prior?.id) {
        await this.repo.update(targetVersionId, 'selection-thresholds', prior.id, {
          ...policy,
          id: prior.id,
        });
        updated += 1;
      } else {
        const record = await this.repo.create(targetVersionId, 'selection-thresholds', policy);
        if (record.id) byKey.set(systemKey, record);
        created += 1;
      }
    }

    await prisma.$executeRaw`
      INSERT INTO strategy_audit_events(version_id, action, actor_type, new_value, reason)
      VALUES (
        CONVERT(uniqueidentifier, ${targetVersionId}),
        ${'SELECTION_THRESHOLDS_RECONCILED'},
        ${'SYSTEM'},
        ${JSON.stringify({ created, updated, policyCount: SELECTION_THRESHOLDS.length })},
        ${'Selection thresholds reconciled; decision gates only; no fabricated accuracy scores'}
      )
    `;

    return { created, updated, total: SELECTION_THRESHOLDS.length };
  }

  async reconcilePortfolio(versionId?: string) {
    await this.repo.ensureDraft();
    const overview = await this.repo.overview();
    const targetVersionId = versionId ?? overview.versionId;
    if (!targetVersionId) throw new Error('No strategy version available');
    if (!isMutableStrategyStatus(overview.status) && !versionId) {
      throw new Error('Activated strategy history is immutable');
    }

    const existing = await this.repo.list(targetVersionId, 'portfolio');
    for (const record of existing) {
      const key = String(record.configuration?.systemKey ?? '');
      if (key === 'policy.portfolio' && record.id) {
        await this.repo.update(targetVersionId, 'portfolio', record.id, {
          name: record.name,
          description: record.description ?? '',
          status: 'ARCHIVED',
          priority: record.priority,
          configuration: {
            ...record.configuration,
            archivedReason: 'Superseded by portfolio allocation rules',
          },
          effectiveFrom: record.effectiveFrom ?? null,
          effectiveTo: record.effectiveTo ?? null,
        });
      }
    }

    const live = (await this.repo.list(targetVersionId, 'portfolio')).filter(
      (record) => record.status !== 'ARCHIVED',
    );
    const byKey = new Map(
      live
        .map((record) => [String(record.configuration?.systemKey ?? ''), record] as const)
        .filter(([key]) => Boolean(key)),
    );

    let created = 0;
    let updated = 0;
    for (const policy of PORTFOLIO_POLICY) {
      const systemKey = String(policy.configuration.systemKey);
      const prior = byKey.get(systemKey);
      if (prior?.id) {
        await this.repo.update(targetVersionId, 'portfolio', prior.id, {
          ...policy,
          id: prior.id,
        });
        updated += 1;
      } else {
        const record = await this.repo.create(targetVersionId, 'portfolio', policy);
        if (record.id) byKey.set(systemKey, record);
        created += 1;
      }
    }

    await prisma.$executeRaw`
      INSERT INTO strategy_audit_events(version_id, action, actor_type, new_value, reason)
      VALUES (
        CONVERT(uniqueidentifier, ${targetVersionId}),
        ${'PORTFOLIO_RECONCILED'},
        ${'SYSTEM'},
        ${JSON.stringify({ created, updated, policyCount: PORTFOLIO_POLICY.length })},
        ${'Portfolio allocation rules reconciled; normative share bands only; utilization UNMEASURED'}
      )
    `;

    return { created, updated, total: PORTFOLIO_POLICY.length };
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
