# Cacsms Cinema - Module 01: Auth & Workspace Product Requirements Document

## Overview
- **Summary**: Production Module 01 implementing authentication, workspace selection, role-based access control (RBAC), user/role administration, profile & security settings, password recovery flow, audit event logging, and the authenticated App Shell navigation layout with Figma-style white enterprise UI.
- **Purpose**: Establish the access control perimeter every downstream module depends upon (identity, session, workspace context, roles, permissions, audit trail) while replacing the placeholder foundation UI with the real Module 01 authenticated experience.
- **Target Users**: Cinema production operators, content managers, creators, reviewers, viewers, and platform super admins.

## Goals
- Deliver cookie-based JWT session authentication (login/logout/me) with bcrypt password verification against MSSQL `dbo.Users`.
- Implement workspace-aware context: user selects workspace, session claims carry `workspaceId` + `role`, audit events are tagged to both.
- Deliver four authenticated pages: Workspace Chooser, Profile & Security, Users (Admin), Roles & Permissions (Admin).
- Deliver three unauthenticated pages: Login, Forgot Password (stubbed contract), Reset Password (stubbed contract).
- Ship the authenticated App Shell sidebar/topbar/page scaffolding used as the layout chassis for all subsequent modules.
- Extend MSSQL with Module 01 schema (Permissions, RolePermissions, PasswordResetTokens, UserSessions, AuditEvents, LastLoginAt, MfaEnabled, MembershipStatus) + seed the 12 permission keys and grant all to Super Admin.
- Provide a `db:bootstrap` helper that idempotently creates a Super Admin user + `cacsms-cinema` workspace + role membership for local development.
- Apply the design-system tokens (white BG `#FFFFFF`, dense cards, status pills, enterprise layout) per project conventions.
- Wire pages to API endpoints when a DB is available; fall back to demo mode navigation (no DB required to preview UI).

## Non-Goals
- OAuth/OIDC SSO integrations (Microsoft, Google, Okta) — out of scope.
- Real email delivery for password recovery (endpoints honour their contract; SMTP/provider integration happens in a later module).
- MFA challenge workflow (only display/flags are modelled; TOTP flow is Module 01+, not this pass).
- Invite-user lifecycle persistence (only the UI drawer is implemented in Module 01; the full invitation-token flow lands with the Administration module).
- Workspace creation persistence (only the create-placeholder button ships).
- Cross-page client-side state management via Zustand/TanStack Query (simple `fetch` + cookie contract is sufficient for Module 01).

## Background & Context
- Project conventions (`docs/design/DESIGN-SYSTEM.md` / user profile): white backgrounds, dense institutional layouts, `Africa/Lagos` timezone preference, sidebar-driven navigation, structured data layers API → Service → Hook → Component.
- Naming conventions enforced in target repository: package namespace `@cacsms/*`, project `Cacsms Cinema` (singular "Cinema"), database `CacsmsCinema`, bootstrap workspace slug `cacsms-cinema`. Source module uses `@cacsms-cinemas/*` / "Cacsms Cinemas" / `CacsmsCinemas` — the target's naming wins on integration.
- The existing foundation placeholder at `/` (layout.tsx + page.tsx) must be replaced by Module 01: `/` redirects to `/login`, the shell navigates under route group `(app)`, and unauthenticated routes live under `(auth)`.

