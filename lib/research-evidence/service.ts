import { createHash, randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import type { IntakePackage } from './contracts';

export class ResearchService {
  /**
   * Verify and acknowledge an Idea Qualification project handoff package.
   * When fields are omitted, builds from the latest IQ handoff (or fails honestly).
   */
  async consumeIntake(input: Partial<IntakePackage> = {}) {
    let projectId = input.projectId;
    let ideaQualificationHandoffId = input.ideaQualificationHandoffId;
    let strategyVersionId = input.strategyVersionId;
    let checksum = input.checksum;
    let packageJson = input.packageJson;

    if (!projectId || !ideaQualificationHandoffId || !strategyVersionId || !checksum || !packageJson) {
      const built = await this.buildIntakeFromIdeaQualification();
      projectId = built.projectId;
      ideaQualificationHandoffId = built.ideaQualificationHandoffId;
      strategyVersionId = built.strategyVersionId;
      checksum = built.checksum;
      packageJson = built.packageJson;
    }

    const hash = createHash('sha256').update(packageJson).digest('hex');
    if (hash.toLowerCase() !== checksum.toLowerCase()) {
      throw new Error('Idea Qualification package checksum mismatch');
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          MERGE re_intake_packages WITH (HOLDLOCK) AS t
          USING (
            SELECT
              CONVERT(uniqueidentifier, ${projectId}) AS source_run_id,
              ${checksum} AS checksum
          ) AS s
          ON t.source_run_id = s.source_run_id AND t.checksum = s.checksum
          WHEN NOT MATCHED THEN
            INSERT (
              source_run_id, strategy_version_id, checksum, package_json,
              status, received_at, acknowledged_at
            )
            VALUES (
              CONVERT(uniqueidentifier, ${projectId}),
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
          UPDATE iq_handoffs
          SET status = 'ACKNOWLEDGED',
              acknowledged_at = sysutcdatetime(),
              updated_at = sysutcdatetime(),
              content_project_id = CONVERT(uniqueidentifier, ${projectId})
          WHERE id = CONVERT(uniqueidentifier, ${ideaQualificationHandoffId})
            AND status IN ('PENDING', 'DISPATCHED')
        `;

        await tx.$executeRaw`
          INSERT INTO re_audit_events(action, actor_type, reason, new_value)
          VALUES (
            ${'INTAKE_PACKAGE_ACKNOWLEDGED'},
            ${'SERVICE'},
            ${'Consumed Idea Qualification package after checksum verification'},
            ${checksum}
          )
        `;
      },
      { isolationLevel: 'Serializable' },
    );

    return { status: 'ACKNOWLEDGED', checksum: hash, ideaQualificationHandoffId };
  }

  private async buildIntakeFromIdeaQualification(): Promise<IntakePackage> {
    const handoffs = await prisma.$queryRaw<
      Array<{
        handoffId: string;
        candidateId: string;
        checksum: string;
        payloadJson: string;
        contentProjectId: string | null;
        strategyVersionId: string | null;
      }>
    >`
      SELECT TOP 1
        CONVERT(varchar(36), h.id) AS handoffId,
        CONVERT(varchar(36), h.candidate_id) AS candidateId,
        h.checksum AS checksum,
        h.payload_json AS payloadJson,
        CONVERT(varchar(36), h.content_project_id) AS contentProjectId,
        CONVERT(varchar(36), i.strategy_version_id) AS strategyVersionId
      FROM iq_handoffs h
      JOIN iq_candidates c ON c.id = h.candidate_id
      JOIN iq_cycles cy ON cy.id = c.cycle_id
      JOIN iq_intake_packages i ON i.id = cy.intake_package_id
      WHERE h.status IN ('PENDING', 'DISPATCHED', 'ACKNOWLEDGED')
      ORDER BY h.created_at DESC
    `;

    const handoff = handoffs[0];
    if (!handoff) {
      throw new Error('No Idea Qualification handoff package available to consume');
    }

    const hash = createHash('sha256').update(handoff.payloadJson).digest('hex');
    if (hash.toLowerCase() !== handoff.checksum.toLowerCase()) {
      throw new Error('Idea Qualification package checksum mismatch');
    }
    if (!handoff.strategyVersionId) {
      throw new Error('Idea Qualification handoff is missing strategy version identity');
    }

    const projectId = handoff.contentProjectId ?? handoff.candidateId;
    const packageJson = JSON.stringify({
      projectId,
      ideaQualificationHandoffId: handoff.handoffId,
      strategyVersionId: handoff.strategyVersionId,
      candidateId: handoff.candidateId,
      handoffPayload: JSON.parse(handoff.payloadJson),
      generatedAt: new Date().toISOString(),
    });
    const checksum = createHash('sha256').update(packageJson).digest('hex');

    return {
      projectId,
      ideaQualificationHandoffId: handoff.handoffId,
      strategyVersionId: handoff.strategyVersionId,
      checksum,
      packageJson,
    };
  }

  async startCycle(idempotencyKey: string) {
    return prisma.$transaction(
      async (tx) => {
        const intake = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT TOP 1 CONVERT(varchar(36), id) AS id
          FROM re_intake_packages WITH (UPDLOCK, HOLDLOCK)
          WHERE status = 'ACKNOWLEDGED'
          ORDER BY acknowledged_at DESC
        `;
        if (!intake[0]) {
          throw new Error('No acknowledged Idea Qualification intake package');
        }

        const existing = await tx.$queryRaw<Array<{ id: string; status: string }>>`
          SELECT CONVERT(varchar(36), id) AS id, status
          FROM re_cycles
          WHERE idempotency_key = ${idempotencyKey}
        `;
        if (existing[0]) {
          return { cycleId: existing[0].id, status: existing[0].status };
        }

        const id = randomUUID();
        const payload = JSON.stringify({ cycleId: id });

        await tx.$executeRaw`
          INSERT INTO re_cycles(id, intake_package_id, idempotency_key, status, started_at)
          VALUES (
            CONVERT(uniqueidentifier, ${id}),
            CONVERT(uniqueidentifier, ${intake[0].id}),
            ${idempotencyKey},
            ${'QUEUED'},
            sysutcdatetime()
          )
        `;
        await tx.$executeRaw`
          INSERT INTO re_jobs(cycle_id, job_type, status, payload_json)
          VALUES (
            CONVERT(uniqueidentifier, ${id}),
            ${'RESEARCH_RUN'},
            ${'PENDING'},
            ${payload}
          )
        `;
        await tx.$executeRaw`
          INSERT INTO re_outbox(event_type, aggregate_id, payload_json)
          VALUES (
            ${'RESEARCH_RUN_REQUESTED'},
            CONVERT(uniqueidentifier, ${id}),
            ${payload}
          )
        `;
        await tx.$executeRaw`
          INSERT INTO re_audit_events(cycle_id, action, actor_type, reason)
          VALUES (
            CONVERT(uniqueidentifier, ${id}),
            ${'RESEARCH_RUN_QUEUED'},
            ${'DEVELOPMENT_USER'},
            ${'Research run queued; worker must execute with real retrieval providers'}
          )
        `;

        return { cycleId: id, status: 'QUEUED' };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async handoff(dossierId: string, idempotencyKey: string) {
    return prisma.$transaction(
      async (tx) => {
        const dossiers = await tx.$queryRaw<
          Array<{
            id: string;
            status: string;
            checksum: string;
            package_json: string;
          }>
        >`
          SELECT
            CONVERT(varchar(36), id) AS id,
            status,
            checksum,
            package_json
          FROM re_research_dossiers WITH (UPDLOCK, HOLDLOCK)
          WHERE id = CONVERT(uniqueidentifier, ${dossierId})
        `;

        const row = dossiers[0];
        if (!row) throw new Error('Research dossier not found');
        if (row.status !== 'READY') {
          throw new Error('Only a READY research dossier may be handed off');
        }

        const checksum = createHash('sha256').update(row.package_json).digest('hex');
        if (checksum.toLowerCase() !== row.checksum.toLowerCase()) {
          throw new Error('Research dossier checksum mismatch');
        }

        await tx.$executeRaw`
          IF NOT EXISTS (SELECT 1 FROM re_dossier_handoffs WHERE idempotency_key = ${idempotencyKey})
          BEGIN
            INSERT INTO re_dossier_handoffs(dossier_id, status, idempotency_key, checksum, payload_json)
            VALUES (
              CONVERT(uniqueidentifier, ${dossierId}),
              ${'PENDING'},
              ${idempotencyKey},
              ${checksum},
              ${row.package_json}
            );
            INSERT INTO re_outbox(event_type, aggregate_id, payload_json)
            VALUES (
              ${'RESEARCH_DOSSIER_READY'},
              CONVERT(uniqueidentifier, ${dossierId}),
              ${row.package_json}
            );
          END
        `;

        return { status: 'PENDING', checksum };
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
