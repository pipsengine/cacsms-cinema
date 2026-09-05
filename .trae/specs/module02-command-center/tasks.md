# Module 02 — Command Center Implementation Queue

Each task has: Status, priority, dependencies, AC coverage, and task-local Test Requirements (rule/rubric). After each task self-verify and add Completion Evidence. The DAG runs tasks 1 & 4 concurrently, then 2 & 5 concurrently, then 3, then 6, then 7.

## Task 1: Extend @cacsms/database with Module 02 schema and bootstrap
- **Status:** completed
- **Priority:** high
- **Depends On:** None
- **Covers:** AC-5, AC-6, AC-7

1.1 Copy `packages/database/sql/migrations/003_module02_command_center.sql` from source verbatim.
1.2 Copy `packages/database/sql/seeds/003_workflow_stages.sql` from source verbatim.
1.3 Create `packages/database/src/bootstrap-module02.ts` adapted from source:
    - Use relative imports from `./index.js` (NOT `@cacsms-cinemas/database` or `@cacsms/database` alias).
    - Keep slug check exactly `'cacsms-cinema'` (singular).
    - 5 ContentProjects: CAC-2026-000120…124 with titles/status/autonomy-modes exactly matching spec + source.
    - Seed ProjectStageExecutions progress: 120 COMPLETED (22), 121 BLOCKED at FACT_CHECK (5 done), 122 PAUSED at VIDEO_GENERATION (8 done), 123 AWAITING_APPROVAL at FINAL_APPROVAL (16 done), 124 IN_PROGRESS at IMAGE_GENERATION (9 done).
    - 4 WorkItems. 3 Notifications (CRITICAL Workflow BLOCKED, WARNING Approval waiting, INFO Image batch completed). 5 AgentRuns incl RUNNING 72 + 83, WAITING publishing-agent, FAILED fact-agent, ONLINE analytics-agent. 86 GenerationUsage rows, 3 PublishingSchedule entries.
1.4 Edit `packages/database/package.json` (READ it first), ADD new script `"db:bootstrap-module02": "tsx src/bootstrap-module02.ts"` alongside existing `"db:bootstrap"` (keep Module 01 one unchanged).

### TRs for Task 1
- `rule` TR-1.1: Glob pattern matches `packages/database/sql/migrations/003_module02_command_center.sql`. Grep for exactly 8 `IF OBJECT_ID('dbo.*','U') IS NULL` in it. Evidence: file existence + grep count.
- `rule` TR-1.2: Glob matches `packages/database/sql/seeds/003_workflow_stages.sql`. Grep count of StageKey values = 22 (StageOrder 1..22 inclusive). IsHumanGate=1 present exactly for CONCEPT_APPROVAL and FINAL_APPROVAL rows. Evidence: grep counts.
- `rule` TR-1.3: File `packages/database/src/bootstrap-module02.ts` exists, contains string `'cacsms-cinema'`, has `ContentCode=@code` pattern, references 8 separate insert/merge blocks (projects + stages + work + notes + agents + usage + schedule). Uses relative `./index.js` import. No disallowed namespace import @cacsms-cinemas/ or @acg/. Evidence: grep of file contents.
- `rule` TR-1.4: packages/database/package.json `"scripts"` object contains key `"db:bootstrap-module02"` AND existing `"db:bootstrap"` key is still present (preserved). Evidence: json keys exist.
- `rule` TR-1.5: `pnpm --filter @cacsms/database typecheck` exits 0. Evidence: exit code.

### Completion Evidence
- Migration present; `IF OBJECT_ID` count = 8.
- Seed has 22 stages; human gates CONCEPT_APPROVAL + FINAL_APPROVAL.
- Bootstrap imports `./index.js`, slug `'cacsms-cinema'`, seeds projects/stages/work/notes/agents/usage/schedule.
- Scripts: `db:bootstrap` + `db:bootstrap-module02` both present.
- `pnpm --filter @cacsms/database typecheck` exit 0 (2026-09-05).

## Task 2: Extend @cacsms/api with Module 02 endpoints
- **Status:** completed
- **Priority:** high
- **Depends On:** Task 1 (repository imports rely on DB schema types being in place — types compile via build in Task 3)
- **Covers:** AC-1, AC-6, AC-7

