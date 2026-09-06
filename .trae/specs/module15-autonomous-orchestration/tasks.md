# Module 15 — Autonomous End-to-End Production Orchestration (Implementation Plan)

## Task 1: Database — Module 15 migration + bootstrap + package script slot
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Create `packages/database/sql/migrations/017_module15_autonomous_orchestration.sql` (renumbered after M14's 016; 001…016 immutable byte-perfect preserved). Idempotent `IF OBJECT_ID(N'dbo.TableName','U') IS NULL` DDL for:
    1. `OrchestrationRuns` — RunId PK, WorkspaceId, ProjectId, WorkflowVersionNo, StageKey NVARCHAR(64), TriggeredBy NVARCHAR(64) default 'ORCHESTRATOR_v15', PayloadJson NVARCHAR(MAX), ResultJson NVARCHAR(MAX), Status NVARCHAR(32) (QUEUED/RUNNING/SUCCESS/FAIL/RETRY/DEAD_LETTER/CANCELLED), AttemptNo INT default 1, MaxRetries INT, NextPollAt DATETIME2, SlaDueAt DATETIME2, StartedAt DATETIME2, CompletedAt DATETIME2, ErrorMessage NVARCHAR(2000), UQ (WorkspaceId, ProjectId, StageKey, WorkflowVersionNo) idempotency key.
    2. `OrchestrationRunEvents` — RunEventId PK, RunId FK → Runs, EventType NVARCHAR(32), Severity NVARCHAR(16) (INFO/WARNING/ERROR/CRITICAL), EventAt DATETIME2, DetailJson NVARCHAR(MAX), Actor NVARCHAR(64).
    3. `OrchestratorHeartbeats` — WorkerId NVARCHAR(64) PK, StartedAt DATETIME2, LastHeartbeat DATETIME2, PollCount BIGINT, ProcessId INT, MachineName NVARCHAR(200), Status NVARCHAR(16) (RUNNING/PAUSED/STOPPED/DEGRADED).
    4. AgentCapabilityMap — (AgentCapability, RepositoryFunction, DefaultPayloadJson) UQ(AgentCapability) — Stage→repository function convention lookup table (no switch/case in engine).
  - 5 indexes: `IX_OrchestrationRuns_Workspace_Project_Status` (stage dispatch polling), `IX_OrchestrationRuns_Stage_Status_NextPoll` (per-stage scheduling), `IX_OrchestrationRuns_Status_DeadLetter` (admin dead-letter tile), `IX_OrchestrationRunEvents_RunId_EventAt` (full audit log), `IX_OrchestratorHeartbeats_LastHeartbeat` (worker liveness).
  - Create `packages/database/src/bootstrap-module15.ts`: 4 MERGE bootstrap inserts — (a) AgentCapabilityMap 21 rows mapping each stage key → repository function + default payloads sourced from module14-data.workflows + moduleNN-data fixtures; (b) default SystemSettings 7 key/value rows (orchestrator.enabled, orchestrator.poll_interval_ms=5000, orchestrator.concurrency=1, orchestrator.learning_approval_threshold=85, orchestrator.recycling_approval_priority=HIGH, orchestrator.default_sla_multiplier=1.0, orchestrator.boot_recovery=true); (c) NotificationPolicy auto-wire rows for each stage FAIL severity; (d) one OrchestratorHeartbeats bootstrap row WorkerId='api-main' for current single-worker mode.
  - Edit `packages/database/package.json` insert new `db:bootstrap-module15` npm script slot at L39 (after `db:bootstrap-module14` at L38 — existing bootstrap 01-14 untouched).
- **Acceptance Criteria Addressed**: AC-1 (wiring), AC-2 (budget gate FAIL event writes to Runs), AC-3 (UQ idempotency), AC-4 (NextPollAt + AttemptNo columns), AC-8 (boot recovery via Heartbeats + RUNNING cleanup)
- **Test Requirements**:
  - `rule` TR-1.1: Running the new sql migration against target DB 2x in sequence produces no DDL errors both runs (idempotent OBJECT_ID checks). Evidence: `sqlcmd -i 017_…` twice each exit 0.
  - `rule` TR-1.2: `pnpm --filter @cacsms/database db:bootstrap-module15` exits 0 and produces MERGE 21 capability rows + 7 settings rows + 4 policies + 1 heartbeat rows. Evidence: bootstrap run stdout + post-count SELECT queries returning exact counts.
  - `rubric` TR-1.3: Dimension: Schema evolvability. Scale 1-5. 1=fixed columns, every new field needs ALTER; 3=PayloadJson/ResultJson flexible + some indexed columns; 5=All indexed query surfaces (status/project/stage/nextpoll) are explicit typed columns AND all extensible content lives in JSON columns (no schema migration needed to add severity levels or event payload fields). Threshold >=4. Evidence: Schema DDL inspection.
- **Notes**: Preserve byte-perfect migrations 001…016; NEVER edit existing migration files. Migration filename strictly `017_module15_autonomous_orchestration.sql`.

## Task 2: Repository layer — Module 15 exports (ledger + dispatch helpers) appended to repository.ts tail after recordServiceHealth
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - Append to `apps/api/src/repository.ts` after existing L238 `recordServiceHealth` (previous M14 exports) — a blank line + comment `// Module 15 — Autonomous End-to-End Orchestration` + 12 new exported functions (all use `.recordset` per-query destructuring; never Promise.all tuple index TS7053):
    1. `getOrchestratorBootstrap` — 6 parallel queries: heartbeats, settings, capabilities, default policies, notification-policies, active workflow version (reads state for engine boot).
    2. `pollReadyStages` — Single query batch for workspace: returns stages with (a) status NOT_STARTED/IN_PROGRESS_AWAITING_UPSTREAM OR FAIL+AttemptNo<MaxRetries AND NextPollAt<=SYSUTCDATETIME, (b) ALL prerequisite handoffs exist AND Status COMPLETED, (c) governance agent active, provider connected, budget below hard-limit. Joins handoffs, stage executions, workflows, agents, budgets, providers. 1 result set per-project batch. Uses `ROW_NUMBER() OVER (PARTITION BY StageKey ORDER BY priority)` de-dupe.
    3. `createOrchestrationRun` — Insert into `OrchestrationRuns` returning RunId + AttemptNo. Honors UQ: if the (project, stage, active version) already has a SUCCESS row → throw 409 ALREADY_COMPLETED idempotency error instead of duplicate (callee catches and skips).
    4. `markOrchestrationRunRunning` — UPDATE row: set Status=RUNNING, StartedAt=SYSUTCDATETIME; optimistic concurrency: `WHERE RunId=@runId AND Status IN (QUEUED, RETRY)`.
    5. `completeOrchestrationRunSuccess` — UPDATE Status=SUCCESS, CompletedAt=SYSUTCDATETIME, ResultJson, AttemptNo preserved.
    6. `completeOrchestrationRunFail` — UPDATE Status = CASE WHEN AttemptNo < MaxRetries THEN RETRY ELSE DEAD_LETTER END, AttemptNo += 1, NextPollAt = exponential backoff, ErrorMessage, ResultJson, SlaDueAt checks overshoots.
    7. `recordRunEvent` — INSERT into `OrchestrationRunEvents` (INFO/WARN/ERROR severity).
    8. `listOrchestrationOverview` — Aggregate: queue/running/success/fail/retry/dead_letter counts, last heartbeat, next poll due at, dead-letter RunId list.
    9. `listProjectOrchestrationRuns` — Run rows + event counts per (project) latest first; JOIN stage names from WorkflowStageDefinitions.
    10. `getOrchestrationRunDetail` — Single run: full payload + result + events ordered by EventAt.
    11. `rescueOrchestrationDeadLetter` — UPDATE Status=RETRY, AttemptNo (preserve current, next dispatch increments), NextPollAt = SYSUTCDATETIME. INSERT RESCUE event with actor=HUMAN since rescue is admin-only human intervention (boundary rule).
    12. `bootRecoveryCleanup` — On API boot: flip orphan RUNNING rows (where heartbeat LAST_HEARTBEAT > 3×poll_interval) → RETRY status with boot recovery event.
- **Acceptance Criteria Addressed**: AC-1 (dispatch/poll logic), AC-2 (provider budget join), AC-3 (createOrchestrationRun UQ throw), AC-4 (fail retry update), AC-8 (bootRecoveryCleanup + orphan rescue)
- **Test Requirements**:
  - `rule` TR-2.1: `pnpm -r typecheck` exit 0 after append. Evidence: command exit 0.
  - `rule` TR-2.2: Creating two identical runs for (project, stage, version) throws 409 second time (no duplicate SUCCESS). Evidence: unit test `repo-create-run.spec.ts` calls create twice, asserts second rejects.
  - `rule` TR-2.3: bootRecoveryCleanup updates one orphan RUNNING → RETRY and emits 1 BOOT_RECOVERY event. Evidence: 1 row seed + call function → status flips + event count=1.

## Task 3: Engine — apps/api/src/orchestrator.ts (pure engine, decoupled from stage names: agent capability table-driven dispatch)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - New file `apps/api/src/orchestrator.ts`. Default export `createOrchestrationEngine(server, db, repoFactory)`:
    - Registers decorator `server.decorate('orchestrator', engine)`.
    - Boot sequence (on listen): (a) `repo.bootRecoveryCleanup()` → (b) write RUNNING heartbeat with WorkerId='api-main', ProcessId=process.pid, MachineName=os.hostname() → (c) read SystemSettings via `getOrchestratorBootstrap` → (d) start `setInterval(pollOnce, settings.poll_interval_ms)` (clearInterval on server close for graceful shutdown).
    - `pollOnce()` body:
      1. Heartbeat tick → update LastHeartbeat, PollCount+=1.
      2. `pollReadyStages()` → row batch (max N = concurrency setting default 1).
      3. For each ready stage row, `dispatch(row)` inside try/catch + DB transaction:
         - CreateOrchestrationRun → markRunning → **dispatch via convention**: read row.AgentCapability → AgentCapabilityMap.RepositoryFunction string → use `repo[functionName](...DefaultPayloadJson fields mapped onto repository call arguments)` using an explicit safe-dispatch registry of allowed function signatures (11 dispatch adapter functions covering every M04–M13 save/submit/decide/complete — small adapters map payload json → positional args). **No switch/case on stage names.**
         - On success: completeOrchestrationRunSuccess → INFO event.
         - On catch: completeOrchestrationRunFail → ERROR/CRITICAL event; if DEAD_LETTER also triggers notification dispatch via M14 `saveNotificationPolicy` rules match severity.
         - Governance gating (inside dispatch before repo call): read M14 getAdminOperations aggregates; agent IsActive/mode=AUTONOMOUS check; for M09 generation also providerStatus==CONNECTED + HardBudget < spent check; any gate fails → immediate FAIL with reason.
    - Closed-loop (FR-8): After SUCCESS `registerPublication`, engine schedules 4 PerformanceSnapshot calls by writing 4 future NextPollAt QUEUED events for ingestion windows (1h/6h/24h/48h offset from PublishedAt using datetime arithmetic). After SNAPSHOT event success → engine calls `decideLearningInsight` with APPROVE iff confidence >= threshold (from settings) → `applyLearningFeedback`; then `decideContentRecyclingPlan` APPROVE priority >= HIGH → on APPROVED call `createContentProject` derivative (parent_id = original project id, type SHORTFORM from recycling manifest).
- **Acceptance Criteria Addressed**: AC-1 (loop + closed loop), AC-2 (generation budget gate), AC-3 (run idempotency via createRun throw skip), AC-4 (retry/backoff/DEAD_LETTER), AC-7 (no stage-name switch/case — table-driven capability dispatch), AC-8 (boot recovery, transaction wrap, rescue endpoint path)
- **Test Requirements**:
  - `rule` TR-3.1: Engine boot + 1 cycle completes with 0 crashes + heartbeat LastHeartbeat updated. Evidence: `engine-boot.spec.ts` 5-second test, reads heartbeats row LastHeartbeat > StartedAt.
  - `rule` TR-3.2: Table-driven dispatch. Evidence: `grep -cE 'switch \(.*Stage\)|case .*_STAGE' apps/api/src/orchestrator.ts | Select-String -Quiet` returns FALSE (zero stage-name branches).
  - `rubric` TR-3.3: Dimension: Future-readiness / adding new stage. Scale 1-5. 1=requires editing 6 files; 3=requires editing 2 files (engine + repo); 5=requires inserting 1 AgentCapabilityMap row + one new repository export and zero engine edits. Threshold >=4. Evidence: static analysis add-stage change checklist.

## Task 4: Server.ts integration + Module 15 endpoints + health v0.15.0 module15=ready + smoke line #15
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - Edit `apps/api/src/server.ts` 4 points (surgical edits, no rewrite):
    1. L2 imports — add Module 15 repository export names (`getOrchestratorBootstrap, pollReadyStages, createOrchestrationRun, markOrchestrationRunRunning, … rescueOrchestrationDeadLetter, bootRecoveryCleanup`) 12 names total.
    2. Add `import createOrchestrationEngine from './orchestrator';` after the repository import line.
    3. L5 health object literal — bump version to `"0.15.0"` and add `module15:'ready'` (after existing module14). Existing module01..module14 untouched.
    4. Insert Module 15 endpoint block BEFORE `const port =` line (after existing M14 endpoints block L139-L150). 5 new routes — all use server-level auth pattern (mirror M14 admin routes — fastify hook verifies workspace context):
       - `GET /api/orchestration/overview` → calls `listOrchestrationOverview` → json aggregate
       - `GET /api/orchestration/projects/:projectId/runs` → `listProjectOrchestrationRuns(projectId)` → array
       - `GET /api/orchestration/runs/:runId` → `getOrchestrationRunDetail(runId)` → object
       - `POST /api/orchestration/runs/:runId/retry` → `rescueOrchestrationDeadLetter(runId)` → `{ok:true, status:'RETRY'}` (admin-only; human-rescue DEAD_LETTER boundary check: old status must be DEAD_LETTER else 400)
       - `POST /api/orchestration/projects/:projectId/seed` → idempotent seed: if no runs exist for project, insert initial QUEUED seed for STRATEGY_BRIEF stage with PayloadJson defaults from module04-data.
  - After `const app = await fastify.listen(...)` line: call `createOrchestrationEngine(app, await getDb(), repository)` to start the engine polling.
  - Edit `apps/api/src/smoke-test.ts`: append **15th line** to stdout: `console.log('Module 15 API contracts: autonomous orchestration run ledger, stage dispatch, governance gating, retry/backoff, publication→analytics closed-loop, dead-letter rescue endpoints.')` (total 15 lines after append — module01→15 each exactly 1 line).
- **Acceptance Criteria Addressed**: AC-1 (start seed endpoint), AC-5 (v0.15.0 module15 + smoke 15 lines), AC-6 (observability endpoints HTTP 200)
- **Test Requirements**:
  - `rule` TR-4.1: `pnpm -r typecheck` exit 0 + `pnpm -r build` exit 0. Evidence: command outputs.
  - `rule` TR-4.2: `node apps/api/dist/smoke-test.js` stdout = EXACTLY 15 lines (captured wc -l equivalent). Evidence: PS `Measure-Object -Line` returning Lines=15.
  - `rule` TR-4.3: GET /health body JSON includes `{"version":"0.15.0","module15":"ready"}` + 14 earlier module keys present. Evidence: `curl http://127.0.0.1:4000/health | jq '. | {version, module15, module14}'`

## Task 5: Web Admin observability views — /admin/workflows RunEvents column + /admin/operations dead-letter tile + new /admin/runs run ledger page (new page under AI&AUTOMATION)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4
- **Description**:
  - Edit `apps/web/src/components/app-shell.tsx` — AI&AUTOMATION sidebar group (currently 4 items: operations/agents/workflows/integrations) insert 5th new item AFTER workflows: `Run Ledger` with href=`/admin/runs` icon `⟳` (group expands to 5 items). Do NOT touch any other nav groups; PRODUCTION PIPELINE 10 slots verbatim untouched.
  - Create `apps/web/src/app/(app)/admin/runs/page.tsx` (new static page — no brackets): AdminTabs 12-link pill, stat cards (Queue/Running/Success/Fail/Retry/Dead-letter 6 tiles), enterprise-table of latest run rows per project (RunId, Stage, Attempt, Status pill, NextPollAt, Sla, ErrorMessage — Status tone map SUCCESS=green/RETRY=blue/DEAD_LETTER=red/RUNNING=purple/FAIL=amber), search-inline box.
  - Edit `/admin/workflows/page.tsx` (M14 existing page: workflow-admin-list 21 stages grid) add rightmost new column `Latest Run` showing the latest run Status pill for each (stage, project) using enterprise-table code cell pattern; DEAD_LETTER badges link to /admin/runs.
  - Edit `/admin/operations/page.tsx` (M14 overview page 4 stat cards + admin-map): add stat #5 card (Dead Letters) alongside the other 4; if count >0 render red tone pill + direct link `/admin/runs?status=DEAD_LETTER`.
  - Sidebar foot chip untouched. `globals.css` not required to modify (existing enterprise-table, search-inline, admin-map classes already present M14).
- **Acceptance Criteria Addressed**: AC-6 (HTTP 200 for new routes), NFR-6 (UI auditability)
- **Test Requirements**:
  - `rule` TR-5.1: `pnpm -r build` exit 0 AND Next.js build emits route `/admin/runs` alongside existing 16 admin routes. Evidence: build output "○ /admin/runs" line present.
  - `rule` TR-5.2: HTTP probe for /admin/runs, /admin/operations, /admin/workflows all answer HTTP 200 after build. Evidence: Invoke-WebRequest status 200 for 3 URLs.

## Task 6: Module 15 docs README + integration verification gates (typecheck/build/grep/plurals/smoke/HTTP probes 25+5 new = 30 total zero regressions) independent review checkpoints pass — TODO review details come in review.md
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 1–5 all completed
- **Description**:
  - Overwrite `docs/modules/15-autonomous-orchestration/README.md` placeholder (create placeholder first if doesn't exist): isomorphic docs = 4 new tables (OrchestrationRuns schema + 7 columns index inventory; 5 new API endpoints table METHOD PATH DESC; 21 stage capability map entries with agent owners → repository function mapping table; 6 engine admin observability page list with 3 side-nav group memberships). Upstream: M14 Admin governance feeds (agent/budgets/policies/integrations/settings) DOWNSTREAM gate M15 dispatch. Downstream: Closed-loop analytics feedback creates M05/M04 derivative projects for recycling. RPO/RTO for runs (RPO=poll interval, RTO=boot recovery pass).
  - VERIFICATION GATES (T5 style — all must PASS before proceeding to Review):
    1. `pnpm -r typecheck` → exit 0 (6 packages)
    2. `pnpm -r build` → exit 0 (web + api)
    3. Plurals grep restricted globs (exclude immutables M03-06 + spec dir): 0 hits on Module 15 new files
    4. `node apps/api/dist/smoke-test.js` → stdout line count EXACTLY 15
    5. Kill ports 4000/3000 → re-start servers → 30 HTTP probes (1 health v0.15.0 module15=ready; 16 existing admin routes + new /admin/runs = 17 admin routes; 9 pipeline regressions; 4 orchestration API endpoints overview/projects/runs/retry) → ALL 30 HTTP 200 zero regressions.
- **Acceptance Criteria Addressed**: AC-5, AC-6, NFR-2 backwards compatibility; feed directly into Review checkpoints
- **Test Requirements**:
  - `rule` TR-6.1: 5 gates above all exit/pass. Evidence: each gate stdout captured.
  - `rubric` TR-6.2: Dimension: documentation completeness. Scale 1-5. 1=no README / missing tables; 3=README covers endpoints but skips table/index inventory and up/downstream; 5=4 required tables ALL present + upstream/downstream handoff diagram rows + RPO/RTO rows. Threshold >=4. Evidence: static README heading count & table review.

## Task 7: (Review-only later — will fill after implement queue drains) Independent R1 review run with sub-agent read-only fresh context; actionable findings → issues I-1..I-N created in tasks.md before re-entering Implement.
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 6 completed (queue fully drained all completed)
- **Description**: Delegate to fresh review agent (read-only): paths = spec.md/tasks.md/3 source files/server/orchestrator/repository/new admin pages/migration 017. Output result pass/fail/blocked. Fail → each finding becomes Issue with TRs. Pass → proceed commit. AC coverage: every AC must have independent evidence.
- **Acceptance Criteria Addressed**: All ACs (final gate)
- **Test Requirements**:
  - `rule` TR-7.1: Fresh review agent concludes `pass`. Evidence: review.md R1 Result=pass, zero actionable findings.
  - `rubric` TR-7.2: Dimension: workflow fidelity (spec mode rules). Scale 0-2: 2=all 5 phases ok; 1=one minor boundary; 0=phases skipped or review independence broken. Threshold >=2. Evidence: artifacts chronological order checkpoints.

## Task 8: Git exact commit message feat: integrate Module 15 (Autonomous End-to-End Orchestration) + push origin main FAST-FORWARD
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 7 passes (Review Result = pass)
- **Description**: git status short → git add -A → git commit -m "feat: integrate Module 15 (Autonomous End-to-End Orchestration)" (EXACT quotes, no trailing period, same format M04..M14). Then `git push origin main` fast-forward (NEVER --force). Verify: terminal shows `0ac09b5..XXXXXXXX  main -> main`.
- **Acceptance Criteria Addressed**: All ACs delivered permanently to main
- **Test Requirements**:
  - `rule` TR-8.1: Commit message EXACTLY matches required string. Evidence: `git log -1 --pretty=%s | Select-String -Quiet -SimpleMatch "feat: integrate Module 15 (Autonomous End-to-End Orchestration)"`.
  - `rule` TR-8.2: Push result shows fast-forward range, no rejection. Evidence: terminal push output contains `main -> main` and no `[rejected] / --force` lines.
