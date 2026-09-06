# Module 15 — Autonomous End-to-End Production Orchestration (Product Requirements Document)

## Overview
- **Summary**: Add Module 15 — a production-grade autonomous orchestration engine that runs the entire Cacsms Cinema content production pipeline (Strategy Brief → Opportunity Intelligence → Research Studio → Script Studio → Scene & Storyboard → AI Generation → Editing & QA → Packaging → Approval & Publishing → Analytics & Learning) with zero human intervention. A new background worker invokes every repository stage transaction (`save*`, `submit*`, `decide*`, `complete*`, `register*`) in dependency order, respecting M14-provided governance feeds (agent fleet configuration, workflow definitions, provider budgets, notification policies). Human input remains ONLY at Start/Stop, AI/Provider subscriptions, and the GOV&SEC / AI&AUTOMATION / OPERATIONS admin groups per the permanent boundary rule.
- **Purpose**: Fulfill the project's autonomous-end-to-end mandate; make `pnpm dev` sufficient to start a system capable of taking one approved strategy brief through to a published master with analytics snapshot, driven entirely by deterministic repository transactions + an auditable run ledger.
- **Target Users**: The autonomous worker itself (primary); operations engineers inspecting runs via `/admin/workflows` / `/admin/operations` / `/health` (secondary).

## Goals
- G1. Single worker process executes every gate transaction across M04–M13 for one or more projects autonomously, in dependency order, with bounded retries and back-pressure.
- G2. All handoffs between stages use the *existing* repository transaction layer so every completion writes the same `ProjectHandoffs` / `ProjectStageExecutions` / `ProjectVersions` rows a human UI would write (one source of truth, no parallel logic drift).
- G3. A run ledger with deterministic state transitions exists for every stage call, observable, auditable, retryable from any step idempotently, and never re-runs a COMPLETED stage transaction.
- G4. Governance feeds from M14 are *gating* before autonomous runs execute: agent `IsActive=true`, budget `SpentAmount < BudgetAmount` (hard stop when `>= HardLimit`), provider `Status = CONNECTED`, active workflow version, notification policies fire on FAIL/RETRY/BACKOFF.
- G5. Upstream M12 Publication.ExternalId + M13 Analytics ingestion close the loop: after publishing the autonomous worker schedules performance snapshots and then applies learning feedback, cycling the next opportunity from insight (M05 → M04 handoff for derivative short-form projects via the M13 recycling decision).
- G6. Failure modes are explicit: each stage has FAIL → RETRY(max) → DEAD_LETTER transitions. DEAD_LETTER entries surface in `/admin/operations` + `listMyWork` + notifications. Human intervention is *only* required to rescue a DEAD_LETTER (restart/resume from the run id), or to alter governance.

## Non-Goals
- NG1. Changing repository `decide*` semantics, stage transaction rules, or M04–M13 business logic. The orchestration worker calls repository functions *exactly* as the UI endpoints already call them.
- NG2. Implementing a general-purpose workflow DSL, event bus, queue broker, or distributed system. Module 15 runs as one in-process worker (inside `apps/api`) backed by MSSQL tables. No Kafka, Redis, Temporal, or BullMQ.
- NG3. Replacing the Next.js UI or adding any new HUMAN-facing UI flows inside the PRODUCTION PIPELINE group. UI changes are limited to observability surfaces inside the admin groups (AI&AUTOMATION / OPERATIONS / GOV&SECURITY).
- NG4. Replacing the demo data fixtures or altering module01-data…module14-data.
- NG5. Multi-workspace parallel orchestration as a horizontal scalability feature (single workspace worker; scale-out deferred).
- NG6. External LLM inference as part of the orchestrator. Repository functions already contain deterministic AI scaffolding writes; the orchestrator just schedules those writes.

## Background & Context
- Modules 01–14 are fully integrated (commits daface1 → 0ac09b5), every stage already exposes a repository transaction that writes handoff rows + completes stages + seeds downstream work, yet no component exists that *automatically calls them in order*. Currently a human must click through the UI.
- The `ProjectStageExecutions` table already has 22 seeded rows per project with `Status NOT_STARTED / IN_PROGRESS / AWAITING_APPROVAL / COMPLETED / FAILED / BLOCKED` — the worker reads/writes that same state machine.
- `ProjectHandoffs` already carry `FromStage → ToStage → OutputArtifactJson` rows — they are the deterministic wiring graph the worker follows. No parallel wiring map is needed.
- M14 `module14-data.agents[9]` lists AUTONOMOUS / HUMAN_GATED / ENFORCED / SUBSCRIPTION agent modes. Worker checks `mode=AUTONOMOUS` + `IsActive=true` before dispatching.
- M14 `module14-data.workflows[21]` SLA column (2h–48h) defines backoff timeouts per stage; exceeded SLA = FAIL + escalate notification (severity CRITICAL).
- M14 ProviderBudgets hard-stop rule: `SpentAmount >= HardLimit` → worker refuses generation jobs (M09) + records budget-gate FAIL.