## Functional Requirements
- **FR-1 Auth Session**: `POST /api/auth/login` accepts email+password (Zod-validated), looks up user via `dbo.Users`, verifies bcrypt hash, returns 401 for invalid/missing/inactive, issues 8h `cacsms_session` httpOnly cookie with JWT claims `{sub,email,workspaceId?,role?}`, writes AUTH_LOGIN audit event, touches `LastLoginAt`, returns user object + memberships list. `POST /api/auth/logout` clears the cookie. `GET /api/auth/me` requires a valid session and returns identity/mfa/last-login.
- **FR-2 Workspace Context**: `GET /api/workspaces` returns the calling user's workspace memberships (with role). `POST /api/workspaces/select` validates UUID workspaceId, ensures membership, issues a new JWT with `workspaceId` + `role` in claims, writes WORKSPACE_SELECTED audit event.
- **FR-3 Admin Contracts**: `GET /api/admin/users` returns members of the currently selected workspace (409 if workspace not yet selected). `GET /api/admin/roles` returns all roles × permission matrix with IsGranted indicators.
- **FR-4 Password Recovery Contracts**: `POST /api/auth/forgot-password` accepts email and always returns success (no account enumeration). `POST /api/auth/reset-password` accepts token + new password and returns success per contract.
- **FR-5 Health Advertisement**: `GET /health` returns module01 flag `ready` and service name `cacsms-cinema-api` v0.2.0.
- **FR-6 UI Routing & Route Groups**: App Router uses Next.js route groups `(auth)` (login, forgot-password, reset-password) and `(app)` (workspace, profile, admin/users, admin/roles) — each with its own layout wrapper. `/` redirects to `/login`.
- **FR-7 App Shell Navigation**: The authenticated sidebar exposes three nav groups — COMMAND (Command Center, My Work, Notifications), CONTENT OPERATIONS (Content Projects, Create Content, Content Calendar), ADMINISTRATION (Users, Roles & Permissions, Audit Trail, System Settings) — with active-path highlighting. Topbar has search, help, notifications, and avatar.
- **FR-8 Authenticated Pages**: Workspace chooser (2 cards with role/member-count/project-count/plan + create-placeholder); Profile & Security (personal info, sign-in security cards, account-access stack, security-activity); Users (4 stat cards, searchable table with role badge + MFA + status pill, Invite drawer); Roles & Permissions (two-pane role list + permission matrix with sticky save bar).
- **FR-9 Unauthenticated Pages**: Login (split layout with brand + copy + metrics hero + visual grid, demo-mode fallback), Forgot Password (email form → success state), Reset Password (password rules + success state).
- **FR-10 Design System Tokens**: CSS variable palette `--bg:#f7f9fc --surface:#fff --line:#e7ebf2 --text:#172033 --muted:#6f7b8f --blue:#155eef --green:#087a55 --amber:#b54708 --red:#c01048 --purple:#6938ef` with status pills, brand mark, cards, tables, drawers, stats grid, media-breakpoints at 1100px and 760px.
- **FR-11 DB Schema & Seed**: Migration `002_module01_access_control.sql` adds idempotent tables and columns (Permissions, RolePermissions, PasswordResetTokens, UserSessions, AuditEvents + LastLoginAt/MfaEnabled on Users, MembershipStatus on WorkspaceUsers). Seed `002_permissions.sql` MERGEs 12 permission keys and grants every permission to Super Admin via RolePermissions.
- **FR-12 Bootstrap**: `pnpm --filter @cacsms/database db:bootstrap` idempotently upserts a Super Admin user (email/password from env `BOOTSTRAP_ADMIN_*` with defaults `pipsengine@gmail.com` / `CacsmsDemo123!`), creates workspace `cacsms-cinema`, and assigns Super Admin role membership.
- **FR-13 Demo Mode**: `NEXT_PUBLIC_DEMO_MODE=true` on web lets login succeed without a live API (redirects to `/workspace`) so UI can be browsed without MSSQL running.

