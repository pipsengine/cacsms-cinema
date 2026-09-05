# Module 02 — Command Center

Real-time operational control plane for the Cacsms Cinema autonomous content studio. Aggregates production status, approvals, agent telemetry, exceptions, personal work queues, and publishing calendar into a single live surface. Safe to browse with `NEXT_PUBLIC_DEMO_MODE=true` even when MSSQL is absent (all pages ship rich static fallbacks via `@/lib/module02-data.ts`).

## Database

**Migration:** `packages/database/sql/migrations/003_module02_command_center.sql`

Idempotent `IF OBJECT_ID IS NULL` DDL introducing 8 tables and 8 supporting indexes + check constraints:

| Table                          | Purpose / keys                                                                 |
|--------------------------------|--------------------------------------------------------------------------------|
| `WorkflowStageDefinitions`     | 22-stage catalog (StageKey + StageOrder unique), PhaseName, IsHumanGate flag.  |
| `ProjectStageExecutions`       | UQ(ContentProjectId, WorkflowStageDefinitionId); Status CK enum 8 values; Progress CK 0..100; IX on project+status. |
| `ProjectControlEvents`         | Action CK {START, PAUSE, RESUME, STOP, RESTART}; IX project + created DESC.    |
| `WorkItems`                    | Priority CK {LOW, MEDIUM, HIGH, URGENT}; Status CK 5 values; IX assignee+status+due. |
| `Notifications`                | Severity CK {INFO, SUCCESS, WARNING, CRITICAL}; IX user + unread + created.    |
| `AgentRuns`                    | Status CK 6 values + Progress CK; IX workspace + status + updated DESC.        |
| `GenerationUsage`              | IX workspace + created DESC.                                                  |
| `PublishingSchedule`           | Status CK {DRAFT, SCHEDULED, PUBLISHING, PUBLISHED, FAILED, CANCELLED}; IX workspace + scheduled. |

**Seed:** `packages/database/sql/seeds/003_workflow_stages.sql`

MERGE on StageKey producing exactly 22 stages (StageOrder 1..22) across 7 phases. Two human gates (`IsHumanGate=1`):
- Stage 05 `CONCEPT_APPROVAL` (Creative Development, Module 07)
- Stage 18 `FINAL_APPROVAL` (Governance & Release, Module 12)

**Bootstrap demo data:** `packages/database/src/bootstrap-module02.ts`

Requires Module 01 bootstrap to have run (resolves bootstrap user + workspace `cacsms-cinema`). Populates:
- **5 ContentProjects** `CAC-2026-000120`…`124` (progress: 120 COMPLETED, 121 BLOCKED Fact Check, 122 PAUSED Video Gen, 123 AWAITING Final Approval, 124 IN_PROGRESS Image Gen 48%)
- **22 ProjectStageExecutions rows / project** with status + progress alignment
- **4 WorkItems** (URGENT approval, HIGH exception, HIGH image review, MEDIUM provider decision)
- **3 Notifications** (CRITICAL workflow blocked · WARNING approval waiting · INFO image batch completed)
- **5 AgentRuns** incl 2 RUNNING, 1 WAITING, 1 FAILED fact-agent, 1 ONLINE analytics
- **86 GenerationUsage rows** (64 image @ $0.08, 22 video @ $0.60 → $18.42 month)
- **3 PublishingSchedule** slots (06 Sep YT 123, 08 Sep YT 124, 09 Sep SHORTS 122 at-risk)

Run with: `pnpm --filter @cacsms/database db:bootstrap-module02`

## API endpoints (apps/api/src/server.ts — version 0.3.0)

7 Module 02 endpoints added to the 10 Module 01 routes (17 total).

| Method | Path                                                 | Contract                                                                |
|--------|------------------------------------------------------|-------------------------------------------------------------------------|
| GET    | `/health`                                            | `{status:ok, service:cacsms-cinema-api, version:0.3.0, module01:ready, module02:ready}` |
| GET    | `/api/command-center`                                | Workspace required (409). Returns `{summary, projects, tasks, notifications, agents, schedule, usage}`. |
| GET    | `/api/command-center/projects/:projectId/stages`     | Zod uuid param → 22 stage rows with progress, started/paused/completed. |
| POST   | `/api/command-center/projects/:projectId/control`    | Zod body `{action: START|PAUSE|RESUME|STOP|RESTART, reason?: ≤1000}`. Transactional UPDLOCK → allowed transition validation → writes ProjectControlEvents + audit PROJECT_${action}. Returns `{projectId, previousStatus, status, action}`. |
| GET    | `/api/my-work`                                       | Open/in-progress work list for the user + workspace.                   |
| PATCH  | `/api/my-work/:workItemId`                           | Zod body `{status: OPEN|IN_PROGRESS|WAITING|COMPLETED|CANCELLED}`; OUTPUT UPDATE. |
| GET    | `/api/notifications`                                 | Notifications ordered by CreatedAt DESC.                               |
| PATCH  | `/api/notifications/:notificationId`                 | Zod body `{read: boolean}`. Per-card mark-unread toggle.               |