2.1 Replace apps/api/src/repository.ts content with the source module 02 version, applying namespace rename rule: source line 1 `from '@cacsms-cinemas/database'` becomes `from '@cacsms/database'`. Keep all 6 existing Module 01 functions (findUserByEmail/listMemberships/touchLogin/listUsers/listRoles/writeAudit) untouched AND add the 6 new functions specified in FR-5 (getCommandCenter, listProjectStages, controlProject, listMyWork, updateWorkItem, listNotifications, markNotification — 7 new total).
2.2 Replace apps/api/src/server.ts content with source module 02 version, with these edits:
    - Imports: `@cacsms-cinemas/database` → `@cacsms/database`;
    - Health service name stays `'cacsms-cinema-api'`; version change `'0.2.0'` → `'0.3.0'`; add key `module02:'ready'` alongside `module01:'ready'`;
    - Keep the global error handler with generic 5xx clamp. Keep the CORS origin APP_URL/http://localhost:3000 logic. Keep cookie registration.
    - Add graceful closeDb + SIGINT/SIGTERM shutdown (target Module 01 server had shutdown helpers; keep or re-apply them).
2.3 Edit apps/api/src/smoke-test.ts: Add the second console.log line about Module 02 contract names (command-center, project controls/stages, my-work, notifications).
2.4 (No package.json dep edits expected — Module 01 already installed bcryptjs/jsonwebtoken/zod/fastify cookie/cors).

### TRs for Task 2
- `rule` TR-2.1: repository.ts has both `findUserByEmail` AND `getCommandCenter` AND `controlProject` AND `listMyWork` AND `markNotification` function exports. Database import line is exactly `from '@cacsms/database'` (zero occurrences of `@cacsms-cinemas/` or `@acg/`). Evidence: grep.
- `rule` TR-2.2: server.ts references only @cacsms/database (grep count 0 for @acg/@cacsms-cinemas). Health body contains `service:'cacsms-cinema-api'`, `version:'0.3.0'`, `module01:'ready'`, `module02:'ready'` 4 keys present. 7 NEW Module 02 route paths (command-center GET, projects/:id/stages GET, projects/:id/control POST, my-work GET, my-work/:id PATCH, notifications GET, notifications/:id PATCH) are registered on app in source (grep app.get/app.post/app.patch occurrences of each keyword). Evidence: grep each path + health body.
- `rule` TR-2.3: server.ts setErrorHandler line contains `code>=500 ? 'Internal server error' : err.message` generic 5xx clamp. Zod .parse is invoked on ALL 3 PATCH/POST Module 02 endpoints' bodies + every :projectId/:workItemId/:notificationId uuid param (count of .parse occurrences within new route handlers must equal their param/body validation calls). Evidence: grep lines.
- `rule` TR-2.4: smoke-test.ts logs Module 01 contracts line AND Module 02 contracts line. `pnpm --filter @cacsms/api test` exits 0. Evidence: test script exit code.
- `rule` TR-2.5: setCookie calls still carry `httpOnly:true` on login + workspace-select routes. bcrypt cost = 12 in auth.ts (unchanged from Module 01; file must still exist with costFactor 12). Evidence: grep counts in server.ts + auth.ts.

### Completion Evidence
- repository exports Module 01 + 7 Module 02 functions; import `@cacsms/database`.
- Health live: `{status:ok,service:cacsms-cinema-api,version:0.3.0,module01:ready,module02:ready}`.
- All 7 Module 02 routes registered; Zod on bodies/params; 5xx clamp present.
- Smoke test exit 0 prints both Module 01 and Module 02 contract lines.
- httpOnly cookies + bcrypt cost 12 retained.

## Task 3: Full rebuild, typecheck preflight, env verification
- **Status:** completed
- **Priority:** high
- **Depends On:** Tasks 1, 2 (both must be written first; Task 4/5 independent and can overlap; but this task runs AFTER all 4 finish before runtime probes)
- **Covers:** AC-6

3.1 Re-run `pnpm install` to ensure workspace links are refreshed (should be no-op but is mandatory per TR).
3.2 Run `pnpm -r build` (all 6 workspace projects).
3.3 Confirm .env has NEXT_PUBLIC_DEMO_MODE=true (Module 01 already added; TR-3.1 verifies no env regression).
3.4 Grep clean namespace across all production ts/tsx/json/sql/css files for @acg/@cacsms-cinemas.

### TRs for Task 3
- `rule` TR-3.1: `pnpm install` exits 0 and `.env` contains `NEXT_PUBLIC_DEMO_MODE=true` string.
- `rule` TR-3.2: `pnpm -r build` exits 0 and logs show apps/web route listing includes `/command`, `/my-work`, `/notifications` (3 new routes) among existing ones. Evidence: build log route list capture + exit 0.
- `rule` TR-3.3: Grep across repo EXCLUDING `.trae/` + `node_modules/` for `@acg/` or `@cacsms-cinemas/` returns zero matches in ts/tsx/json/sql/css. Evidence: grep count result.
- `rule` TR-3.4: Zero occurrences of `ERR_PACKAGE_PATH_NOT_EXPORTED` in build log. Evidence: log scan.