## Functional Requirements
- **FR-1 Autonomous Run Loop**: Worker polls every N seconds (configurable default 5s via SystemSettings `orchestrator.poll_interval_ms`) for projects that have at least one non-terminal stage AND all upstream handoff conditions met.
- **FR-2 Deterministic Stage Wiring**: Worker resolves next stage for project P by reading `ProjectStageExecutions` joined with `WorkflowStageDefinitions` AND verifying the prerequisite handoff row(s) in `ProjectHandoffs` exist with `Status = COMPLETED`. Stage dependency rules mirror repository code: SCRIPT APPROVE → CHARACTER_BIBLE + SCENE_MATRIX; PRODUCTION_PLANNING APPROVE → IMAGE_GENERATION + VIDEO_GENERATION; EDIT/QA APPROVE → THUMBNAIL + SEO_METADATA; MASTER_APPROVAL → FINAL_APPROVAL → PUBLISHING → PERFORMANCE_MONITORING; ANALYTICS/LEARNING APPLY → AI_LEARNING COMPLETE; RECYCLING APPROVE → spins derivative child project if enabled.
- **FR-3 Stage Transaction Execution**: For each ready stage, worker calls the exact existing repository functions already exported by `repository.ts`: `saveStrategyBrief/submitStrategyBrief/decideStrategyBrief/decideOpportunity/saveResearchPack/submitResearchPack/decideResearchPack/generateScriptConcepts/decideScriptConcept/saveScriptSections/submitScript/decideScript/saveCharacter/saveScene/submitProductionPlanning/decideProductionPlanning/createGenerationJob/registerGeneratedAsset/decideGeneratedAsset/completeGenerationStage/updateQACheck/createMasterVideoVersion/decideMasterVideo/saveMetadataPackage/saveThumbnailVariant/decideThumbnailVariant/updatePackagingCheck/createPackagingVersion/decidePackagingVersion/updateReleaseCheck/decideReleaseApproval/createPublishJob/controlPublishJob/registerPublication/ingestPerformanceSnapshot/decideLearningInsight/applyLearningFeedback/decideContentRecyclingPlan`. The same body schemas from the Fastify endpoints are used as inputs (deterministic defaults from module14-data.workflows[stage].owner agent + mode).
- **FR-4 Run Ledger & Idempotency**: Every stage invocation is recorded in a new `OrchestrationRunEvents` table with `(ProjectId, StageKey, AttemptNo, TriggeredBy='ORCHESTRATOR_v15', PayloadJson, ResultJson, Status=QUEUED/RUNNING/SUCCESS/FAIL/RETRY/DEAD_LETTER, RunId)` compound unique key. A SUCCESS write is final; the worker skips any (ProjectId, StageKey) already SUCCESS for the same current Active workflow version. Retry happens only for FAIL with AttemptNo < max_retries from the workflow row.
- **FR-5 Governance Gates Before Dispatch**: Worker calls `getAdminOperations` aggregates first; enforces: (a) agentKey corresponding to workflow[stage].owner is `mode='AUTONOMOUS' AND IsActive=1`; (b) providerKey budget row for M09 generation jobs has `SpentAmount < HardLimit AND (BudgetAmount - SpentAmount) > estimated_job_min_cost`; (c) provider integration status = CONNECTED; (d) active WorkflowConfiguration ACTIVE version > 0. When a gate fails the event transitions FAIL + notification policy for severity.
- **FR-6 Notification Dispatch**: After each stage SUCCESS / FAIL / RETRY_3 / DEAD_LETTER / BACKOFF_SLA_EXCEEDED event, the worker calls `listNotificationPolicies` and matches event.severity → policy. Policy rule channels insert a row via `listNotifications`/`markNotification` API (in-process, no SMTP).
- **FR-7 Project Control Integration**: The new command-center action START_PROJECT triggers the autonomous run for that project (inserts an initial SEED event). PAUSE drains current in-flight stages and skips new polls. RESUME restarts. STOP flips all RUNNING → CANCELLED (terminal non-fail). RESTART clears SUCCESS rows from the target stage onward and re-seeds.
- **FR-8 Publication → Analytics Close Loop**: After a SUCCESS `registerPublication` event, the worker schedules 4 deterministic `ingestPerformanceSnapshot` events (1h / 6h / 24h / 48h windows from publishedAt using NextIngestionAt scheduling). It then auto-determines `decideLearningInsight=APPROVE` for every generated insight with `confidence >= approval_threshold_from_settings`, and `applyLearningFeedback`, and then runs `decideContentRecyclingPlan=APPROVE` for recycling items with priority >= HIGH. When a recycling plan APPROVES, the worker inserts a NEW derivative `ContentProject` (type SHORTFORM, parent_id links back) by calling `createContentProject` — completing the closed learning loop.
- **FR-9 Observability Endpoints**: New GET `/api/orchestration/overview` (aggregates runs by status across projects, queue depth, next poll, running stage count, dead-letter count), GET `/api/orchestration/projects/:projectId/runs` (full run ledger for one project, latest first), POST `/api/orchestration/runs/:runId/retry` (DEAD_LETTER rescue → RETRY attempt increment), GET `/api/orchestration/runs/:runId` (payload + result json full).
- **FR-10 Readiness / Health Integration**: `/health` gains `module15='ready'` and version bumps `0.15.0`. New health checks added for `orchestrator.last_poll_at` (warn if > 2x poll interval), `orchestrator.dead_letter_count` (warn if > 0), `orchestrator.running_count` (informational).

