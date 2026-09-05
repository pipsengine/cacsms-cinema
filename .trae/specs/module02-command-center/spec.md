# Module 02 — Command Center (Operational Control Surface)

**Spec ID:** `module02-command-center`
**Repository root:** `c:\Trading-Engine\cacsms-cinema`
**Source module path (authoritative):** `C:\Users\Cacsms Limited\Downloads\cacsms-cinemas-module02\cacsms-cinemas`
**Target brand & namespace conventions (bindings that win over source):**
- Package names: `@cacsms/*` (source references `@cacsms-cinemas/*` must be rewritten; no legacy `@acg/*` tokens may remain).
- Brand strings: **Cacsms Cinema** (singular "Cinema"; source contains plural "Cacsms Cinemas" to replace everywhere — app-shell brand, workspace card, copyright footers, breadcrumbs, eyebrow, `module02-data.ts` workspaces array if touched).
- Bootstrap workspace slug: `cacsms-cinema` (singular; source references plural slug if any must be normalized).
- MSSQL database name: `CacsmsCinema`.
- API service identifier: `cacsms-cinema-api`.
- JWT issuer / cookie: `cacsms-cinema` / `cacsms_session`.

> Open Question #1 (resolved by binding above): User wrote "implement module 03" but the provided source path is `…cacsms-cinemas-module02/…`. **Scope is Module 02 Command Center** because the source filesystem path is the user's authoritative attachment point. Future Module 03 (Content Projects) will consume the 03-content-projects module once provided. This OQ is marked [x] by choosing the path as anchor.

## 1. Problem / Users / Goals

### Problem
Module 01 delivered identity, workspace selection, and RBAC administration but left the actual "what is happening in production right now" surface blank. Studio operators (Super Admins, Producers, Editors) need a single real-time control plane that aggregates content projects across their 22-stage lifecycle, personal decision queues, agent telemetry, exceptions, and publishing schedule — with safe human start/pause/resume/stop controls over each project workflow.

### Users
| User               | Primary tasks in this module                                                       |
|--------------------|-------------------------------------------------------------------------------------|
| Super Admin        | Monitor all projects; act on approvals and exceptions; start/stop workflow runs.   |
| Producer / Owner   | Track work assigned to them in My Work; review notification alerts; open projects. |
| Editor / Reviewer  | Pull task queues; mark tasks complete; acknowledge workflow alerts.                 |
| Future AI Agents   | Read command center via APIs (current module surfaces endpoints only for humans).   |

### Goals
1. Expose a `/api/command-center` aggregate plus workflow/project-control, `/api/my-work` CR, and `/api/notifications` CR API endpoints on top of a new idempotent Module 02 schema.
2. Build a Command Center page with KPI row, production pipeline board with Start/Pause/Resume/Stop controls, drawer with 22-stage timeline, plus My Work and Notifications pages.
3. Extend the AppShell sidebar navigation with a COMMAND group and PRODUCTION PIPELINE group (future-flagged items), add `＋ Create` quick-action, notifications link with unread dot, and workspace breadcrumb/eyebrow.
4. Bootstrap demo data via `bootstrap-module02.ts` (5 ContentProjects + staged ProjectStageExecutions + WorkItems + Notifications + AgentRuns + GenerationUsage + PublishingSchedule) so the pages render rich data even when the API is unreachable from the web thanks to NEXT_PUBLIC_DEMO_MODE static fallbacks.
5. Keep security parity with Module 01: Zod body/param schemas, httpOnly cookies, bcrypt cost 12 unchanged, 5xx errors generic, no disallowed package imports.

