# Phase 1 — Repository Audit and Protected Rebuild Planning

Audit date: 2026-07-22  
Specification: `Master Implementation Prompt — Build the CACSMS Autonomous Image.docx`  
Disposition: The repository is an early partial implementation. It is not a production autonomous image-generation system.

## Executive finding

The repository currently provides a Next.js shell, a small Prisma schema, CRUD routes for projects/jobs/candidates, a polling worker, and a live summary dashboard. It does not yet provide a real image provider integration, professional scene ingestion, the required durable lifecycle, storage, file validation, evaluation, repair, continuity, geographic intelligence, outbox delivery, comprehensive persistence, or tests. Several pages contain fabricated production data, which directly violates section 29 of the specification.

The implementation must follow the specification's mandatory order. Phase 2+ work is gated on the protected reset and backup verification recorded below.

## What currently works

- Next.js 15 App Router application, TypeScript, React, Tailwind, shared shell, and established sidebar.
- Local MSSQL connectivity to `db_Cacsms-Contents` through Prisma.
- Basic persisted entities: Project, Job, GenerationAttempt, Candidate, and Asset.
- Project and job CRUD APIs and a database-backed operational summary endpoint.
- A background worker that avoids overlapping local polling and atomically claims the limited current stages.
- Development process runs web and worker independently and shuts the worker down gracefully.
- Lint, TypeScript, Prisma validation, and the production build pass.

## Reusable component inventory

| Component | Decision | Notes |
|---|---|---|
| `app/` routes and `apps/web/components/shell` | Preserve | Required shell/sidebar must not be redesigned without approval. |
| Prisma connection and MSSQL configuration | Extend | Replace the minimal schema with migration-controlled production entities. |
| Worker entry point | Extend | Keep Windows-compatible Node process; replace placeholder execution with durable outbox dispatch. |
| Job claim pattern | Rework | Useful atomic-claim concept, but processing state must be normalized and lease-based. |
| Dashboard API and root page | Extend | Database-backed, but only reflects the minimal schema. |
| Protected reset command | Replace (completed in Phase 1) | Prior command was unsafe; the new plan-first snapshot/preservation workflow is reusable. |

## Fake and incomplete implementation inventory

- `lib/job-orchestrator.ts` waits one second and marks stages successful without doing stage work.
- `app/visuals/image-generator/page.tsx` shows a fixed scene, queue count, provider health, progress, and lifecycle state.
- `app/scripts/page.tsx`, `app/storyboards/page.tsx`, `app/qa/page.tsx`, `app/health/page.tsx`, and library pages show hard-coded records or metrics.
- `app/api/demo/init/route.ts` creates random scores, budgets, priorities, and stock-photo URLs.
- Candidate creation previously generated random scores and placeholder URLs; this route must reject missing real media instead.
- There is no production provider adapter, storage adapter, evaluator, or file-integrity implementation.
- There are no automated tests.

These surfaces must never be represented as completed production capabilities.

## Blank-image root-cause analysis

There is no real generation pipeline from which to diagnose historical blank files. The current architecture would permit blank or inaccessible output because it lacks every required enforcement point:

1. Provider results are not downloaded by a backend adapter.
2. MIME type and file signatures are not checked.
3. Images are not decoded and dimensions are not verified.
4. Pixel variance and alpha coverage are not measured.
5. Storage write/read-back and hash verification do not exist.
6. Browser delivery is not checked before candidate success.
7. Candidate APIs accept arbitrary URLs.
8. Placeholder and stock-image fallbacks exist in production routes/demo data.

The target pipeline must make `VALIDATE_FILES` a critical gate before a Candidate can become `VALIDATED`, displayed, evaluated, or approved.

## Database and storage assessment

The schema contains only five tables and represents a small fraction of section 21. It lacks normalized lifecycle stages, state history, outbox events, idempotency records, leases, controls, audit events, requirements, sources, scene graphs, provider/model registries, prompt/workflow versions, evaluations, defects, repairs, asset versions/renditions/usages, continuity, geography, cost ledgers, benchmarks, and learning signals.

There is no configured durable asset store. `storage/assets` is the planned local development adapter root; production requires an approved durable file/object store. Provider URLs must never be treated as permanent asset references.

## API and security assessment

- APIs are unversioned and do not use schema validation libraries.
- Mutation endpoints lack idempotency keys, correlation IDs, audit records, rate limiting, transactional event creation, cancellation semantics, and structured error contracts.
- Job status can currently be directly mutated rather than transitioned through an authorization policy.
- Emergency stop and provider credential APIs do not exist.
- Provider credentials are not exposed to frontend code, which must remain true.
- Authentication UI is correctly absent, but privileged operation controls still require backend protection.