## Non-Functional Requirements
- **NFR-1 Correctness & Idempotency (rule)**: Re-running the worker against any project state must produce the same or strictly-forward stage progression; re-running a completed SUCCESS transaction must be a no-op (never double-write handoffs, never double-approve, never double-publish).
- **NFR-2 Backwards Compatibility (rule)**: No breaking changes to M01–M14 routes, repository function signatures, migration files 001…016 byte-for-byte untouched, package.json start/typecheck/build scripts identical in behaviour.
- **NFR-3 Robustness**: At-Least-Once semantics for each repository transaction; transaction-level rollback on DB failure; exponential backoff (min 5s, max 10 min) between retries; dead-letter instead of infinite loops.
- **NFR-4 Future-Readiness**: Worker code is structured as an engine (orchestrator.ts) pluggable into the existing Fastify server (registered as a decorator). All configuration lives in SystemSettings string-keyed rows so no code change is required to alter thresholds, timeouts, concurrency, approval defaults. Stage -> agent dispatch map is read from the 21-row `WorkflowStageDefinitions` + `Module14.workflows` and NOT hard-coded in the engine.
- **NFR-5 Performance**: Poll loop < 5% CPU at idle; no N+1 queries (batch projects via CTE or `WHERE StageStatus IN (..)` with single query). Each project dispatch makes exactly 1 governance read + 1 ledger write + 1 transaction call + 1 result write.
- **NFR-6 Auditability & Compliance**: Every worker write carries `TriggeredBy = 'ORCHESTRATOR_v15'` in `ProjectActivities`, `AuditEvents`, and `OrchestrationRunEvents`. Usernames/actor columns reference the owner agent key (not a human), with an `ActorType='AGENT'` discriminator where available.