## Non-Functional Requirements
- **NFR-1 Build Integrity**: `pnpm -r build` succeeds for every workspace (types, config, database, ui, api, web) with exit code 0 after integration.
- **NFR-2 Dependency Hygiene**: New runtime deps are only `@fastify/cookie`, `@fastify/cors`, `bcryptjs`, `jsonwebtoken`, `zod` (API); `bcryptjs` (@cacsms/database) plus matching `@types/*` devDeps. Nothing else added.
- **NFR-3 Import Resolution**: All workspace package references use the target's `@cacsms/*` namespace (never `@acg/*` or `@cacsms-cinemas/*`). Exports fields carry `default` fallback.
- **NFR-4 ESM Correctness**: API package remains `"type": "module"`; shared packages expose ESM exports; dev servers start cleanly (`tsx watch` for API, `next dev` for web) with no `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- **NFR-5 Security Defaults**: Cookie `httpOnly`, `sameSite: lax`, `secure` only in production; JWT issuer `cacsms-cinema`; bcrypt cost factor 12; Zod input validation on all request bodies; error handler never leaks 500 stack traces to response.
- **NFR-6 Idempotent Database Scripts**: Every CREATE TABLE / ALTER TABLE / MERGE uses `IF NOT EXISTS` or equivalent pattern so `db:migrate` + `db:seed` are safe to re-run.
- **NFR-7 Accessibility & UX**: Inter/System UI font stack, focus rings via input:focus box-shadow, `kbd` hints for command palette, responsive breakpoints collapse sidebar below 760px and reflow stats grids below 1100px.

## Constraints
- **Technical**: Next.js 15 App Router, React 19, Fastify 5, TypeScript strict, Node >=22, pnpm workspaces, MSSQL client `mssql@^11`, bcryptjs@^3, jsonwebtoken@^9, zod@^3; CSS only (no Tailwind, no component library) for Module 01 design tokens.
- **Business**: No breaking changes to route group naming or package namespaces in target; any file already moved must stay moved; existing migration `001_foundation.sql` and seed `001_system_roles.sql` remain unmodified.
- **Dependencies**: Source module located at `C:\Users\Cacsms Limited\Downloads\cacsms-cinemas-module01\cacsms-cinemas\` is the integration source of truth but must be rewritten to target naming conventions.

## Assumptions
- A running MSSQL instance is optional for the Web preview; demo mode covers UI browsing. API will lazily connect only when an authenticated endpoint is called.
- The target repository already has `@cacsms/*` package naming, `"type": "module"` on API, and `exports` fields with `default` condition (actions executed earlier in this session).
- Local `.env` will be extended with `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `NEXT_PUBLIC_DEMO_MODE`; env-file edits are additive and non-destructive.

## Acceptance Criteria

### AC-1: Auth endpoint contract (rule)
- **Type**: `rule`
- **Given**: The API server is running on port 4000
- **When**: `GET /health` is called
- **Then**: The body must satisfy: `status === 'ok'`, `service === 'cacsms-cinema-api'`, and a truthy `module01` marker. Additionally `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/workspaces`, `POST /api/workspaces/select`, `GET /api/admin/users`, `GET /api/admin/roles`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` routes must be registered (verified by starting server and observing no 404 on those paths).
- **Pass Condition**: Observed above.
- **Evidence**: Server boot log showing listening + individual endpoint hits recorded during implementation self-verification; or 404-check curl output proving routes exist.

### AC-2: Web navigation chassis (rule)
- **Type**: `rule`
- **Given**: Web dev server on port 3000
- **When**: Browsing `/`
- **Then**: `/` 307/308 redirects to `/login`. Route groups `(auth)` and `(app)` must be present on disk. Pages `/login`, `/forgot-password`, `/reset-password`, `/workspace`, `/profile`, `/admin/users`, `/admin/roles` must exist and render without build errors.
- **Pass Condition**: All paths exist as TSX files; `next build` exits 0; runtime HTTP 200 on each route in dev.
- **Evidence**: Next.js build log + HTTP status check log per route.

### AC-3: App Shell layout (rubric)
- **Type**: `rubric`
- **Dimension**: Fidelity of the authenticated sidebar/topbar shell and page layout matching the Figma-style enterprise UI tokens.
- **Scale**: 1-5
- **Anchors**: 1 = missing shell, brand, or nav; 3 = shell present but missing groups or tokens; 5 = brand mark `CC`, three nav groups (COMMAND/CONTENT OPERATIONS/ADMINISTRATION), active state, user-mini footer, topbar with search + kbd hint + avatar + notifications, `#FFFFFF` surface, matching stat cards, pills, section cards.
- **Pass Threshold**: >= 4
- **Evidence**: Browser screenshot of `/profile` page showing shell + colour tokens; source-level proof that CSS variables and component class names match design.

### AC-4: Workspace, Profile, Users, Roles page richness (rubric)
- **Type**: `rubric`
- **Dimension**: Density and completeness of the four authenticated Module 01 pages.
- **Scale**: 1-5
- **Anchors**: 1 = placeholders only; 3 = pages exist with data but are missing cards, tables, or drawers; 5 = Workspace chooser has 2 workspace cards with role/member/project counts + create button; Profile has hero, personal-info form, security setting list with toggles, info-stack + activity; Users has 4 KPI stat cards, searchable table (role badge, MFA, status pill, pagination), Invite drawer; Roles has two-pane layout, permission summary boxes, grouped permission rows, sticky save actions.
- **Pass Threshold**: >= 4
- **Evidence**: Source snapshot of each page's JSX tree + page build output showing those pages are included in the Next.js build manifest.

### AC-5: MSSQL schema extension + seed + bootstrap (rule)
- **Type**: `rule`
- **Given**: Migration `002_module01_access_control.sql`, seed `002_permissions.sql`, `bootstrap-module01.ts` are present and wired into `@cacsms/database` scripts
- **When**: Scripts are applied against a CacsmsCinema DB
- **Then**: Tables Permissions, RolePermissions, PasswordResetTokens, UserSessions, AuditEvents are created; columns Users.LastLoginAt, Users.MfaEnabled, WorkspaceUsers.MembershipStatus are present; 12 permission rows MERGED; Super Admin has every permission granted; bootstrap script idempotently creates the admin user, cacsms-cinema workspace, and Super Admin role membership.
- **Pass Condition**: Scripts exist on disk with correct names; `@cacsms/database/package.json` exposes `db:bootstrap`; inspection of SQL text shows idempotent guards, correct permission keys (workspace.view, workspace.manage, users.view, users.manage, roles.manage, content.view, content.create, content.approve, agents.manage, integrations.manage, billing.view, audit.view), MERGE Super Admin grant, bootstrap with BCrypt hash + membership insert.
- **Evidence**: File listing + SQL grep hits; package.json script listing.

### AC-6: Dependency & build green (rule)
- **Type**: `rule`
- **Given**: Integration is finished
- **When**: `pnpm install` then `pnpm -r build` is executed from the monorepo root
- **Then**: Install exits 0; every workspace project builds with exit code 0; no `ERR_PACKAGE_PATH_NOT_EXPORTED` or import failures referencing `@acg/*` or `@cacsms-cinemas/*`.
- **Pass Condition**: Exit codes 0 for both commands; grep of build output confirms all projects.
- **Evidence**: Shell command captures.

### AC-7: Security + input validation baseline (rule)
- **Type**: `rule`
- **Given**: API server source is integrated
- **When**: Code and runtime are inspected
- **Then**: All body-accepting endpoints use Zod schemas; cookie uses httpOnly; bcrypt cost is 12; error handler clamps 5xx messages. All imports in API source reference the `@cacsms/*` namespace (never `@acg/*` or `@cacsms-cinemas/*`).
- **Pass Condition**: Text inspection passes on each point; no references to disallowed namespaces.
- **Evidence**: grep hits for Zod schema usage, cookie options, bcrypt cost, and namespace imports.

## Open Questions
- [x] Naming: use target repository conventions `@cacsms/*`, `Cacsms Cinema`, `CacsmsCinema`, workspace slug `cacsms-cinema` — answer confirmed in-session by existing rename work.
- [x] DB requirement: MSSQL is optional for UI preview (pages use demo mode static data). API is lazy-connect; DB setup is user-initiated — confirmed by prior run where API launched without MSSQL by using lazy pool.