## Target architecture

```text
Script/Scene APIs
      ↓
Visual Requirements Compiler → Research/Geography/History evidence stores
      ↓
Scene Graph + Constraint Resolver + Cinematography Plan
      ↓
Workflow Planner + Prompt Compiler + Capability/Policy Registry
      ↓
MSSQL Job/Stage/Outbox transaction
      ↓
Windows-compatible Worker → versioned Provider Adapters
      ↓
Staging Storage → Integrity Gate → Candidate records
      ↓
Evaluation Ensemble → Defect/Repair Planner → full re-evaluation
      ↓
Approval → immutable AssetVersion/Rendition/Lineage → Storyboard/Video events
```

MSSQL is authoritative for workflow and metadata. Large media is stored through a versioned storage adapter. All mutations write audit and outbox records in the same transaction. Workers use expiring leases and idempotency keys. No provider SDK is called outside an adapter.

## Migration plan

1. Preserve the existing five tables and introduce normalized entities through additive Prisma migrations.
2. Add lifecycle definitions, JobStageExecution, SystemControl, WorkerLease, IdempotencyRecord, AuditEvent, and OutboxEvent.
3. Backfill existing Job status values into stage executions, recording the migration correlation ID.
4. Add script/scene, requirements, graph, evidence, prompt/workflow, and provider registry entities.
5. Add candidate validation/evaluation/defect/repair entities.
6. Add immutable AssetVersion, Rendition, Usage, and Lineage entities.
7. Add continuity, geography/history, cost, benchmark, and policy entities.
8. Introduce indexes/unique constraints before enabling each corresponding worker capability.
9. Remove legacy status shortcuts only after parity tests and rollback verification.

Every migration requires a pre-migration snapshot, migration test, post-migration count/integrity verification, and documented rollback procedure.

## Controlled reset and quarantine plan

`npm run db:reset` is plan-only unless both `--execute` and `--confirm=RESET_DEVELOPMENT_DATA` are supplied. Execution additionally requires `ALLOW_DEVELOPMENT_RESET=true` and refuses `NODE_ENV=production`.

Before deletion it:

1. Reads and inventories all current tables.
2. Creates a complete JSON logical snapshot.
3. Verifies non-zero size and records a SHA-256 checksum.
4. Identifies approved assets and their full project/job/candidate lineage.
5. Copies approved local files into the preserved backup area.
6. Excludes projects containing approved lineage from deletion.
7. Deletes eligible projects transactionally.
8. Quarantines referenced non-approved local media.
9. Records every preserved, quarantined, external, missing, failed, and deleted item in the manifest.

The command never runs at application startup and backups are excluded from source control.

## Risks and dependencies

- A real commercially approved image provider/model and credentials must be selected and contract-tested.
- Durable production media storage and malware scanning services are not selected.
- Research, Knowledge Universe, Brand Manager, video, timeline, and analytics contracts are not present in this repository.
- Geographic/historical verification requires authoritative source policies and licensed reference sources.
- Identity embeddings and likeness processing require consent, retention, and privacy decisions.
- Windows Server/IIS service identity, writable storage, TLS, reverse proxy, and worker service management require a deployment environment.
- Quality targets cannot be certified without golden datasets and statistically meaningful provider runs.

## Mandatory implementation backlog

The backlog follows section 27 exactly: schema/migrations → orchestration/outbox → storage/integrity → provider adapters/registry → real generation → requirements/scene graph → script/storyboard → cinematography/prompts/routing → diversity/evaluation/repair → identity/continuity/geography/history → overlays/video readiness → benchmarks/learning → dashboards/integrations → Windows/IIS certification.

Detailed status is maintained in `docs/MASTER_REQUIREMENTS_COVERAGE.md`.

## Phase 1 acceptance criteria

- [x] Full specification indexed and mapped to repository evidence.
- [x] Working/reusable/repair/replace inventories recorded.
- [x] Fake and prohibited implementation inventory recorded.
- [x] Blank-image risk causes documented.
- [x] Database and storage gaps documented.
- [x] Target architecture and ordered migration plan documented.
- [x] Protected reset requires environment and explicit confirmation guards.
- [x] Plan mode verified against the configured MSSQL database without mutation.
- [x] Complete logical snapshot, SHA-256 verification, approved lineage preservation, quarantine, and action manifest implemented.
- [x] Execute-mode backup verification recorded against the empty configured development database; snapshot and manifest checksums verified.

Phase 1 is complete. The verified artifacts are stored under the ignored `backups/reset-2026-07-22T14-09-40-297Z/` directory. Phase 2 may now begin in the specification's mandatory order.