## Constraints
- **Technical**: Must use pnpm monorepo patterns, no new npm packages (no pnpm install). Additions must be pure TypeScript + existing runtime dependencies (fastify/mssql/zod/jsonwebtoken/bcryptjs). MSSQL tables use `IF OBJECT_ID('U') IS NULL` idempotent DDL. Migration filename = `017_module15_autonomous_orchestration.sql` (renumbered after M14's 016). Fastify server v5 decorator pattern; worker registers via `server.decorate('orchestrator', engine)` at boot.
- **Business**: Permanent boundary rule preserved. The engine *must not* prompt for or require any human clicks inside the 10 PRODUCTION PIPELINE stages. If a DEAD_LETTER occurs the rescue entry point is ONLY `/admin/operations` (human-admin group) — rescue is not a pipeline step.
- **Dependencies**: Relies on all existing M04–M13 repository functions working exactly as tested (T5 gates passed at commit 0ac09b5). Relies on M14 governance tables (AgentDefinitions / WorkflowConfigurations / ProviderIntegrations / ProviderBudgets / NotificationPolicies / SystemSettings) being populated. Bootstrap = `db:bootstrap-module15` script slot at packages/database/package.json L39.

## Assumptions
- A1. The worker runs inside the `apps/api` server process. No separate worker binary / pm2 process is needed — when you run `pnpm dev`, API boots, decorator registers, polls start.
- A2. Demo mode fixtures (`module04-data..module13-data`) are used as deterministic default payloads for each stage when save/submit/decide need input content — content generation is scaffold-only, same as M04–M13 demo UI pages produce.
- A3. Auto-approve threshold for Learning Insights is 85% confidence (configurable via SystemSettings key `orchestrator.learning_approval_threshold`). Recycling auto-approval threshold is HIGH priority (configurable via `orchestrator.recycling_approval_priority`).
- A4. Single workspace, single tenant for v15 release. Multi-workspace parallelism deferred.
- A5. Users have already configured AI subscriptions through /admin/integrations and set provider budgets through /admin/budgets before expecting a successful fully-autonomous run. If not configured, governance gates FAIL fast with human-surfaced notifications.

## Acceptance Criteria

### AC-1: End-to-end autonomous demo run completes from Strategy Brief through Analytics Learning + Recycling derivative on one fixture project
- **Type**: `rule`
- **Given**: Provider integrations seeded as CONNECTED, budgets at 100% with low HardLimit (pass gate), agents AUTONOMOUS + ACTIVE, demo fixture content project CAC-DEMO-01 created via POST /command-center/projects control START action.
- **When**: Worker polls for 60 simulated seconds (integration test advances clock via `NextIngestionAt` override).
- **Then**: For project CAC-DEMO-01 every ProjectStageExecution row has Status=COMPLETED; exactly one ProjectHandoff STRATEGY_BRIEF→OPPORTUNITY_DISCOVERY, OPPORTUNITY→RESEARCH, RESEARCH→CONCEPT_APPROVAL, CONCEPT→SCRIPT, SCRIPT→{CHARACTER_BIBLE,SCENE_MATRIX}, PROD_PLAN→{IMAGE,VIDEO,VOICE,MUSIC} GENERATION, GENERATION→EDIT_ASSEMBLY, EDIT/QA→{THUMBNAIL,SEO}, SEO→FINAL_APPROVAL, APPROVAL→PUBLISHING, PUBLISHING→PERFORMANCE_MONITORING; Publication row exists with ExternalPublicationId; at least 4 PerformanceSnapshot rows ingested (1h/6h/24h/48h windows); >=1 LearningInsight APPROVED + >=1 LearningFeedback APPLIED; ContentRecyclingPlan APPROVED AND 1 derivative child project created with parent_id = CAC-DEMO-01.
- **Pass Condition**: All stage rows COMPLETED + derivatives created + publication registered + analytics ingested, 0 FAIL/DEAD_LETTER events for the project.
- **Evidence**: `pnpm --filter @cacsms/api test` includes `autonomous-e2e.spec.ts` that runs the loop with a 60s timeout and asserts above row counts via MSSQL.

### AC-2: Governance budget hard-stop prevents overspent generation jobs
- **Type**: `rule`
- **Given**: ProviderBudgets row for Video provider has SpentAmount = HardLimit (budget exhausted).
- **When**: Worker reaches the M09 VIDEO_GENERATION stage dispatch point.
- **Then**: The OrchestrationRunEvents row transitions FAIL with `ResultJson.reason = 'PROVIDER_BUDGET_HARD_LIMIT_EXCEEDED'`; NO row is inserted into GenerationJobs (via repository `createGenerationJob`); notification policy matches CRITICAL severity.
- **Pass Condition**: GenerationJobs count for the project remains 0 and FAIL event exists with reason string.
- **Evidence**: Unit test `autonomous-budget-gate.spec.ts` in apps/api/test/ seeds budget, invokes engine `dispatch(project, stage)` directly, asserts job+event state.

### AC-3: Idempotent re-run never duplicates handoffs or approvals
- **Type**: `rule`
- **Given**: Project CAC-DEMO-01 has SUCCESS event for decideStrategyBrief (APPROVE) + corresponding handoff row.
- **When**: Worker restarts and polls again (identical state, same active workflow version).
- **Then**: Engine resolves stage as ALREADY_COMPLETED; writes NO new decideStrategyBrief call; handoff count remains 1; no double-approval row inserted into ProjectApprovals.
- **Pass Condition**: Event count for (project,stage,success) == 1 unchanged; ProjectHandoffs count same 1 before==after.
- **Evidence**: `autonomous-idempotency.spec.ts` runs dispatch twice, counts rows before/after.

### AC-4: FAIL events respect max_retries + exponential backoff + DEAD_LETTER
- **Type**: `rule`
- **Given**: Workflow stage max_retries = 3; repository decide* function simulates throw on first 3 calls, passes on 4th OR fails forever.
- **When**: Engine polls 4+ times with backoff clocks advanced.
- **Then**: AttemptNo = 1 FAIL → Attempt 2 FAIL → Attempt 3 FAIL → AttemptNo = 4 transitions DEAD_LETTER (when 4th fails) OR SUCCESS (if 4th passes); NextPollAt uses backoff (5s→10s→20s→40s… capped 10min).
- **Pass Condition**: Exactly 3 RETRY events + 1 DEAD_LETTER + backoff interval <= `2^(attempt-1)*5` seconds; or 3 RETRY + 1 SUCCESS with no DEAD_LETTER.
- **Evidence**: `autonomous-retries.spec.ts` stubs repository failures, inspects NextPollAt & AttemptNo rows.

### AC-5: Readiness reporting + smoke line 15
- **Type**: `rule`
- **Given**: Worker boots via API server tsx watch.
- **When**: GET /health hit; smoke-test.js run; typecheck + build executed.
- **Then**: /health body has `version="0.15.0"` AND `module01..module15 = "ready"` (15 module keys); smoke-test.js prints EXACTLY 15 console.log lines (new 15th line = "Module 15 API contracts: autonomous orchestration run ledger, stage dispatch, governance gating, retry/backoff, publication→analytics closed-loop, dead-letter rescue endpoints."); pnpm -r typecheck exit 0; pnpm -r build exit 0.
- **Pass Condition**: 3 assertions above all true.
- **Evidence**: `pnpm -r typecheck` → exit 0; `pnpm -r build` exit 0; `/health` curl includes module15; `node apps/api/dist/smoke-test.js | wc -l` = 15.

### AC-6: Orchestration Admin observability routes HTTP 200 + run ledger renders
- **Type**: `rule`
- **Given**: 3 OrchestrationRunEvents rows (1 SUCCESS, 1 FAIL, 1 DEAD_LETTER) seeded.
- **When**: GET /api/orchestration/overview, GET /api/orchestration/projects/:id/runs, POST /api/orchestration/runs/:id/retry, GET /admin/workflows page load, GET /admin/operations page load.
- **Then**: All endpoints HTTP 200; overview json includes {success:1, fail:1, dead_letter:1}; retry changes DEAD_LETTER → RETRY AttemptNo=4; /admin/workflows shows RunEvents column with SUCCESS/FAIL/DEAD_LETTER pills; /admin/operations shows dead-letter card count = 1.
- **Pass Condition**: HTTP statuses + json counts + UI pill counts match seed state.
- **Evidence**: HTTP probe curl 4 endpoints + grep admin pages for pill class matches.

### AC-7: Future-Readiness Engine Separation
- **Type**: `rubric`
- **Dimension**: Extensibility to add a new stage N without changing engine.ts
- **Scale**: 1–5
- **Anchors**: 1 = Engine hard-codes all stage → function maps and new stage requires modifying 5+ engine files; 3 = Stage map is a data table in code (map object, 1 line to add); 5 = Stage → repository function dispatch resolved purely from `WorkflowStageDefinitions.OwnerAgentKey` → `AgentDefinitions.Capability` → repository function match via convention; engine never reads a stage-name switch/case; adding new stage = insert 1 new WorkflowStageDefinition row + 1 AgentCapability row + 1 repository export.
- **Pass Threshold**: >= 4
- **Evidence**: Static code review of apps/api/src/orchestrator.ts for the presence of stage-name switch statements; count of switch branches vs convention/table-lookup.

### AC-8: Robustness & DR readiness
- **Type**: `rubric`
- **Dimension**: Recovery behaviour on worker crash mid-transaction + DEAD_LETTER rescue flow
- **Scale**: 1–5
- **Anchors**: 1 = Crash mid-dispatch duplicates writes on restart, DEAD_LETTER unrecoverable; 3 = Idempotency works for most stages, DEAD_LETTER rescue needs manual DB edits; 5 = Crash restarts recover via RUNNING→RETRY cleanup pass on boot; DEAD_LETTER rescue via single POST /api/orchestration/runs/:id/retry endpoint; full event replay audit log available; every stage transaction wrapped in DB transaction so partial writes do not occur.
- **Pass Threshold**: >= 4
- **Evidence**: Boot recovery pass code in orchestrator.ts (lines boot cleanup RUNNING); code search for mssql transaction usage around each engine repository call; rescue endpoint spec test.

## Open Questions
- [x] Q1: Human intervention locations → answered in permanent boundary rule; Start/Stop / Agent Subscriptions / Governance & Security group + rescue of DEAD_LETTER via /admin/operations = exhaustive.
- [x] Q2: Robustness/professional/future-ready → covered explicitly by NFR-3 NFR-4 NFR-6 + AC-7 AC-8.
- [x] Q3: Scope includes closed-loop recycling derivative project creation → yes included in FR-8 AC-1.