Security properties unchanged from Module 01: Zod parses every body and uuid param; cookie `cacsms_session` is httpOnly + lax + 8h; 5xx errors return generic `Internal server error`; bcrypt cost remains 12 in `auth.ts`; every database import uses the `@cacsms/database` workspace alias.

Smoke test: `pnpm --filter @cacsms/api test` prints both module contracts.

## Web routes (Next.js App Router, route group `(app)`)

AppShell sidebar now exposes 4 nav groups: COMMAND (3 live), CONTENT OPERATIONS (3 future), PRODUCTION PIPELINE (9 future soon-chips), ADMINISTRATION (2 live, 2 future). Topbar carries a `＋ Create` quick-action button, search with ⌘K kbd hint, and a notifications icon (♢) with unread badge.

| Route               | Page (file)                                              | Purpose                                                                                                          |
|---------------------|----------------------------------------------------------|------------------------------------------------------------------------------------------------------------------|
| `/command`          | `apps/web/src/app/(app)/command/page.tsx`                | LIVE indicator · 6 KPIs (total projects / active prod / awaiting approval / exceptions / 86 generations today / 3 scheduled) · 2-column board: Production pipeline (pipeline/list segmented, 5 projects with Start/Pause/Resume/Stop controls) + My Work list · 3-card thirds: AI Agent Activity / Notifications / Publishing Schedule · Health strip (6 systems) · ProjectDrawer with 22-stage timeline + control bar + summary. |
| `/my-work`          | `apps/web/src/app/(app)/my-work/page.tsx`                | 4-summary (Open / In-progress / Waiting / Completed) · 5-tab segmented filter (ALL / OPEN / IN_PROGRESS / WAITING / COMPLETED) · Priority + Due Date filter buttons · 6-column work table with type icon · Optimistic "✓ Complete" action PATCHes `/api/my-work/:id`. |
| `/notifications`    | `apps/web/src/app/(app)/notifications/page.tsx`          | 7 inbox filters (ALL · UNREAD <em> count</em> · WORKFLOW · APPROVAL · GENERATION · PUBLISHING · SECURITY) · Delivery settings aside · Newest-first feed · CRITICAL=! / SUCCESS=✓ / else=i severity symbols · Mark-all-as-read global action · Per-card Open → / Mark read toggle · Empty state. |

All pages render via `@/lib/module02-data.ts` fallbacks when `apiFetch` cannot reach the API, so `NEXT_PUBLIC_DEMO_MODE=true` preserves full screen richness without MSSQL.

## Inventory

- **New pages:** 3 (command, my-work, notifications)
- **New lib files:** 2 ([module02-data.ts](file:///c:/Trading-Engine/cacsms-cinema/apps/web/src/lib/module02-data.ts), [api.ts](file:///c:/Trading-Engine/cacsms-cinema/apps/web/src/lib/api.ts))
- **New types file:** 1 ([workflow.ts](file:///c:/Trading-Engine/cacsms-cinema/packages/types/src/workflow.ts)) — WorkflowStatus union + StageHandoff interface
- **New DB files:** migration 003, seed 003, bootstrap-module02
- **AppShell navigation:** rebuilt from 3 groups (Module 01) to 4 groups (adding COMMAND + PRODUCTION PIPELINE)
- **globals.css extensions:** command/my-work/notification layout classes, segmented controls, progress/orb/drawer/stage/health/date-tile/priority-status styles, responsive reflow at ≤1300px and ≤760px.

## Scripts

```bash
pnpm install
pnpm -r build
pnpm --filter @cacsms/web dev                       # http://localhost:3000
pnpm --filter @cacsms/api dev                       # http://localhost:4000
pnpm --filter @cacsms/api test                      # smoke-test prints M01 + M02 contracts
pnpm --filter @cacsms/database db:bootstrap         # Module 01 identity + workspace seed
pnpm --filter @cacsms/database db:bootstrap-module02 # 5 projects, 22 stages, work/notes/agents/usage/schedule
```