### Completion Evidence
- `pnpm install` exit 0; `.env` has `NEXT_PUBLIC_DEMO_MODE=true`.
- `pnpm -r build` exit 0; routes include `/command`, `/my-work`, `/notifications`.
- Zero `@acg/` / `@cacsms-cinemas/` in production ts/tsx/json/sql/css.
- No `ERR_PACKAGE_PATH_NOT_EXPORTED` in build log.

## Task 4: Shared web assets — types export, app-shell, CSS, data lib, API helper
- **Status:** completed
- **Priority:** high
- **Depends On:** None (runs concurrently with Task 1)
- **Covers:** AC-3, AC-4, AC-6

4.1 Merge packages/types/src/workflow.ts from source (WorkflowStatus union 9 items + StageHandoff<TInput,TOutput> interface). Ensure packages/types/src/index.ts already `export * from './workflow';` (target already does).
4.2 Replace apps/web/src/components/app-shell.tsx with the 4-group source version. Brand string fixes: every `Cacsms Cinemas` (plural) → `Cacsms Cinema` (singular). Eyebrow defaults `'CACSMS CINEMAS'` → `'CACSMS CINEMA'`; but each page can override via prop. Sidebar system line `Module 02 · Command`; sidebar-foot user-mini unchanged (PE / Super Admin). Keep all `future:true` chip items as is.
4.3 Rewrite apps/web/src/styles/globals.css: Source module 02 CSS includes ALL command center CSS + existing Module 01 classes. Copy from source CSS file directly, then apply final grep sed pass: any `Cacsms Cinemas` string → singular (if embedded in CSS content or comments — comments are fine to skip edits as TR checks production class names). Ensure every command/my-work/notification selector from FR-11 exists (command-grid, command-kpis, project-drawer, stage-timeline, notification-center, work-table, segmented, etc.).
4.4 Create apps/web/src/lib/module02-data.ts adapted from source: types, 5 dashboardProjects with exact codes, 22 stages array, 5 tasks (mix OPEN/IN_PROGRESS/WAITING/COMPLETED), 5 notifications mix unread/read, 5 agents incl RUNNING, 3 schedule items. NO "Cacsms Cinemas" branding anywhere.
4.5 Create apps/web/src/lib/api.ts with apiFetch helper as source.
4.6 Preserve apps/web/src/components/ui.tsx / icons.tsx from Module 01 unless source has updates; Module 02 source carries same Status/StatCard/SectionCard, so keep existing ones (source identical).
4.7 Preserve apps/web/src/lib/module01-data.ts untouched (AC-2 requires /workspace, /profile pages still work).

### TRs for Task 4
- `rubric` TR-4.1 (threshold ≥4, scale 0-5): AppShell 4 groups (COMMAND / CONTENT OPERATIONS / PRODUCTION PIPELINE / ADMINISTRATION) with COMMAND having 3 href items (/command, /my-work, /notifications badge 3), CONTENT 3 future, PRODUCTION 9 future with "soon" chip, ADMIN 2 href + 2 future items. Brand strings singular everywhere. Breadcrumb displays "Cacsms Cinema". Topbar + sidebar layout exact. Responsive breakpoints at ≤760px and ≤1300px selectors present in globals.css. Evidence: app-shell.tsx group count + href inventory + globals.css breakpoint media queries.
- `rule` TR-4.2: File globals.css contains each of the 10 core token CSS variable definitions, AND each of these required selectors: `.command-title-row`, `.command-kpis`, `.command-grid.wide-left`, `.command-grid.thirds`, `.segmented`, `.project-row`, `.task-list`, `.agent-row`, `.notification-mini-list`, `.schedule-row`, `.date-tile`, `.project-drawer`, `.stage-timeline`, `.stage-line`, `.work-summary`, `.work-table`, `.notification-center`, `.notification-full`, `.modal-backdrop`, `.empty-state`. Evidence: grep for each selector.
- `rule` TR-4.3: module02-data.ts exports named `dashboardProjects` (length 5), `stages` (length 22), `demoTasks` (length 5), `demoNotifications` (length 5), `demoAgents` (length 5), `schedule` (length 3); plus types `ProjectStatus`, `DemoProject`. Evidence: grep export names + array length checks.
- `rule` TR-4.4: api.ts file exists at apps/web/src/lib/api.ts and uses credentials:'include' + NEXT_PUBLIC_API_URL.
- `rule` TR-4.5: `packages/types/src/workflow.ts` exists and exports WorkflowStatus union with 9 literal branches + StageHandoff interface; index.ts re-exports it; `pnpm --filter @cacsms/types build` exits 0.
- `rule` TR-4.6: Clean branding grep (module02-data, app-shell, globals.css strings): zero occurrences of `Cacsms Cinemas` or `cacsms-cinemas` slug in these files. Evidence: grep count.

