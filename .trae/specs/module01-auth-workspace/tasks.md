# Cacsms Cinema - Module 01 Auth & Workspace - Implementation Plan

## Task 1: Extend @cacsms/database with Module 01 schema, seed, and bootstrap
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Copy `packages/database/sql/migrations/002_module01_access_control.sql` from source (Permissions, RolePermissions, PasswordResetTokens, UserSessions, AuditEvents + Users.LastLoginAt/Users.MfaEnabled/WorkspaceUsers.MembershipStatus columns with idempotent IF guards).
  - Copy `packages/database/sql/seeds/002_permissions.sql` (MERGE 12 permission keys, grant everything to Super Admin via RolePermissions).
  - Add `packages/database/src/bootstrap-module01.ts` — idempotent upsert Super Admin user (`BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` env, defaults to `pipsengine@gmail.com` / `CacsmsDemo123!`), create workspace `cacsms-cinema` (singular), assign Super Admin role membership, bcrypt cost 12.
  - Update `@cacsms/database` package.json: add `dependencies.bcryptjs: ^3.0.2` and `scripts."db:bootstrap": "tsx src/bootstrap-module01.ts"`. Ensure exports carries `default` fallback condition.
  - Ensure `sql` directory is carried in package `"files"` field (already present).
- **Acceptance Criteria Addressed**: AC-5, AC-6
- **Test Requirements**:
  - `rule` TR-1.1: Migration and seed files exist at expected paths with correct filenames `002_module01_access_control.sql` and `002_permissions.sql`. Evidence: `ls` / glob output.
  - `rule` TR-1.2: `bootstrap-module01.ts` exists and package.json exposes `db:bootstrap` script plus `bcryptjs` dep. Evidence: file listing + package.json grep.
  - `rule` TR-1.3: SQL uses idempotent patterns (IF NOT EXISTS / MERGE / IF OBJECT_ID IS NULL / IF COL_LENGTH IS NULL) for every DDL/DML step. Evidence: grep for those tokens in both new SQL files.
  - `rule` TR-1.4: Permission key set equals the required 12 keys in AC-5. Evidence: grep of permission keys in 002_permissions.sql matching exactly: workspace.view, workspace.manage, users.view, users.manage, roles.manage, content.view, content.create, content.approve, agents.manage, integrations.manage, billing.view, audit.view.
  - `rule` TR-1.5: `pnpm --filter @cacsms/database build` exits 0 after the changes. Evidence: terminal command output.

## Task 2: Add new auth/service runtime files to @cacsms/api and update server.ts + package deps
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1 (because server.ts imports from @cacsms/database workspace; no runtime coupling but same namespace convention)
- **Description**:
  - Add `apps/api/src/auth.ts`: session types `SessionClaims`, `hashPassword`, `verifyPassword` (bcrypt cost 12), `signSession` (JWT 8h issuer `cacsms-cinema`), `readSession` (verify issuer), `requireSession` helper (reads cookie `cacsms_session` or Bearer auth, throws 401).
  - Add `apps/api/src/repository.ts`: MSSQL-backed data access functions `findUserByEmail`, `listMemberships`, `touchLogin`, `listUsers`, `listRoles`, `writeAudit`. Each uses `getDb/sql` from `@cacsms/database`.
  - Add `apps/api/src/smoke-test.ts`: single console.log confirming module 01 contracts present.
  - Replace `apps/api/src/server.ts` with the Module 01 server: register CORS + cookie plugins; global error handler (clamp 5xx); 10 endpoints: /health (module01:'ready'), POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me, GET /api/workspaces, POST /api/workspaces/select, GET /api/admin/users, GET /api/admin/roles, POST /api/auth/forgot-password, POST /api/auth/reset-password. Use `@cacsms/database` workspace import exclusively. Update service name to `cacsms-cinema-api` and version to `0.2.0`.
  - Update `apps/api/package.json`: add dependencies `@fastify/cookie: ^11.0.2`, `@fastify/cors: ^11.0.1`, `bcryptjs: ^3.0.2`, `jsonwebtoken: ^9.0.2`, `zod: ^3.25.76`. Add devDep `@types/jsonwebtoken: ^9.0.10`. Update scripts: `"test": "tsx src/smoke-test.ts"`. Ensure `"type": "module"` present and package name is `@cacsms/api`.