### Non-goals
- Not implementing Content Projects module itself (module03 path in source docs is empty placeholder in this package, future work).
- No email/SMTP provider integration yet (forgot-password contract already returns safe acknowledgments).
- No agent runner or live video/image pipelines; AgentRuns are dashboard fixtures only.
- No new runtime dependencies beyond what the source module already declares (@fastify/*/bcryptjs/jsonwebtoken/zod already installed during Module 01; only new *files* added — no new packages beyond what's declared in source database/API package.json).

## 2. Functional Requirements

**FR-1 Workflow schema migration 003.**
Create `packages/database/sql/migrations/003_module02_command_center.sql` with idempotent `IF OBJECT_ID IS NULL` DDL that creates 8 tables and their FK + CHECK + indexes:
- WorkflowStageDefinitions (PK UQ StageKey + UQ StageOrder, UNIQUEIDENTIFIER default NEWSEQUENTIALID)
- ProjectStageExecutions UQ(ContentProjectId,WorkflowStageDefinitionId), CK Status enum NOT_STARTED..AI_PROCESSING, CK Progress 0..100, IX_ProjectStageExecutions_Project_Status
- ProjectControlEvents CK Action START/PAUSE/RESUME/STOP/RESTART, IX_ProjectControlEvents_Project_Created
- WorkItems CK Priority LOW/MEDIUM/HIGH/URGENT, CK Status OPEN/IN_PROGRESS/WAITING/COMPLETED/CANCELLED, IX_WorkItems_Assignee_Status
- Notifications CK Severity INFO/SUCCESS/WARNING/CRITICAL, IX_Notifications_User_Unread
- AgentRuns CK Status ONLINE/RUNNING/WAITING/COMPLETED/FAILED/DISABLED, CK Progress 0..100, IX_AgentRuns_Workspace_Status
- GenerationUsage, IX_GenerationUsage_Workspace_Created
- PublishingSchedule CK Status DRAFT/SCHEDULED/PUBLISHING/PUBLISHED/FAILED/CANCELLED, IX_PublishingSchedule_Workspace_Time

**FR-2 Seed 22 workflow stages.**
Create `packages/database/sql/seeds/003_workflow_stages.sql` with a MERGE on StageKey producing exactly 22 stages (StageOrder 1..22, phases Initiation & Strategy through Performance & Learning, IsHumanGate true for CONCEPT_APPROVAL and FINAL_APPROVAL).

**FR-3 Bootstrap Module 02 demo data.**
Create `packages/database/src/bootstrap-module02.ts` that:
- Requires Module 01 bootstrap to have run (fails with "Run Module 01 bootstrap first." if user/workspace pair missing).
- Upserts 5 ContentProjects (codes CAC-2026-000120…124, titles/statuses/autonomy-modes matching module02-data.ts).
- Seeds per-project 22 ProjectStageExecutions rows with progress aligned to dashboard progress (124 at 48% → StageOrder 9 IMAGE_GENERATION current, status IN_PROGRESS; 123 AWAITING_APPROVAL at FINAL_APPROVAL; 122 PAUSED VIDEO_GENERATION; 121 BLOCKED FACT_CHECK; 120 COMPLETED CONTENTS_RECYCLING).
- Creates 4 WorkItems for the bootstrap user (Approve package, Resolve claim, Review image variants, Choose provider fallback) with due dates 24h out.
- Creates 3 Notifications for user (CRITICAL Workflow BLOCKED at FACT_CHECK, WARNING Approval waiting, INFO Image batch completed).
- Creates 5 AgentRuns (image-agent RUNNING 72, continuity-agent RUNNING 83, publishing-agent WAITING, fact-agent FAILED, analytics-agent ONLINE).
- Inserts 86 GenerationUsage rows (64 image + 22 video).
- Creates 3 PublishingSchedule slots: 123 YouTube +2 days, 124 YouTube +4 days, 122 SHORTS +5 days.
- Uses the target's `@cacsms/database` only through the local `./index.js` relative import inside the database package.

**FR-4 Extend @cacsms/types with workflow exports.**
Create/merge `packages/types/src/workflow.ts` exporting `WorkflowStatus` (9-item union) and `StageHandoff<TInput,TOutput>` interface. Ensure `packages/types/src/index.ts` re-exports from `./workflow`. (Source module has exactly these files; copy/adapt verbatim. Target index already exports workflow types if present.)

**FR-5 Module 02 API endpoints.**
Extend `apps/api/src/repository.ts` with 6 new functions (and module01 ones untouched):
- `getCommandCenter(workspaceId, userId)` → Promise<{summary,projects,tasks,notifications,agents,schedule,usage}> running 7 parallel queries with TOP clauses (12 projects, 8 tasks/notes, 12 agents, 8 schedule, usage aggregation).
- `listProjectStages(workspaceId, projectId)` → 22 stage rows with progress/started/completed/paused/lastError.
- `controlProject(workspaceId, projectId, userId, action, reason?)` → transaction with UPDLOCK content projects row, allowed action->current status transition table, writes ProjectControlEvents, returns {projectId,previousStatus,status,action}.
- `listMyWork(workspaceId, userId)` → ordered work list.
- `updateWorkItem(workspaceId, userId, workItemId, status)` → OUTPUT clause UPDATE with status enum guard.
- `listNotifications(workspaceId, userId)` + `markNotification(userId, id, read)` → ordered + PATCH update.
Extend `apps/api/src/server.ts` with 7 NEW Module 02 routes (Module 01 routes preserved untouched):
- `GET /api/command-center` (workspace required → 409)
- `GET /api/command-center/projects/:projectId/stages` (Zod uuid param, workspace → 409)
- `POST /api/command-center/projects/:projectId/control` (Zod uuid param + Zod body {action: START|PAUSE|RESUME|STOP|RESTART, reason?: string ≤1000}; audit PROJECT_${action})
- `GET /api/my-work` (workspace → 409)
- `PATCH /api/my-work/:workItemId` (Zod body status enum OPEN..CANCELLED)
- `GET /api/notifications` (workspace → 409)
- `PATCH /api/notifications/:notificationId` (Zod uuid param + body {read:boolean})
Update health payload: `{status:"ok",service:"cacsms-cinema-api",version:"0.3.0",module01:"ready",module02:"ready"}`.
Update `apps/api/src/smoke-test.ts` to log both Module 01 + Module 02 contracts.
Critical: Every @cacsms-cinemas/database import in source server/repository must be rewritten to the target alias `@cacsms/database`. No @acg/ tokens allowed.

**FR-6 Command Center page (command/page.tsx).**
Create AppShell-wrapped page with eyebrow="COMMAND", title="Command Center", actions Export / ＋Create content, LIVE updated-now indicator, 6 KPI cards (Total projects / Active production / Awaiting approval / Exceptions / Generations today 86 / Scheduled 3), 2-card wide-left grid (Production pipeline segmented Pipeline|List, 5-project status rows + current stage + controls + My Work list), 3-card thirds grid (AI agent activity 5 items, Notifications mini list 3 unread badge, Publishing schedule 3 tiles with date-tiles), System & production health strip (6 health items with dots), plus ProjectDrawer (22 stage timeline, Start/Pause/Resume/Stop buttons per allowed transitions, control bar, summary). LIVE demos: `NEXT_PUBLIC_DEMO_MODE=true` fallbacks load `module02-data.ts` dashboardProjects/schedule/tasks/notifications/agents on fetch failure.

**FR-7 My Work page (my-work/page.tsx).**
4 summary tiles (Open / In progress / Waiting / Completed). Segmented filter (ALL OPEN IN_PROGRESS WAITING COMPLETED). Compact search, Priority and Due date filter buttons. Work table (work item + type icon, project/stage, priority pill tone, status pill tone, due date, row actions Complete / Open →). apiFetch /api/my-work fallback to module02-data.ts demoTasks. Complete button PATCHes /api/my-work/:id status=COMPLETED.

**FR-8 Notifications page (notifications/page.tsx).**
Inbox aside filters: ALL, UNREAD (with unread count), WORKFLOW, APPROVAL, GENERATION, PUBLISHING, SECURITY. Delivery settings section. Feed: Newest-first dropdown, notification cards with severity CRITICAL=!, SUCCESS=✓, else=i symbol, category chip, unread bar, actions Open → / Mark read toggle, empty state for zero matches. Mark-all-as-read topbar action. apiFetch /api/notifications fallback demoNotifications. PATCH /api/notifications/:id toggles read.

**FR-9 AppShell and navigation expansion (app-shell.tsx).**
Replace/extend target AppShell to four navigation groups: COMMAND (Command Center /command, My Work /my-work, Notifications /notifications with badge "3"), CONTENT OPERATIONS (3 future items: Content Projects, Create Content, Content Calendar), PRODUCTION PIPELINE (9 future items: Strategy & Brief, Research Studio, Script Studio, Scene & Storyboard, AI Generation, Editing & QA, Packaging, Approval & Publishing, Analytics & Learning — all "soon" chip), ADMINISTRATION (Users /admin/users, Roles & Permissions /admin/roles, Audit Trail future, System Settings future). Brand mark "CC" + strong label Cacsms Cinema + subtitle Autonomous Content OS. Workspace mini "CC" avatar + "Cacsms Cinema" + "Production workspace". Sidebar system chip: "Module 02 · Command". Topbar: mobile hamburger, search "⌕ Search projects, tasks, agents, assets…" with ⌘K kbd, quick "+ Create" button, ? icon, notifications link (♢ with unread dot), avatar PE. Breadcrumb Cacsms Cinema › EYEBROW › TITLE. Page actions right side. Plural "Cacsms Cinemas" everywhere in source shell → singular "Cacsms Cinema".

**FR-10 Static fallback data (lib/module02-data.ts + lib/api.ts).**
Create `apps/web/src/lib/module02-data.ts`: exact DemoProject/ProjectStatus types, 5 dashboard projects matching codes CAC-2026-000120..124, 22 stage display names in order, 5 demoTasks (URGENT/HIGH/MEDIUM/LOW tones + Open/InProgress/Waiting/Completed), 5 demoNotifications (CRITICAL unread/WARNING unread/INFO unread/SUCCESS read/INFO read), 5 demoAgents, 3 schedule.
Create `apps/web/src/lib/api.ts`: simple apiFetch using NEXT_PUBLIC_API_URL with credentials:'include' + JSON Content-Type, throws on non-ok with message from body.error if any.

**FR-11 globals.css extensions.**
Ensure globals.css carries ALL command-center classes (source module CSS contains them). Key required selectors: `.command-title-row`, `.live-indicator`, `.command-kpis{6-col grid}`, `.command-grid wide-left thirds`, `.command-card`, `.command-card-head`, `.segmented`, `.status-legend`, `.project-stack`, `.project-row`, `.project-main-click`, `.project-id-line`, `.project-progress-line`, `.progress-track`, `.project-stage`, `.project-state`, `.project-controls`, `.task-list`, `.task-row`, `.priority-mark`, `.agent-list`, `.agent-row`, `.agent-orb`, `.agent-status`, `.notification-mini-list`, `.notification-mini`, `.notification-symbol`, `.schedule-list`, `.schedule-row`, `.date-tile`, `.platform-tag`, `.micro-badge purple red`, `.card-footer-link`, `.health-strip`, `.health-items`, `.health-item`, `.modal-backdrop`, `.project-drawer`, `.drawer-head`, `.drawer-control-bar`, `.drawer-meta`, `.drawer-section-title`, `.stage-timeline`, `.stage-line`, `.work-summary`, `.work-board`, `.work-toolbar`, `.work-table{grid 6 cols}`, `.work-table-head`, `.work-table-row`, `.work-type-icon`, `.due-text`, `.row-actions`, `.notification-center{grid 1fr 2.3fr}`, `.notification-filters`, `.notification-feed`, `.notification-feed-head`, `.notification-full`, `.notification-title-line`, `.notification-actions`, `.muted-action`, `.empty-state`, `.search-input compact`, `.filter-btn`, `.btn small`, `.danger-btn small`. Keep 10 CSS tokens exact, breakpoints at 1300px and 760px as source module specifies.

**FR-12 Database package.json scripts + types package.json deps (no new deps beyond source).**
- packages/database/package.json: Add script `"db:bootstrap-module02": "tsx src/bootstrap-module02.ts"` (db:bootstrap stays for Module 01; both present). Any dep already carried over from Module 01 (bcryptjs, mssql, tsx) remains. Source database package.json / api package.json did not carry additional new deps beyond what we installed in Module 01.
- packages/types/package.json: If source carries additional deps, merge them; source shows typescript + @types/node already. No additional workspace edits required.

**FR-13 Demo mode independence (NEXT_PUBLIC_DEMO_MODE=true).**
With .env NEXT_PUBLIC_DEMO_MODE=true and MSSQL actually absent, user can still: navigate /command, /my-work, /notifications, the pages render full demo data, drawer opens, buttons respond with optimistic local state updates without throwing. This is preserved per Module 01 precedent.

## 3. Non-Functional Requirements

**NFR-1 Idempotency.** Migration 003 DDL uses IF OBJECT_ID IS NULL. Seed MERGE. Bootstrap uses IF NOT EXISTS checks + upserts. Repeat `db:bootstrap-module02` exits 0 without violating uniqueness.
**NFR-2 Dependency hygiene.** Only deps already present in source module are added; no extra packages added. If a dep needed for new files already exists (fastify plugins, zod, jsonwebtoken, bcryptjs), reuse it.
**NFR-3 Import resolution.** All workspace package references use `@cacsms/*` namespace only; exports fields already carry default fallback from Module 01; no ERR_PACKAGE_PATH_NOT_EXPORTED on fresh build.
**NFR-4 Runtime compatibility.** API lazy-pool pattern unchanged — server boots fine without SQL Server (health returns immediately, endpoints that touch DB throw appropriately wrapped through global error handler 5xx clamped generic).
**NFR-5 Security parity.** (a) Cookies: httpOnly, sameSite lax, secure in prod, 8h maxAge. (b) Zod: every PATCH/POST body + uuid param parsed. (c) 5xx error handler returns generic `Internal server error`; err.message only for <500. (d) bcrypt cost 12 preserved in bootstrap-module02 (no new password hashing here, but existing hashes untouched). (e) Forgot/reset endpoints continue no-enumeration contracts.
**NFR-6 Build.** `pnpm install`, `pnpm -r build`, `pnpm -r typecheck` all exit 0. GetDiagnostics returns empty array.
**NFR-7 Namespace cleanup.** Across any `.ts/.tsx/.json/.sql/.css` production source files (excluding .trae spec artifacts because they describe rename contracts), zero occurrences of: `@acg/`, `@cacsms-cinemas/`, `Cacsms Cinemas`, `Autonomous Content Generator`, `ACG`.
**NFR-8 Performance.** Command page <=11 server components, pages use 'use client' (Module 02 pages already written as client), static generation fallback preserved for non-demo mode unknown projects.

## 4. Constraints / Assumptions

- **Technical constraints:** (1) Migration `001_foundation.sql` and `002_module01_access_control.sql` + seeds `001_system_roles.sql` and `002_permissions.sql` MUST NOT be modified (they ship immutable Module 01/001 modules; only append new-numbered 003 files). (2) Cannot break API Module 01 routes — 10 original endpoints must exist alongside 7 new ones, 17 total. (3) Cannot break Web Module 01 pages — /login, /workspace, /profile, /admin/users, /admin/roles must still render 200; new /command, /my-work, /notifications are additive only. (4) Ports 3000 web / 4000 API unchanged.
- **Business constraints:** Brand strings must be singular Cacsms Cinema; plural never survives production files.
- **Dependencies allowed (additive):** No new npm packages expected beyond what Module 01 installed (source module's database/bootstrap used same mssql/bcrypt; source API used same fastify/zod/jwt/cookie). If source package.json shows different versions already present, upgrade is allowed; if absent, keep installed version.
- **Assumptions:** (A) ContentProjects table already present from 001_foundation (Module 01 bootstrap did not populate it, but its schema includes ContentCode, WorkingTitle, Status, AutonomyMode, OwnerUserId — matches bootstrap inserts). (B) Users/Workspaces/Roles/Permissions from Module 01 are intact. (C) NEXT_PUBLIC_DEMO_MODE=true is already in .env per Module 01.
- **Open Question #2 (Ambient MSSQL):** For runtime verification, API endpoints such as /api/command-center will attempt a DB call and correctly surface 401/409/5xx through error handler. Verification will confirm paths/responses and payloads via demos + smoke-test; DB persistence testing is optional via bootstrap script run if a local MSSQL is available.
  - Answer: [x] Treat DB connectivity as optional for API route registration proof & pages; bootstrap-module02 can be executed on-demand when SQL Server is actually running. Prove endpoints are wired (route count + smoke-test) and pages respond HTTP 200 with rich UI via demo fallbacks.

## 5. Acceptance Criteria

| #   | Kind    | Statement & pass condition |
|-----|---------|----------------------------|
| AC-1 | `rule`  | `GET /health` returns HTTP 200 with `status==='ok' && service==='cacsms-cinema-api' && version==='0.3.0' && module01==='ready' && module02==='ready'`. apps/api/src/server.ts registers all 17 Module 01 + Module 02 routes (10 original + 7 new). Evidence: HTTP probe + grep server.ts for 7 new paths. |
| AC-2 | `rule`  | All 11 web routes return expected HTTP codes: `/ → 307 /login`, /login 200, /forgot-password 200, /reset-password 200, /workspace 200, /profile 200, /admin/users 200, /admin/roles 200, **/command 200, /my-work 200, /notifications 200**. next build includes all 11 routes (plus _not-found) with exit 0. Evidence: HTTP probe + next build route listing. |
| AC-3 | `rubric` — **AppShell fidelity (scale 0–5, threshold ≥4).** Dimension: brand mark CC + 4 nav groups exact labels + COMMAND 3 items with Notifications badge '3' + PRODUCTION PIPELINE 9 future items + CONTENT OPERATIONS 3 future + ADMINISTRATION 4 (2 live + 2 future). Topbar carries ⌕+⌘K, quick-create +, notifications ♢ badge, avatar. Breadcrumb uses "Cacsms Cinema" singular. Sidebar system: "Module 02 · Command". Breakpoints collapse sidebar 760px; reflow grids 1300px; 10 tokens exact match spec. Evidence: read app-shell.tsx + globals.css class presence. |
| AC-4 | `rubric` — **3 new pages richness (scale 0–5, threshold ≥4).** Dimension: Command page has LIVE indicator, 6 KPI exact labels, project pipeline rows have segmented controls per-allowed-status transitions, drawer with 22-stage timeline + control bar + summary. My Work has 4 KPI summary, 5 segmented filter tabs, work table 6-col grid with Complete action. Notifications has 7 inbox filters + unread counter chip, feed cards 5 categories, Mark all as read top action + per-card read toggle + empty state. Static demos: pages populate via module02-data.ts when API unavailable. Evidence: page file reads + module02-data.ts export inventory. |
| AC-5 | `rule`  | DB migration/seed/bootstrap/script all exist with correct structure: (a) packages/database/sql/migrations/003_module02_command_center.sql exists with exactly 8 IF OBJECT_ID IS NULL tables + 8 CREATE INDEX lines OR corresponding IX_* names present. (b) packages/database/sql/seeds/003_workflow_stages.sql exists with MERGE of EXACTLY 22 StageKey entries (StageOrder 1..22), CONCEPT_APPROVAL + FINAL_APPROVAL have IsHumanGate=1. (c) packages/database/src/bootstrap-module02.ts: 5 ContentProjects upsert codes CAC-2026-000120..124, project stages seeded per-progress, 4 WorkItems, 3 Notifications, 5 AgentRuns incl FAILED fact-agent, 86 GenerationUsage, 3 PublishingSchedule, requires pre-existing bootstrap-user + cacsms-cinema workspace. (d) packages/database/package.json scripts includes key "db:bootstrap-module02". Evidence: file existence + grep counts. |
| AC-6 | `rule`  | `pnpm install` exits 0, `pnpm -r build` exits 0 (6 workspace projects succeed), workspace grep of ts/tsx/json for `@acg/` and `@cacsms-cinemas/` returns 0 matches. No ERR_PACKAGE_PATH_NOT_EXPORTED message in build log. Evidence: shell command exits + grep result count. |
| AC-7 | `rule`  | Security baseline: (a) ALL 3 new POST/PATCH body + param endpoints use Zod parse. (b) Login / workspace-select setCookie lines use `httpOnly:true` (unchanged from Module 01 but must still be present). (c) Source for bcrypt cost factor = 12 in all places it appears (auth.ts and/or bootstrap-module02.ts if passwords are hashed there — new bootstrap doesn't hash passwords but auth.ts must retain cost 12). (d) setErrorHandler returns generic `Internal server error` for status>=500; sensitive errors not leaked. (e) apps/api source imports: only @cacsms/* namespace (zero @acg/ zero @cacsms-cinemas/). Evidence: targeted greps of server.ts / auth.ts / repository.ts / bootstrap-module02.ts. |