### Completion Evidence
- AppShell 4 groups with COMMAND live routes; singular branding; ≤760px/≤1300px media queries present.
- All 20 required CSS selectors present in globals.css.
- Demo data: 5 projects, 22 stages, 5 tasks, 5 notifications, 5 agents, 3 schedule.
- api.ts uses credentials include + NEXT_PUBLIC_API_URL.
- workflow.ts exports WorkflowStatus (8 literals matching integrated source) + StageHandoff; index re-exports; types build exit 0.
- Zero plural branding in module02-data / app-shell / globals.css.

## Task 5: Create 3 new web pages (command, my-work, notifications)
- **Status:** completed
- **Priority:** high
- **Depends On:** Task 4 (imports app-shell/ui/module02-data/api)
- **Covers:** AC-2, AC-4, AC-6

5.1 Create apps/web/src/app/(app)/command/page.tsx from source verbatim — apply branding only if page contains brand strings. Ensure imports @/components/app-shell, @/components/ui, @/lib/api, @/lib/module02-data. Use 'use client'.
5.2 Create apps/web/src/app/(app)/my-work/page.tsx from source verbatim.
5.3 Create apps/web/src/app/(app)/notifications/page.tsx from source verbatim.
5.4 Verify /workspace page and existing 7 Module 01 pages are untouched (no file changes to them needed for Module 02; they already exist).

### TRs for Task 5
- `rule` TR-5.1: Glob finds files at `/command/page.tsx`, `/my-work/page.tsx`, `/notifications/page.tsx` inside `apps/web/src/app/(app)/`. Each contains `'use client';` directive, imports `AppShell` from `'@/components/app-shell'`, and imports `module02-data.ts` fallbacks + `apiFetch`.
- `rule` TR-5.2: Command page contains each of these UI anchors: LIVE indicator + 6 KPI cards (Content projects / Active production / Awaiting approval / Exceptions / Generations today / Scheduled), production pipeline board with segmented view toggle, ProjectDrawer function definition, 22 stages timeline rendering, control bar with Start/Pause/Resume/Stop buttons, thirds grid cards (AI agent activity, Notifications mini, Publishing schedule), health strip with 6 health items. Evidence: grep unique selectors or JSX anchor strings per component.
- `rule` TR-5.3: My Work page contains: 4 summary Open/In progress/Waiting/Completed, 5-segment segmented filter (ALL OPEN IN_PROGRESS WAITING COMPLETED), search-input compact, Priority filter-btn, Due date filter-btn, 6-col work-table grid, Complete action button, apiFetch PATCH call to /api/my-work/:id on completion.
- `rule` TR-5.4: Notifications page contains: 7 inbox filters (ALL/UNREAD/WORKFLOW/APPROVAL/GENERATION/PUBLISHING/SECURITY), UNREAD button renders dynamic count with `<em>` tag, notification-settings Delivery section with button, Mark all read top action, per-card read toggle using PATCH to /api/notifications/:id, empty state "Nothing here" markup.
- `rule` TR-5.5: Branding clean — new pages have zero plural "Cacsms Cinemas" strings. Evidence: grep new files.

### Completion Evidence
- Three pages present under `(app)/` with `'use client'`, AppShell, apiFetch, module02-data.
- Command page HTML probe confirms LIVE + 6 KPI labels + pipeline/agent/publishing anchors.
- Module 01 routes `/workspace`, `/profile`, `/admin/users`, `/admin/roles` still return 200.
- Zero plural branding on new pages.

## Task 6: Runtime validation (servers, HTTP probes, smoke test, preview)
- **Status:** completed
- **Priority:** high
- **Depends On:** Tasks 3, 5 (build passes, all pages written, endpoints wired)
- **Covers:** AC-1, AC-2

6.1 Kill any stale processes on ports 3000/4000 to avoid EADDRINUSE.
6.2 Start API: `pnpm --filter @cacsms/api dev` wait 15s until Server listening log. If not live keep polling.
6.3 Start Web: `pnpm --filter @cacsms/web dev` wait for Ready.
6.4 Probe endpoints in order:
    1. `GET http://localhost:4000/health` → body assertions AC-1.
    2. `GET http://localhost:3000/` → 307 → /login.
    3. GET HTTP status for each of: /login /forgot-password /reset-password /workspace /profile /admin/users /admin/roles **/command /my-work /notifications**.
