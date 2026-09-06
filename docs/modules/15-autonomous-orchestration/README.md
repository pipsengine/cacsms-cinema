# Module 15 — Autonomous End-to-End Production Orchestration

> **Architectural Mandate Boundary**: The only human inputs allowed across the entire 10-stage production pipeline (Strategy Brief → Analytics & Learning) are (1) process start/stop (double-click `START-CACSMS.bat` or `pnpm dev`; Ctrl+C to stop), (2) AI Agent/provider subscriptions, API keys, billing plans, and (3) Governance & Security, Operations Administration, and Platform Administration pages. **Every gate save/submit/decide/complete/register handoff inside the production pipeline runs autonomously with zero clicks.** Stuck stages enter DEAD_LETTER state; human rescue is only allowed via `/admin/runs` Post Run Retry (Platform Administration rescue boundary) — the sole place a human can re-enter an autonomous pipeline.

## Inventory

### Persistence (4 tables + 5 indexes, idempotent)
- `OrchestrationRuns`: RunId PK · compound unique index filtered to `Status='SUCCESS'` (so the same ProjectId + StageKey + WorkflowVersionNo can only be idempotently written once per SUCCESS). Fields: StageKey, AgentCapability, TriggeredBy (ORCHESTRATOR_v15 / CLOSED_LOOP_v15 / ADMIN_SEED_v15 / HUMAN), PayloadJson + ResultJson (NVARCHAR(MAX) flexible schema = future-ready evolvability), Status enum (QUEUED/RUNNING/SUCCESS/FAIL/RETRY/DEAD_LETTER/CANCELLED), AttemptNo, MaxRetries, NextPollAt (exponential backoff 2^(n-1)·5s capped 10 min), SlaDueAt.
- `OrchestrationRunEvents`: per-run audit stream · RunId FK CASCADE · EventType, Severity, DetailJson, Actor, EventAt DEFAULT SYSUTCDATETIME() · index `IX_RunEvents_RunId_EventAt`.
- `OrchestratorHeartbeats`: WorkerId PK (api-main) · LastHeartbeat, PollCount, MachineName, ProcessId, Status · index `IX_Heartbeats_LastHeartbeat`. Lapsed RUNNING rows → RETRY by boot recovery.
- `AgentCapabilityMap`: AgentCapability PK → RepositoryFunction + DefaultPayloadJson + DispatchPhase (TRANSACT/DECIDE/COMPLETE). New stage = single new row + new repo export + zero engine edits.
- 5 indexes: `IX_OrchestrationRuns_Workspace_Project_Status`, `IX_OrchestrationRuns_Stage_Status_NextPoll`, `IX_OrchestrationRuns_Status_DeadLetter` (filtered WHERE Status = 'DEAD_LETTER'), `IX_OrchestrationRunEvents_RunId_EventAt`, `IX_OrchestratorHeartbeats_LastHeartbeat`.

### Bootstrap (4 MERGE-upserts)
Run `pnpm --filter @cacsms/database db:bootstrap-module15`:
1. **AgentCapabilityMap (49 rows)** maps every 10-stage production handoff (save/submit/decide/complete/register/ingest) plus 4 PerformanceSnapshot windows, LearningInsight, LearningFeedback, RecyclingDecide — table-driven engine dispatch, zero hardcoded stage names.
2. **SystemSettings (7 rows)**: `orchestrator.enabled`, `orchestrator.poll_interval_ms` (5000), `orchestrator.concurrency` (1), `orchestrator.learning_approval_threshold` (85), `orchestrator.recycling_approval_priority` (HIGH), `orchestrator.default_sla_multiplier` (1.0), `orchestrator.boot_recovery` (true) — every threshold/time-out lives in SystemSettings, no code edits needed.
3. **NotificationPolicies (5 auto-escalations)**: ORCH_FAIL · ORCH_RETRY_3 · ORCH_DEAD_LETTER · ORCH_SLA_BREACH · ORCH_BUDGET_GATE.
4. **OrchestratorHeartbeats**: WorkerId = 'api-main' seeded.