- **Acceptance Criteria Addressed**: AC-1, AC-6, AC-7
- **Test Requirements**:
  - `rule` TR-2.1: All 4 source files exist under apps/api/src with exact names: auth.ts, repository.ts, server.ts, smoke-test.ts. Evidence: glob.
  - `rule` TR-2.2: `server.ts` references only `@cacsms/database` (zero references to `@acg/` or `@cacsms-cinemas/` namespaces). Evidence: grep.
  - `rule` TR-2.3: Server source includes the 10 required endpoints with their HTTP verbs and paths. Evidence: grep for `/health`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/workspaces`, `/api/workspaces/select`, `/api/admin/users`, `/api/admin/roles`, `/api/auth/forgot-password`, `/api/auth/reset-password`.
  - `rule` TR-2.4: Security baseline applied: cookie `httpOnly:true, sameSite:'lax'`, `secure: NODE_ENV==='production'`; `bcrypt.hash(v, 12)` cost 12; Zod on every request body; error handler returns generic 500 message. Evidence: grep in source files for each marker.
  - `rule` TR-2.5: API package.json includes all new deps and the test script; `pnpm --filter @cacsms/api build` exits 0. Evidence: package.json listing + build output.

## Task 3: Rewire dependencies at the root and install + rebuild
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**:
  - Run `pnpm install` from monorepo root to hoist and link new deps (bcryptjs, jsonwebtoken, zod, fastify plugins, types).
  - Run `pnpm -r build` to build all workspace projects and confirm exit 0 (validates TR-1.5, TR-2.5, AC-6).
  - Add new env variables to both `.env` and `.env.example` at root:
    ```
    BOOTSTRAP_ADMIN_EMAIL=pipsengine@gmail.com
    BOOTSTRAP_ADMIN_PASSWORD=CacsmsDemo123!
    NEXT_PUBLIC_DEMO_MODE=true
    ```
  - Verify no `@acg/*` or `@cacsms-cinemas/*` namespace tokens remain in any .ts, .tsx or package.json (clean grep pass).
- **Acceptance Criteria Addressed**: AC-6, AC-7, NFR-2, NFR-3
- **Test Requirements**:
  - `rule` TR-3.1: Both env files contain BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, NEXT_PUBLIC_DEMO_MODE additions. Evidence: file grep.
  - `rule` TR-3.2: `pnpm install` exit 0 + `pnpm -r build` exit 0. Evidence: terminal output.
  - `rule` TR-3.3: Grep across repo excluding `.trae/` and `node_modules/` for `@acg/` or `@cacsms-cinemas/` returns zero matches. Evidence: grep result count.

## Task 4: Replace apps/web layout, root page, globals.css and add shared components (app-shell + ui + icons) + module01-data lib
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Replace `apps/web/src/app/layout.tsx` with Module 01 root metadata (template `%s · Cacsms Cinema`, description updated; naming follows singular Cinema).
  - Replace `apps/web/src/app/page.tsx` with redirect to `/login` (uses `next/navigation`).
  - Replace `apps/web/src/styles/globals.css` with the full Module 01 design-system CSS: root tokens (`--bg:#f7f9fc --surface:#fff ...`), auth layout split/hero, workspace chooser cards, app shell sidebar+topbar+page layout, stat cards, pills, data tables + toolbar + pagination, modals/drawers, roles two-pane + permissions matrix, responsive breakpoints (1100px, 760px). Naming stays consistent with "Cacsms Cinema" (singular) in any embedded strings.
  - Add `apps/web/src/components/app-shell.tsx` — `'use client'`, exports `<AppShell>`, brand mark `CC`, three nav groups (COMMAND, CONTENT OPERATIONS, ADMINISTRATION), active-path highlighting, sidebar footer user-mini, topbar search with kbd `⌘ K`, notifications badge, avatar. Eyebrow default `ACCESS CONTROL`.
  - Add `apps/web/src/components/ui.tsx` — exports `<Status>` (tone pill), `<StatCard>`, `<SectionCard>`.
  - Add `apps/web/src/components/icons.tsx` — exports `<Icon>` wrapper.
  - Add `apps/web/src/lib/module01-data.ts` — typed `UserStatus`, two demo workspaces, the 12 permissions, 5 role definitions, 5 user rows. All internal branding strings use "Cacsms Cinema".
  - Confirm `apps/web/tsconfig.json` already has `"paths": { "@/*": ["./src/*"] }` (it does; no edit required).
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-4
- **Test Requirements**:
  - `rule` TR-4.1: All new/updated files exist with exact paths: layout.tsx, page.tsx, globals.css, components/app-shell.tsx, components/ui.tsx, components/icons.tsx, lib/module01-data.ts. Evidence: glob.
  - `rule` TR-4.2: Root page.tsx contains `redirect('/login')` from next/navigation. Evidence: grep.
  - `rule` TR-4.3: CSS defines all 7 design tokens (`--bg, --surface, --line, --text, --muted, --blue, --green, --amber, --red, --purple`), `.app-shell` grid, `.auth-page`, `.workspace-page`, `.stat-card`, `.pill.*`, `.section-card`, `.table-card`, `.roles-layout` + `.permission-panel`, media breakpoints for 1100 and 760. Evidence: grep count.
  - `rule` TR-4.4: AppShell nav groups exactly COMMAND, CONTENT OPERATIONS, ADMINISTRATION with the specified items. Evidence: grep of the labels in app-shell.tsx.
  - `rubric` TR-4.5: Colour tokens, density and surface quality. Dimension: Visual fidelity of CSS to the Figma design spec; scale 1-5; anchors 1 = missing tokens / sidebar; 3 = usable but flat; 5 = matches AC-3 anchors (white surface, gradient brand mark, pill tones, card borders/shadows, breakpoint-responsive); threshold >= 4. Evidence: visual diff of design tokens + screenshot once server runs.

## Task 5: Add Next.js route groups (auth) and (app) with all six pages
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4
- **Description**:
  - Create route group `apps/web/src/app/(auth)/layout.tsx` (identity passthrough wrapper returning children).
  - Create 3 pages under `(auth)`:
    - `login/page.tsx`: `'use client'`, split layout login, brand "CC", email prefilled `pipsengine@gmail.com`, password prefilled `CacsmsDemo123!`, show-password toggle, fetch POST to `/api/auth/login` with `credentials:'include'`, on error and `NEXT_PUBLIC_DEMO_MODE==='true'` redirect to `/workspace`. Left panel "SECURE ACCESS" eyebrow + metrics hero. Footer "© 2026 Cacsms Cinema".
    - `forgot-password/page.tsx`: "ACCOUNT RECOVERY" → success state with checkmark orb; back link to /login.
    - `reset-password/page.tsx`: "SECURE PASSWORD RESET" with password rules box → success state → "Return to sign in" button.
  - Create route group `apps/web/src/app/(app)/layout.tsx` (identity passthrough wrapper returning children).
  - Create 4 pages under `(app)`:
    - `workspace/page.tsx`: "WORKSPACE ACCESS" eyebrow, two workspace cards from module01-data (c1 logo variant), card arrow, create workspace placeholder button, footer signed-in line.
    - `profile/page.tsx`: AppShell title "Profile & Security" with Save actions, two-column profile grid: SectionCard personal info + sign-in security list, sidebar of Account Access stack + Security activity timeline.
    - `admin/users/page.tsx`: AppShell title "Users" + Export + Invite actions, 4 KPI stats, search input + filters, table with avatar-cell, role badge, Status pill (green/blue/red by status), MFA enabled column, last activity, Invite drawer (modal backdrop, drawer with email/display name/role/MFA toggle).
    - `admin/roles/page.tsx`: AppShell title "Roles & Permissions", 2-pane roles-layout, role list (Super Admin selected by default), permission head, 3 summary boxes, permission matrix grouped, sticky footer bar with Save/Discard, all toggles disabled for Super Admin.
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-4
- **Test Requirements**:
  - `rule` TR-5.1: Directory tree exists: `(auth)/{layout,login,forgot-password,reset-password}` and `(app)/{layout,workspace,profile,admin/users,admin/roles}`. Evidence: tree / glob listing.
  - `rule` TR-5.2: Every page component imports AppShell (4 pages) or renders the matching auth layout variant (3 pages), and Next.js App Router renders without runtime path errors. Evidence: `next build` manifest includes these routes.
  - `rubric` TR-5.3: Page density and interactivity richness; Dimension: How well pages meet AC-4 anchors; scale 1-5; anchors 1 = basic scaffold; 3 = missing 1+ cards / tables / drawers; 5 = every KPI, pill, table, drawer, permission row and sticky bar present; threshold >= 4. Evidence: page.tsx source inspection of each file.

## Task 6: Stop old servers, start both new services, validate endpoints + routes
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3, Task 5
- **Description**:
  - Terminate any pre-existing API/web servers from the earlier session to avoid port conflicts.
  - Start `pnpm --filter @cacsms/web dev` on port 3000.
  - Start `pnpm --filter @cacsms/api dev` on port 4000.
  - Probe `/health` on 4000 to confirm AC-1 health body.
  - Probe 7 web routes on 3000 for HTTP 200: `/` (expect redirect to /login), `/login`, `/forgot-password`, `/reset-password`, `/workspace`, `/profile`, `/admin/users`, `/admin/roles`.
  - Run `pnpm --filter @cacsms/api test` (smoke-test.ts) to confirm message prints.
  - Open preview URL http://localhost:3000 so the user can browse.
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4, AC-6
- **Test Requirements**:
  - `rule` TR-6.1: `GET http://localhost:4000/health` returns status:ok, service:cacsms-cinema-api, truthy module01. Evidence: curl output.
  - `rule` TR-6.2: Web routes on port 3000 — / returns redirect; the rest return HTTP 200. Evidence: PowerShell `Invoke-WebRequest` status codes.
  - `rule` TR-6.3: API smoke test runs with exit 0 and prints the module 01 contract line. Evidence: terminal output.
  - `rubric` TR-6.4: Developer ergonomics — dimension: Does the browser preview load the shell correctly with brand CC, route groups, and page content? Scale 1-5; anchors 1 = crash / blank; 3 = renders but misstyled; 5 = clean shell, nav works, cards/tables visible, login redirect works; threshold >= 4. Evidence: screenshot evidence from browser.

## Task 7: Grep + typecheck + lint passes for final hygiene
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 6
- **Description**:
  - Run `pnpm -r typecheck` from root. All projects must pass (exit 0 or placeholder "ok/pending" message — no real TSC errors).
  - Run VS Code diagnostics on the changed files (GetDiagnostics) and confirm no red squiggles remain on integration files.
  - Final grep pass: confirm no "Autonomous Content Generator" or "ACG" / "@acg" / "Cacsms Cinemas" (plural) text remains in non-memory source files (docs under `docs/modules/01-auth-workspace/README.md` can stay as "Implementation spec coming soon" but new Module 01 source files must all use singular `Cacsms Cinema`).
  - Update `docs/modules/01-auth-workspace/README.md` to remove the "Implementation specification will be added when this module begins." placeholder line and replace with a short confirmation that Module 01 is implemented (routes list + schema pointer + page inventory) — this is the one allowable docs file edit for the integration.
- **Acceptance Criteria Addressed**: AC-6, AC-7
- **Test Requirements**:
  - `rule` TR-7.1: `pnpm -r typecheck` succeeds. Evidence: terminal output.
  - `rule` TR-7.2: GetDiagnostics on integration-scope files shows zero error-level findings. Evidence: GetDiagnostics result.
  - `rule` TR-7.3: Grep clean pass for disallowed tokens in source files (ts, tsx, json, sql, css). Evidence: grep output.
  - `rule` TR-7.4: `docs/modules/01-auth-workspace/README.md` no longer says "Implementation specification will be added when this module begins." Evidence: file content check.
