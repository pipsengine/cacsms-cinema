import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import {
  REQUIRED_SECTIONS,
  isMutableStrategyStatus,
  type SectionKey,
  type StrategyAutonomyRun,
  type StrategyOverview,
  type StrategyRecord,
  type StrategyStatus,
} from './contracts';

type OverviewRow = {
  strategyId: string;
  versionId: string;
  name: string;
  versionNumber: number;
  status: string;
  effectiveDate: Date | null;
  lastValidatedAt: Date | null;
  checksum: string | null;
  handoffStatus: string | null;
};

type CountRow = { section_key: string; total: number | bigint };

function labelForSection(key: string) {
  return key.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function asSqlDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Bind nullable datetimes as nvarchar so MSSQL never sees typed NULL as int. */
function asDateParam(value: string | null | undefined): string {
  const date = asSqlDate(value);
  return date ? date.toISOString() : '';
}

export class StrategyRepository {
  async ensureAutonomyRunsTable(): Promise<void> {
    await prisma.$executeRaw`
      IF OBJECT_ID(N'[dbo].[strategy_autonomy_runs]', N'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[strategy_autonomy_runs] (
          [id] uniqueidentifier NOT NULL,
          [version_id] uniqueidentifier NOT NULL,
          [section_key] varchar(40) NOT NULL,
          [idempotency_key] varchar(100) NOT NULL,
          [status] varchar(30) NOT NULL,
          [cancel_requested] bit NOT NULL CONSTRAINT [strategy_autonomy_runs_cancel_df] DEFAULT 0,
          [summary_json] nvarchar(max) NULL,
          [failure_reason] nvarchar(2000) NULL,
          [started_at] datetime2 NULL,
          [completed_at] datetime2 NULL,
          [created_at] datetime2 NOT NULL CONSTRAINT [strategy_autonomy_runs_created_at_df] DEFAULT sysutcdatetime(),
          [updated_at] datetime2 NOT NULL CONSTRAINT [strategy_autonomy_runs_updated_at_df] DEFAULT sysutcdatetime(),
          CONSTRAINT [strategy_autonomy_runs_pkey] PRIMARY KEY CLUSTERED ([id]),
          CONSTRAINT [strategy_autonomy_runs_version_id_fkey]
            FOREIGN KEY ([version_id]) REFERENCES [dbo].[content_strategy_versions]([id]),
          CONSTRAINT [UQ_strategy_autonomy_idempotency] UNIQUE ([idempotency_key]),
          CONSTRAINT [CK_strategy_autonomy_runs_status] CHECK (
            [status] IN ('QUEUED','RUNNING','COMPLETED','PARTIAL','FAILED','CANCELLED')
          ),
          CONSTRAINT [CK_strategy_autonomy_runs_summary_json] CHECK (
            [summary_json] IS NULL OR ISJSON([summary_json]) = 1
          )
        );
        CREATE INDEX [IX_strategy_autonomy_runs_section]
          ON [dbo].[strategy_autonomy_runs]([version_id], [section_key], [created_at] DESC);
      END
    `;
  }

  async ensureDraft(): Promise<void> {
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT TOP 1 CONVERT(varchar(36), id) AS id
      FROM content_strategies
      WHERE archived_at IS NULL
    `;
    if (existing[0]) return;

    const strategyId = randomUUID();
    const versionId = randomUUID();

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO content_strategies(id, name, description)
        VALUES (CONVERT(uniqueidentifier, ${strategyId}), ${'CACSMS Content Strategy'}, ${'Initial development strategy'})
      `;
      await tx.$executeRaw`
        INSERT INTO content_strategy_versions(id, strategy_id, version_number, status)
        VALUES (
          CONVERT(uniqueidentifier, ${versionId}),
          CONVERT(uniqueidentifier, ${strategyId}),
          1,
          ${'DRAFT'}
        )
      `;
      await tx.$executeRaw`
        INSERT INTO strategy_audit_events(version_id, action, actor_type, reason)
        VALUES (
          CONVERT(uniqueidentifier, ${versionId}),
          ${'DRAFT_CREATED'},
          ${'DEVELOPMENT_USER'},
          ${'Initial draft; no production metrics or policy records were fabricated'}
        )
      `;
    });
  }

  async overview(): Promise<StrategyOverview> {
    try {
      await this.ensureDraft();
    } catch (error) {
      return {
        available: false,
        reason:
          error instanceof Error
            ? error.message.replace(/password|secret|token/gi, '[redacted]')
            : 'Strategy tables are unavailable. Run the strategy migration.',
      };
    }

    const rows = await prisma.$queryRaw<OverviewRow[]>`
      SELECT TOP 1
        CONVERT(varchar(36), s.id) AS strategyId,
        CONVERT(varchar(36), v.id) AS versionId,
        s.name AS name,
        v.version_number AS versionNumber,
        v.status AS status,
        v.effective_date AS effectiveDate,
        v.last_validated_at AS lastValidatedAt,
        p.checksum AS checksum,
        h.status AS handoffStatus
      FROM content_strategies s
      JOIN content_strategy_versions v ON v.strategy_id = s.id
      LEFT JOIN strategy_packages p ON p.version_id = v.id
      OUTER APPLY (
        SELECT TOP 1 status
        FROM strategy_handoffs
        WHERE package_id = p.id
        ORDER BY created_at DESC
      ) h
      WHERE s.archived_at IS NULL
      ORDER BY
        CASE v.status
          WHEN 'ACTIVE' THEN 0
          WHEN 'DRAFT' THEN 1
          WHEN 'READY' THEN 2
          ELSE 3
        END,
        v.version_number DESC
    `;

    const x = rows[0];
    if (!x) {
      return { available: true, status: 'DRAFT', readiness: 0, metrics: {} };
    }

    const counts = await prisma.$queryRaw<CountRow[]>`
      SELECT section_key, COUNT(*) AS total
      FROM strategy_records
      WHERE version_id = CONVERT(uniqueidentifier, ${x.versionId})
        AND archived_at IS NULL
      GROUP BY section_key
    `;

    const map = Object.fromEntries(
      counts.map((row) => [row.section_key, Number(row.total)]),
    );

    const sections = REQUIRED_SECTIONS.map((key) => ({
      key,
      label: labelForSection(key),
      status: (map[key] ? 'READY' : 'BLOCKED') as 'READY' | 'BLOCKED',
      progress: map[key] ? 100 : 0,
      blockers: map[key] ? 0 : 1,
      warnings: 0,
      missing: map[key] ? [] : ['At least one active record'],
      recordCount: map[key] ?? 0,
      lastValidatedAt: x.lastValidatedAt?.toISOString() ?? null,
    }));

    const readiness = Math.round(
      sections.reduce((sum, section) => sum + section.progress, 0) / sections.length,
    );

    const issues = sections
      .filter((section) => section.status === 'BLOCKED')
      .map((section) => ({
        id: section.key,
        severity: 'CRITICAL',
        section: section.key,
        message: `Missing required configuration for ${section.label}`,
        recommendation: 'Start autonomous configuration for this section (human start/stop only)',
      }));

    let autonomyRun: StrategyAutonomyRun | null = null;
    try {
      await this.ensureAutonomyRunsTable();
      autonomyRun = await this.latestAutonomyRun(x.versionId, 'objectives');
    } catch {
      autonomyRun = null;
    }

    return {
      available: true,
      strategyId: x.strategyId,
      versionId: x.versionId,
      name: x.name,
      versionNumber: Number(x.versionNumber),
      status: x.status as StrategyStatus,
      readiness,
      effectiveDate: x.effectiveDate?.toISOString() ?? null,
      lastValidatedAt: x.lastValidatedAt?.toISOString() ?? null,
      handoffStatus: x.handoffStatus ?? undefined,
      checksum: x.checksum,
      sections,
      issues,
      autonomyRun,
      metrics: {
        configuredSections: sections.filter((section) => section.progress === 100).length,
        configuredRecords: Object.values(map).reduce((sum, value) => sum + value, 0),
        failedMandatoryValidations: sections.filter((section) => section.status === 'BLOCKED').length,
        contentIntelligenceHandoff: x.handoffStatus === 'ACKNOWLEDGED' ? 1 : 0,
      },
    };
  }

  async list(versionId: string, section: SectionKey): Promise<StrategyRecord[]> {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        status: string;
        priority: number;
        configuration: string;
        effectiveFrom: Date | null;
        effectiveTo: Date | null;
        rowVersion: string | null;
      }>
    >`
      SELECT
        CONVERT(varchar(36), id) AS id,
        record_name AS name,
        status,
        priority,
        configuration_json AS configuration,
        effective_from AS effectiveFrom,
        effective_to AS effectiveTo,
        CONVERT(varchar(50), row_version, 1) AS rowVersion
      FROM strategy_records
      WHERE version_id = CONVERT(uniqueidentifier, ${versionId})
        AND section_key = ${section}
        AND archived_at IS NULL
      ORDER BY priority DESC, record_name
    `;

    return rows.map((row) => {
      const configuration = JSON.parse(row.configuration || '{}') as Record<string, unknown>;
      return {
        id: row.id,
        name: row.name,
        description: String(configuration.description ?? ''),
        status: row.status,
        priority: Number(row.priority),
        configuration,
        effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
        effectiveTo: row.effectiveTo?.toISOString() ?? null,
        rowVersion: row.rowVersion ?? undefined,
      };
    });
  }

  async create(versionId: string, section: SectionKey, data: StrategyRecord): Promise<StrategyRecord> {
    const id = randomUUID();
    const configJson = JSON.stringify({
      ...(data.configuration ?? {}),
      description: data.description ?? '',
    });
    const effectiveFrom = asDateParam(data.effectiveFrom);
    const effectiveTo = asDateParam(data.effectiveTo);

    await prisma.$transaction(async (tx) => {
      const state = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status
        FROM content_strategy_versions WITH (UPDLOCK, HOLDLOCK)
        WHERE id = CONVERT(uniqueidentifier, ${versionId})
      `;
      if (!isMutableStrategyStatus(state[0]?.status)) {
        throw new Error('Only draft, invalid, or ready versions can be edited');
      }

      await tx.$executeRaw`
        INSERT INTO strategy_records(
          id, version_id, section_key, record_name, status, priority, configuration_json,
          effective_from, effective_to
        )
        VALUES (
          CONVERT(uniqueidentifier, ${id}),
          CONVERT(uniqueidentifier, ${versionId}),
          ${section},
          ${data.name},
          ${data.status},
          ${data.priority},
          ${configJson},
          TRY_CONVERT(datetime2, NULLIF(${effectiveFrom}, '')),
          TRY_CONVERT(datetime2, NULLIF(${effectiveTo}, ''))
        )
      `;
      await tx.$executeRaw`
        UPDATE content_strategy_versions
        SET last_validated_at = NULL, updated_at = sysutcdatetime(), status = 'DRAFT'
        WHERE id = CONVERT(uniqueidentifier, ${versionId})
      `;
      await tx.$executeRaw`
        INSERT INTO strategy_audit_events(version_id, action, actor_type, new_value)
        VALUES (
          CONVERT(uniqueidentifier, ${versionId}),
          ${'RECORD_CREATED'},
          ${'DEVELOPMENT_USER'},
          ${configJson}
        )
      `;
    });

    return { id, ...data, configuration: JSON.parse(configJson) as Record<string, unknown> };
  }

  async update(
    versionId: string,
    section: SectionKey,
    recordId: string,
    data: StrategyRecord,
  ): Promise<StrategyRecord> {
    const configJson = JSON.stringify({
      ...(data.configuration ?? {}),
      description: data.description ?? '',
    });
    const effectiveFrom = asDateParam(data.effectiveFrom);
    const effectiveTo = asDateParam(data.effectiveTo);

    await prisma.$transaction(async (tx) => {
      const state = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status
        FROM content_strategy_versions WITH (UPDLOCK, HOLDLOCK)
        WHERE id = CONVERT(uniqueidentifier, ${versionId})
      `;
      if (!isMutableStrategyStatus(state[0]?.status)) {
        throw new Error('Only draft, invalid, or ready versions can be edited');
      }

      const existing = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT CONVERT(varchar(36), id) AS id
        FROM strategy_records WITH (UPDLOCK, HOLDLOCK)
        WHERE id = CONVERT(uniqueidentifier, ${recordId})
          AND version_id = CONVERT(uniqueidentifier, ${versionId})
          AND section_key = ${section}
          AND archived_at IS NULL
      `;
      if (!existing[0]) {
        throw new Error('Strategy record not found');
      }

      await tx.$executeRaw`
        UPDATE strategy_records
        SET
          record_name = ${data.name},
          status = ${data.status},
          priority = ${data.priority},
          configuration_json = ${configJson},
          effective_from = TRY_CONVERT(datetime2, NULLIF(${effectiveFrom}, '')),
          effective_to = TRY_CONVERT(datetime2, NULLIF(${effectiveTo}, '')),
          updated_at = sysutcdatetime()
        WHERE id = CONVERT(uniqueidentifier, ${recordId})
      `;
      await tx.$executeRaw`
        UPDATE content_strategy_versions
        SET last_validated_at = NULL, updated_at = sysutcdatetime(), status = 'DRAFT'
        WHERE id = CONVERT(uniqueidentifier, ${versionId})
      `;
      await tx.$executeRaw`
        INSERT INTO strategy_audit_events(version_id, action, actor_type, new_value)
        VALUES (
          CONVERT(uniqueidentifier, ${versionId}),
          ${'RECORD_UPDATED'},
          ${'DEVELOPMENT_USER'},
          ${configJson}
        )
      `;
    });

    return {
      id: recordId,
      ...data,
      configuration: JSON.parse(configJson) as Record<string, unknown>,
    };
  }

  async latestAutonomyRun(
    versionId: string,
    section: SectionKey,
  ): Promise<StrategyAutonomyRun | null> {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        sectionKey: string;
        status: string;
        cancelRequested: boolean | number;
        summaryJson: string | null;
        failureReason: string | null;
        startedAt: Date | null;
        completedAt: Date | null;
        createdAt: Date;
      }>
    >`
      SELECT TOP 1
        CONVERT(varchar(36), id) AS id,
        section_key AS sectionKey,
        status,
        cancel_requested AS cancelRequested,
        summary_json AS summaryJson,
        failure_reason AS failureReason,
        started_at AS startedAt,
        completed_at AS completedAt,
        created_at AS createdAt
      FROM strategy_autonomy_runs
      WHERE version_id = CONVERT(uniqueidentifier, ${versionId})
        AND section_key = ${section}
      ORDER BY created_at DESC
    `;

    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      sectionKey: row.sectionKey as SectionKey,
      status: row.status as StrategyAutonomyRun['status'],
      cancelRequested: Boolean(row.cancelRequested),
      summary: row.summaryJson ? (JSON.parse(row.summaryJson) as Record<string, unknown>) : null,
      failureReason: row.failureReason,
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async listAudit(versionId: string) {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        versionId: string | null;
        action: string;
        actorType: string;
        actorReference: string | null;
        requestId: string | null;
        correlationId: string | null;
        previousValue: string | null;
        newValue: string | null;
        reason: string | null;
        createdAt: Date;
      }>
    >`
      SELECT TOP 500
        CONVERT(varchar(36), id) AS id,
        CONVERT(varchar(36), version_id) AS versionId,
        action,
        actor_type AS actorType,
        actor_reference AS actorReference,
        request_id AS requestId,
        correlation_id AS correlationId,
        previous_value AS previousValue,
        new_value AS newValue,
        reason,
        created_at AS createdAt
      FROM strategy_audit_events
      WHERE version_id = CONVERT(uniqueidentifier, ${versionId})
      ORDER BY created_at DESC
    `;

    return rows.map((row) => ({
      id: row.id,
      versionId: row.versionId,
      action: row.action,
      actorType: row.actorType,
      actorReference: row.actorReference,
      requestId: row.requestId,
      correlationId: row.correlationId,
      previousValue: row.previousValue,
      newValue: row.newValue,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async listStrategyAudit(strategyId?: string) {
    await this.ensureDraft();
    let targetStrategyId = strategyId ?? null;
    if (!targetStrategyId) {
      const current = await prisma.$queryRaw<Array<{ strategyId: string }>>`
        SELECT TOP 1 CONVERT(varchar(36), id) AS strategyId
        FROM content_strategies
        WHERE archived_at IS NULL
      `;
      targetStrategyId = current[0]?.strategyId ?? null;
    }
    if (!targetStrategyId) return [] as StrategyAuditEvent[];

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        versionId: string | null;
        versionNumber: number | null;
        versionStatus: string | null;
        action: string;
        actorType: string;
        actorReference: string | null;
        requestId: string | null;
        correlationId: string | null;
        previousValue: string | null;
        newValue: string | null;
        reason: string | null;
        createdAt: Date;
      }>
    >`
      SELECT TOP 500
        CONVERT(varchar(36), e.id) AS id,
        CONVERT(varchar(36), e.version_id) AS versionId,
        v.version_number AS versionNumber,
        v.status AS versionStatus,
        e.action,
        e.actor_type AS actorType,
        e.actor_reference AS actorReference,
        e.request_id AS requestId,
        e.correlation_id AS correlationId,
        e.previous_value AS previousValue,
        e.new_value AS newValue,
        e.reason,
        e.created_at AS createdAt
      FROM strategy_audit_events e
      INNER JOIN content_strategy_versions v ON v.id = e.version_id
      WHERE v.strategy_id = CONVERT(uniqueidentifier, ${targetStrategyId})
      ORDER BY e.created_at DESC
    `;

    return rows.map((row) => ({
      id: row.id,
      versionId: row.versionId,
      versionNumber: row.versionNumber != null ? Number(row.versionNumber) : null,
      versionStatus: row.versionStatus,
      action: row.action,
      actorType: row.actorType,
      actorReference: row.actorReference,
      requestId: row.requestId,
      correlationId: row.correlationId,
      previousValue: row.previousValue,
      newValue: row.newValue,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async latestValidation(versionId: string) {
    const runs = await prisma.$queryRaw<
      Array<{
        id: string;
        status: string;
        startedAt: Date;
        completedAt: Date | null;
        summaryJson: string | null;
      }>
    >`
      SELECT TOP 1
        CONVERT(varchar(36), id) AS id,
        status,
        started_at AS startedAt,
        completed_at AS completedAt,
        summary_json AS summaryJson
      FROM strategy_validation_runs
      WHERE version_id = CONVERT(uniqueidentifier, ${versionId})
      ORDER BY started_at DESC
    `;

    const run = runs[0];
    if (!run) {
      return { run: null, results: [] };
    }

    const results = await prisma.$queryRaw<
      Array<{
        id: string;
        ruleCode: string;
        ruleVersion: number;
        severity: string;
        passed: boolean | number;
        blocking: boolean | number;
        sectionKey: string | null;
        explanation: string;
        recommendation: string | null;
        checkedAt: Date;
      }>
    >`
      SELECT
        CONVERT(varchar(36), id) AS id,
        rule_code AS ruleCode,
        rule_version AS ruleVersion,
        severity,
        passed,
        blocking,
        section_key AS sectionKey,
        explanation,
        recommendation,
        checked_at AS checkedAt
      FROM strategy_validation_results
      WHERE run_id = CONVERT(uniqueidentifier, ${run.id})
      ORDER BY
        CASE WHEN passed = 0 THEN 0 ELSE 1 END,
        CASE severity
          WHEN 'CRITICAL' THEN 0
          WHEN 'WARNING' THEN 1
          WHEN 'INFO' THEN 2
          ELSE 3
        END,
        rule_code
    `;

    let summary: Record<string, unknown> | null = null;
    if (run.summaryJson) {
      try {
        summary = JSON.parse(run.summaryJson) as Record<string, unknown>;
      } catch {
        summary = null;
      }
    }

    return {
      run: {
        id: run.id,
        status: run.status,
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString() ?? null,
        summary,
      },
      results: results.map((row) => ({
        id: row.id,
        ruleCode: row.ruleCode,
        ruleVersion: Number(row.ruleVersion),
        severity: row.severity,
        passed: Boolean(row.passed),
        blocking: Boolean(row.blocking),
        sectionKey: row.sectionKey,
        explanation: row.explanation,
        recommendation: row.recommendation,
        checkedAt: row.checkedAt.toISOString(),
      })),
    };
  }

  async listVersions(strategyId?: string) {
    await this.ensureDraft();

    let targetStrategyId = strategyId ?? null;
    let currentVersionId: string | null = null;
    if (!targetStrategyId) {
      const current = await prisma.$queryRaw<
        Array<{ strategyId: string; versionId: string; status: string }>
      >`
        SELECT TOP 1
          CONVERT(varchar(36), s.id) AS strategyId,
          CONVERT(varchar(36), v.id) AS versionId,
          v.status AS status
        FROM content_strategies s
        JOIN content_strategy_versions v ON v.strategy_id = s.id
        WHERE s.archived_at IS NULL
        ORDER BY
          CASE v.status
            WHEN 'ACTIVE' THEN 0
            WHEN 'DRAFT' THEN 1
            WHEN 'READY' THEN 2
            ELSE 3
          END,
          v.version_number DESC
      `;
      targetStrategyId = current[0]?.strategyId ?? null;
      currentVersionId = current[0]?.versionId ?? null;
    }
    if (!targetStrategyId) {
      return { strategyId: null as string | null, currentVersionId: null, versions: [] as StrategyVersionSummary[] };
    }

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        versionNumber: number;
        status: string;
        effectiveDate: Date | null;
        lastValidatedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        checksum: string | null;
        recordCount: number | bigint;
        sectionCount: number | bigint;
      }>
    >`
      SELECT
        CONVERT(varchar(36), v.id) AS id,
        v.version_number AS versionNumber,
        v.status AS status,
        v.effective_date AS effectiveDate,
        v.last_validated_at AS lastValidatedAt,
        v.created_at AS createdAt,
        v.updated_at AS updatedAt,
        p.checksum AS checksum,
        (
          SELECT COUNT(*)
          FROM strategy_records r
          WHERE r.version_id = v.id AND r.archived_at IS NULL
        ) AS recordCount,
        (
          SELECT COUNT(DISTINCT r2.section_key)
          FROM strategy_records r2
          WHERE r2.version_id = v.id AND r2.archived_at IS NULL
        ) AS sectionCount
      FROM content_strategy_versions v
      LEFT JOIN strategy_packages p ON p.version_id = v.id
      WHERE v.strategy_id = CONVERT(uniqueidentifier, ${targetStrategyId})
      ORDER BY v.version_number DESC
    `;

    const versions: StrategyVersionSummary[] = [];
    for (const row of rows) {
      const sections = await prisma.$queryRaw<
        Array<{ section_key: string; total: number | bigint }>
      >`
        SELECT section_key, COUNT(*) AS total
        FROM strategy_records
        WHERE version_id = CONVERT(uniqueidentifier, ${row.id})
          AND archived_at IS NULL
        GROUP BY section_key
      `;
      const audit = await prisma.$queryRaw<
        Array<{ action: string; actorType: string; createdAt: Date; reason: string | null }>
      >`
        SELECT TOP 1
          action,
          actor_type AS actorType,
          created_at AS createdAt,
          reason
        FROM strategy_audit_events
        WHERE version_id = CONVERT(uniqueidentifier, ${row.id})
        ORDER BY created_at ASC
      `;
      versions.push({
        id: row.id,
        versionNumber: Number(row.versionNumber),
        status: row.status as StrategyStatus,
        effectiveDate: row.effectiveDate?.toISOString() ?? null,
        lastValidatedAt: row.lastValidatedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        checksum: row.checksum,
        recordCount: Number(row.recordCount),
        sectionCount: Number(row.sectionCount),
        sectionCounts: Object.fromEntries(
          sections.map((item) => [item.section_key, Number(item.total)]),
        ),
        createdBy: audit[0]?.actorType ?? 'SYSTEM',
        createAction: audit[0]?.action ?? null,
        createReason: audit[0]?.reason ?? null,
      });
    }

    return { strategyId: targetStrategyId, currentVersionId, versions };
  }

  async compareVersions(leftId: string, rightId: string) {
    const [leftSections, rightSections] = await Promise.all([
      this.listSectionFingerprints(leftId),
      this.listSectionFingerprints(rightId),
    ]);

    const sectionKeys = [...new Set([...leftSections.keys(), ...rightSections.keys()])].sort();
    const modules = sectionKeys.map((section) => {
      const left = leftSections.get(section) ?? new Set<string>();
      const right = rightSections.get(section) ?? new Set<string>();
      const added = [...right].filter((key) => !left.has(key));
      const removed = [...left].filter((key) => !right.has(key));
      const shared = [...right].filter((key) => left.has(key));
      return {
        section,
        label: labelForSection(section),
        leftCount: left.size,
        rightCount: right.size,
        added,
        removed,
        unchanged: shared.length,
        modified: 0,
      };
    });

    return {
      leftId,
      rightId,
      modules,
      totals: {
        added: modules.reduce((sum, item) => sum + item.added.length, 0),
        removed: modules.reduce((sum, item) => sum + item.removed.length, 0),
        unchanged: modules.reduce((sum, item) => sum + item.unchanged, 0),
      },
    };
  }

  private async listSectionFingerprints(versionId: string) {
    const rows = await prisma.$queryRaw<
      Array<{ section_key: string; record_name: string; configuration_json: string }>
    >`
      SELECT section_key, record_name, configuration_json
      FROM strategy_records
      WHERE version_id = CONVERT(uniqueidentifier, ${versionId})
        AND archived_at IS NULL
    `;
    const map = new Map<string, Set<string>>();
    for (const row of rows) {
      let systemKey = '';
      try {
        const config = JSON.parse(row.configuration_json || '{}') as { systemKey?: string };
        systemKey = String(config.systemKey ?? '');
      } catch {
        systemKey = '';
      }
      const fingerprint = systemKey || row.record_name;
      const set = map.get(row.section_key) ?? new Set<string>();
      set.add(fingerprint);
      map.set(row.section_key, set);
    }
    return map;
  }

  async rollbackToDraft(sourceVersionId: string) {
    await this.ensureDraft();
    return prisma.$transaction(async (tx) => {
      const sources = await tx.$queryRaw<
        Array<{
          id: string;
          strategyId: string;
          status: string;
          versionNumber: number;
        }>
      >`
        SELECT
          CONVERT(varchar(36), id) AS id,
          CONVERT(varchar(36), strategy_id) AS strategyId,
          status,
          version_number AS versionNumber
        FROM content_strategy_versions WITH (UPDLOCK, HOLDLOCK)
        WHERE id = CONVERT(uniqueidentifier, ${sourceVersionId})
      `;
      const source = sources[0];
      if (!source) throw new Error('Source version not found');

      const mutable = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT CONVERT(varchar(36), id) AS id, status
        FROM content_strategy_versions
        WHERE strategy_id = CONVERT(uniqueidentifier, ${source.strategyId})
          AND status IN ('DRAFT','INVALID','READY','IN_REVIEW','BLOCKED')
      `;
      if (mutable[0]) {
        throw new Error(
          `A mutable ${mutable[0].status} version already exists. Resolve or archive it before rollback.`,
        );
      }

      const maxRows = await tx.$queryRaw<Array<{ maxVersion: number | null }>>`
        SELECT MAX(version_number) AS maxVersion
        FROM content_strategy_versions
        WHERE strategy_id = CONVERT(uniqueidentifier, ${source.strategyId})
      `;
      const nextNumber = Number(maxRows[0]?.maxVersion ?? 0) + 1;
      const newVersionId = randomUUID();

      await tx.$executeRaw`
        INSERT INTO content_strategy_versions(id, strategy_id, version_number, status)
        VALUES (
          CONVERT(uniqueidentifier, ${newVersionId}),
          CONVERT(uniqueidentifier, ${source.strategyId}),
          ${nextNumber},
          ${'DRAFT'}
        )
      `;

      const records = await tx.$queryRaw<
        Array<{
          section_key: string;
          record_name: string;
          record_type: string | null;
          status: string;
          priority: number;
          configuration_json: string;
          effective_from: Date | null;
          effective_to: Date | null;
        }>
      >`
        SELECT
          section_key,
          record_name,
          record_type,
          status,
          priority,
          configuration_json,
          effective_from,
          effective_to
        FROM strategy_records
        WHERE version_id = CONVERT(uniqueidentifier, ${sourceVersionId})
          AND archived_at IS NULL
      `;

      for (const record of records) {
        const recordId = randomUUID();
        const effectiveFrom = record.effective_from ? record.effective_from.toISOString() : '';
        const effectiveTo = record.effective_to ? record.effective_to.toISOString() : '';
        await tx.$executeRaw`
          INSERT INTO strategy_records(
            id, version_id, section_key, record_name, record_type, status, priority, configuration_json,
            effective_from, effective_to
          ) VALUES (
            CONVERT(uniqueidentifier, ${recordId}),
            CONVERT(uniqueidentifier, ${newVersionId}),
            ${record.section_key},
            ${record.record_name},
            ${record.record_type},
            ${record.status},
            ${Number(record.priority)},
            ${record.configuration_json},
            CASE WHEN ${effectiveFrom} = '' THEN NULL ELSE CONVERT(datetime2, ${effectiveFrom}) END,
            CASE WHEN ${effectiveTo} = '' THEN NULL ELSE CONVERT(datetime2, ${effectiveTo}) END
          )
        `;
      }

      await tx.$executeRaw`
        INSERT INTO strategy_audit_events(version_id, action, actor_type, new_value, reason)
        VALUES (
          CONVERT(uniqueidentifier, ${newVersionId}),
          ${'ROLLBACK_DRAFT_CREATED'},
          ${'DEVELOPMENT_USER'},
          ${JSON.stringify({
            sourceVersionId,
            sourceVersionNumber: Number(source.versionNumber),
            clonedRecords: records.length,
          })},
          ${`Rollback draft cloned from version ${source.versionNumber}; active history remains immutable`}
        )
      `;

      return {
        id: newVersionId,
        versionNumber: nextNumber,
        status: 'DRAFT' as const,
        sourceVersionId,
        clonedRecords: records.length,
      };
    });
  }
}

export type StrategyAuditEvent = {
  id: string;
  versionId: string | null;
  versionNumber?: number | null;
  versionStatus?: string | null;
  action: string;
  actorType: string;
  actorReference: string | null;
  requestId: string | null;
  correlationId: string | null;
  previousValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
};

export type StrategyVersionSummary = {
  id: string;
  versionNumber: number;
  status: StrategyStatus;
  effectiveDate: string | null;
  lastValidatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  checksum: string | null;
  recordCount: number;
  sectionCount: number;
  sectionCounts: Record<string, number>;
  createdBy: string;
  createAction: string | null;
  createReason: string | null;
};

export type StrategyValidationResult = {
  id: string;
  ruleCode: string;
  ruleVersion: number;
  severity: string;
  passed: boolean;
  blocking: boolean;
  sectionKey: string | null;
  explanation: string;
  recommendation: string | null;
  checkedAt: string;
};