### Repository contract (12 new exports, all `.recordset` per query to avoid TS7053)
1. `getOrchestratorBootstrap(wsId)` → 6 parallel recordsets: heartbeats, settings, capabilities, policies, notifications, active workflow (top VERSIONED ACTIVE).
2. `pollReadyStages(wsId,concurrency)` → HandoffPrep CTE gate + WorkflowStageDefinitions.AgentCapability join + optimistic skip on SUCCESS + windowed dedupe per StageKey.
3. `createOrchestrationRun(wsId,input)` → idempotency UQ check first: throws code `ALREADY_COMPLETED` if matching SUCCESS already row-exists.
4. `markOrchestrationRunRunning(wsId,runId)` → optimistic UPDATE WHERE Status IN ('QUEUED','RETRY'); else `OPTIMISTIC_LOCK`.
5. `completeOrchestrationRunSuccess(wsId,runId,result)` → SUCCESS + CompletedAt + ResultJson.
6. `completeOrchestrationRunFail(wsId,runId,err,maxRetries)` → `attempt < maxRetries ? RETRY : DEAD_LETTER` + exponential backoff 2^(attempt-1)·5s cap 10 min + ErrorMessage 2000 NVARCHAR + ResultJson dump.
7. `recordRunEvent(wsId,runId,eventType,severity,detail,actor)` → one event row per START/GATE_PASS/COMPLETE/FAIL/SCHEDULED/BOOT_RECOVERY/RESCUE/DERIVATIVE.
8. `listOrchestrationOverview(wsId)` → status aggregates (8 bins) + last heartbeat + 50 dead-letter rows (used by `/admin/runs` rescue card, `/admin/operations` 5th StatCard).
9. `listProjectOrchestrationRuns(wsId,projectId)` → per-project ledger with StageName + event counts.
10. `getOrchestrationRunDetail(wsId,runId)` → run + 500 events, reverse chron.
11. `rescueOrchestrationDeadLetter(wsId,runId,actorUserId)` → **ONLY flips DEAD_LETTER → RETRY**. Actor recorded as `ADMIN_HUMAN` with RESCUE event. Audits via writeAudit 'ORCH_RUN_RESCUED'.
12. `bootRecoveryCleanup(wsId)` → updates RUNNING rows whose heartbeat lapsed > 3·poll_interval_ms to RETRY with RESCUE audit event — at-least-once correctness after process crash / deploy restart.

### Engine table-driven dispatch (`orchestrator.ts`)
- `createOrchestrationEngine(server,db,_rp)` → `await firstMemberWorkspaceId()` via bootstrap admin email + `bootstrapUserId()` (BOOTSTRAP_ADMIN_EMAIL) to establish the autonomous actor.
- `refreshBootstrap()` on every poll interval (settings drift-free).
- `passGovernanceGates(cap,stage)` checks before every repo call:
  - Active AUTONOMOUS agent row matching `AgentCapability` (fallback: any AUTONOMOUS+IsActive agent) → else `GATE_NO_ACTIVE_AGENT`.
  - At least 1 CONNECTED provider → else `GATE_NO_CONNECTED_PROVIDER`.
  - No budget row breached `SpentAmount >= BudgetAmount · (HardStopPercent/100)` (read from M14 ProviderBudgets via getAdminOperations.budgets) → else `GATE_BUDGET_HARD_LIMIT`.
- `adapters` Map: AgentCapabilityMap.RepositoryFunction string → `adapter(projectId,ctx,payload)` Promise. Each adapter first looks up any child IDs (scriptConceptId, generationAssetId, thumbnailVariantId, packagingVersionId, releaseCheckId, learningInsightId, feedbackId, recyclingPlanId, publishJobId), then calls the matching repo export with correct arity. New stage = one adapter function + one AgentCapabilityMap row + zero engine.ts edits.
- `pollOnce()` pipeline per row: createRun → optimistic markRunning → START event → GATE_PASS event → adapter execute → SUCCESS + COMPLETE event OR FAIL + RETRY/DEAD_LETTER.
- Closed loop (FR-8 / AC-1):
  1. On `registerPublication` adapter SUCCESS → `runClosedLoopPublication` enqueues 4 future `PERFORMANCE_SNAPSHOT_1H/6H/24H/48H` runs with NextPollAt offsets from PublishedAt.
  2. On 24H / 48H PerformanceSnapshot SUCCESS → `runClosedLoopLearning` enqueues LEARNING_INSIGHT_DECIDE + LEARNING_FEEDBACK_APPLY.
  3. On LEARNING_FEEDBACK_APPLY SUCCESS → `runClosedLoopRecycling` enqueues RECYCLING_DECIDE + calls `createContentProject(parentId=original, formatType=SHORTFORM)` derivative when original format != SHORTFORM.