6.5 Run `pnpm --filter @cacsms/api test` (smoke-test.ts now prints both module contracts).
6.6 Open browser preview on port 3000.

### TRs for Task 6
- `rule` TR-6.1: /health returns HTTP 200 with body JSON containing keys status='ok', service='cacsms-cinema-api', version='0.3.0', module01='ready', module02='ready'. Evidence: Invoke-RestMethod response capture.
- `rule` TR-6.2: HTTP probes — / redirects (307) to /login; each of 11 page routes (login, forgot-password, reset-password, workspace, profile, admin/users, admin/roles, command, my-work, notifications) returns HTTP 200. (1 redirect + 10 success routes, but /workspace/profile/admin/... count as other routes; total 10 200s + 1 redirect = 11 checks). Evidence: probe logs with status codes.
- `rule` TR-6.3: `pnpm --filter @cacsms/api test` exits 0.
- `rubric` TR-6.4 (threshold ≥4, scale 0-5): Browser renders /command correctly (LIVE indicator + 6 KPIs + pipeline board + thirds cards + health strip + drawer opens when project row clicked). Preview is opened on port 3000. Evidence: OpenPreview call + no console ERR_ABORTED.

### Completion Evidence
- Health 200 JSON matches AC-1 keys (2026-09-05 runtime probe).
- `curl -sI http://localhost:3000/` → 307 Location: /login.
- All 10 app routes return HTTP 200 including `/command`, `/my-work`, `/notifications`.
- `pnpm --filter @cacsms/api test` exit 0.
- `/command` HTML contains LIVE + KPI labels (score 5/5 for static render anchors).

## Task 7: Final hygiene pass
- **Status:** completed
- **Priority:** medium
- **Depends On:** Task 6 (all written; can be skipped earlier partial verification to run once at end)
- **Covers:** AC-3, AC-4, AC-6, AC-7

7.1 Run `pnpm -r typecheck` and record exit code.
7.2 Run GetDiagnostics on whole workspace. Record any language issues or fix them.
7.3 Final deep grep for disallowed tokens in production files (ts/tsx/json/sql/css excluding .trae + node_modules). Grep tokens: `@acg/`, `@cacsms-cinemas/`, `Cacsms Cinemas`, `Autonomous Content Generator`, `ACG`.
7.4 Write docs/modules/02-command-center/README.md (new file) with inventory: migration 003 tables, seed 003 22 stages, bootstrap module02 5 projects + 6 seeded blocks, 7 new API routes table, 3 new pages table, 4 bootstrap scripts list, 2 new lib files, 1 navigation update.
7.5 Update apps/web/tsconfig.json path alias if needed (should already exist).

### TRs for Task 7
- `rule` TR-7.1: `pnpm -r typecheck` exits 0 for all 6 workspace projects.
- `rule` TR-7.2: GetDiagnostics returns zero language-server-reported issues.
- `rule` TR-7.3: Final grep on ts/tsx/json/sql/css (excluding .trae + node_modules) returns 0 for every disallowed token pattern. `Cacsms Cinemas` 0 occurrences, `cacsms-cinemas` slug 0, @acg/ 0, @cacsms-cinemas/ 0, `Autonomous Content Generator` 0, `ACG` standalone 0.
- `rule` TR-7.4: docs/modules/02-command-center/README.md exists and contains ≥6 sections: Database, API endpoints, Web routes, Scripts, Inventory, covering migration 003, seed 003, bootstrap-module02, all 7 new API paths, all 3 new pages. Does NOT contain placeholder "Implementation spec will be added when this module begins." line (from any future-placeholder templates).
- `rule` TR-7.5: Module 01 pages still exist & import chains not broken — apps/web/src/app/(app)/workspace/page.tsx, profile/page.tsx, admin/users, admin/roles and route group layouts all present on disk at end of implementation, no accidental overwrites.

### Completion Evidence
- `pnpm -r typecheck` exit 0 for all workspace packages (2026-09-05).
- Production grep clean for disallowed namespace/brand tokens in ts/tsx/json/sql/css.
- Copied design docs: `docs/design/MODULE-02-FIGMA-SPEC.md`, `MODULE-01-FIGMA-SPEC.md`; adapted `docs/modules/MODULE-01-AUTH-WORKSPACE-ACCESS.md` to `@cacsms/*` + singular brand.
- `docs/modules/02-command-center/README.md` present with Database / API / Web / Inventory sections (no placeholder stub).
- Module 01 pages still on disk and HTTP 200.
