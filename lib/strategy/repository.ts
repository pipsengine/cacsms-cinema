import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import {
  REQUIRED_SECTIONS,
  type SectionKey,
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

export class StrategyRepository {
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
        recommendation: 'Create at least one active record in this section',
      }));

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

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: '',
      status: row.status,
      priority: Number(row.priority),
      configuration: JSON.parse(row.configuration || '{}') as Record<string, unknown>,
      effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
      effectiveTo: row.effectiveTo?.toISOString() ?? null,
      rowVersion: row.rowVersion ?? undefined,
    }));
  }

  async create(versionId: string, section: SectionKey, data: StrategyRecord): Promise<StrategyRecord> {
    const id = randomUUID();
    const configJson = JSON.stringify(data.configuration ?? {});

    await prisma.$transaction(async (tx) => {
      const state = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status
        FROM content_strategy_versions WITH (UPDLOCK, HOLDLOCK)
        WHERE id = CONVERT(uniqueidentifier, ${versionId})
      `;
      if (state[0]?.status !== 'DRAFT') {
        throw new Error('Only draft versions can be edited');
      }

      await tx.$executeRaw`
        INSERT INTO strategy_records(
          id, version_id, section_key, record_name, status, priority, configuration_json
        )
        VALUES (
          CONVERT(uniqueidentifier, ${id}),
          CONVERT(uniqueidentifier, ${versionId}),
          ${section},
          ${data.name},
          ${data.status},
          ${data.priority},
          ${configJson}
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

    return { id, ...data };
  }

  async listAudit(versionId: string) {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        action: string;
        actorType: string;
        createdAt: Date;
        reason: string | null;
      }>
    >`
      SELECT TOP 100
        CONVERT(varchar(36), id) AS id,
        action,
        actor_type AS actorType,
        created_at AS createdAt,
        reason
      FROM strategy_audit_events
      WHERE version_id = CONVERT(uniqueidentifier, ${versionId})
      ORDER BY created_at DESC
    `;

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      actorType: row.actorType,
      createdAt: row.createdAt.toISOString(),
      reason: row.reason,
    }));
  }
}