- Graceful degradation: engine boot never aborts API listen; any init exception emits `log.warn` and API continues (read-only).
- Heartbeat MERGE executed every poll interval inside `beat()`.

### HTTP API surface (5 new endpoints, inserted right before `const port`)
1. `GET /api/orchestration/overview` → `listOrchestrationOverview` (Run Ledger stat grid, Operations dead-letter stat).
2. `GET /api/projects/:projectId/runs` → per-project ledger (`listProjectOrchestrationRuns`).
3. `GET /api/orchestration/runs/:runId` → detail + events.
4. `POST /api/orchestration/runs/:runId/retry` → `rescueOrchestrationDeadLetter` + 202 Accepted + Audit. Admin-only rescue boundary.
5. `POST /api/orchestration/seed` → optional {projectId,stageKey,capability}; else bootstrap a new AUTONOMOUS demo content project, enqueue STRATEGY_BRIEF → returns 202 + {projectId,run}.

### Admin surfaces (Platform Administration only; zero new PRODUCTION PIPELINE pages per boundary)
- `/admin/runs` page (new under AI & AUTOMATION nav group, 5th slot "Run Ledger", icon ⟳): 4-stat grid (worker health, 30d runs, success rate, dead-letter count) + Dead-letter rescue card + Orchestration ledger DataTable + events list.
- `/admin/workflows`: Each stage row appends a "Latest Run" column (updated time + last status badge).
- `/admin/operations`: 5th dead-letter StatCard "Orchestration dead-letters" with tone danger and rescue CTA.

### Health, smoke, versioning
- `/health` now returns `version:'0.15.0'`, `module15:'ready'`.
- `smoke-test.ts` line 15: Module 15 contracts.
- Migration filename: `017_module15_autonomous_orchestration.sql`.

## NFRs
- **Robustness (NFR-3)**: at-least-once + boot recovery orphans + exponential backoff (cap 10 min, max_retries=3) + DEAD_LETTER filtered index + RunEvent audit stream + MERGE heartbeat. Wrap every repository mutation inside the engine error boundary.
- **Future-ready (NFR-4)**: Every threshold/time-out/concurrency/approval-cutoff = `SystemSettings` row. New stage = one row in `AgentCapabilityMap` + one adapter export + zero changes to engine loop. 49 pre-mapped handoffs cover the entire 10-stage production and closed-loop learning/recycling/derivatives. Flexible-schema `PayloadJson/ResultJson` permit versioned payloads.
- **Security (NFR-2)**: Rescue endpoint accepts only DEAD_LETTER rows; rescue actor is always HUMAN (never orchestrator). All gate checks + budget enforcement run BEFORE any AI spend.

## SLA / RPO / RTO
- **RPO**: 0 committed-loss — every poll step is persistent; boot recovery flips stale RUNNING → RETRY.
- **RTO**: 3·poll_interval_ms (default 15 s) after restart before recovery sweep completes and new poll picks up.
- **SLA**: SlaDueAt calculated from ProjectStageExecutions.DueAt, default multiplier in SystemSettings. Breaches raised via NotificationPolicies ORCH_SLA_BREACH.

## Governance & human-boundary map
| Can a human intervene here? | Location |
| --- | --- |
| Start / stop servers | `pnpm dev` or double-click `START-CACSMS.bat` |
| Agent subscriptions, API keys, billing, plans | `/admin/agents` · `/admin/integrations/+ai` · `/admin/integrations/+platforms` · `/admin/costs` |
| Governance & Security 7 pages | `/admin/{users,roles,audit,notification-rules,security,backup,settings}` |
| Operations admin (incl. Health, Assets, rescue via Run Ledger) | `/admin/operations` · `/admin/runs` · `/admin/health` · `/admin/assets` |
| Platform admin: Workflow publish, Agent fleet config | `/admin/workflows` · `/admin/agents` |
| Production pipeline stage 01 → stage last save/submit/decide/complete/register | ❌ Not allowed; runs autonomously. Only via DEAD_LETTER → `/admin/runs` Rescue. |
