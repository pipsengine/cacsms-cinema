# Module 01 — Auth & Workspace

Module 01 ships the foundational identity, access-control, and workspace-chooser surface for Cacsms Cinema. Its contracts are safe to browse without a live MSSQL instance when `NEXT_PUBLIC_DEMO_MODE=true` is set in `.env`.

## Database

Migration: `packages/database/sql/migrations/002_module01_access_control.sql`
- Idempotent DDL using `IF COL_LENGTH IS NULL` / `IF OBJECT_ID IS NULL`
- Extends Users with `LastLoginAt`, `MfaEnabled`, `MembershipStatus`
- New tables: Permissions, RolePermissions, PasswordResetTokens, UserSessions, AuditEvents
- Indexes: `IX_AuditEvents_Workspace_Created`

Seed: `packages/database/sql/seeds/002_permissions.sql`
- Merges 12 permission keys (`auth.*`, `users.*`, `roles.*`, `workspaces.*`, `content.*`, `admin.*`)
- Grants every permission to the Super Admin role idempotently

Bootstrap: `pnpm --filter @cacsms/database db:bootstrap`
- Upserts a super administrator using `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` env vars (bcrypt cost = 12)
- Creates the workspace with slug `cacsms-cinema` and display name `Cacsms Cinema`
- Writes an `AUDIT_BOOTSTRAP` event on first run

## API endpoints (apps/api/src/server.ts v0.2.0)

| Method | Path                              | Contract                                                                |
|--------|-----------------------------------|-------------------------------------------------------------------------|
| GET    | /health                           | status ok, service=cacsms-cinema-api, module01=ready                    |
| POST   | /api/auth/login                   | Zod body `{email,password}`, httpOnly `cacsms_session` cookie, 8h TTL   |
| POST   | /api/auth/logout                  | Clears the session cookie                                               |
| GET    | /api/auth/me                      | Session -> user identity + lastLoginAt                                  |
| GET    | /api/workspaces                   | Session -> workspace membership list                                    |
| POST   | /api/workspaces/select            | Sets active workspace + role on the session token                       |
| GET    | /api/admin/users                  | Workspace-scoped user listing                                           |
| GET    | /api/admin/roles                  | Role listing joined with permissions                                    |
| POST   | /api/auth/forgot-password         | Recovery handoff (return safe acknowledgement regardless)               |
| POST   | /api/auth/reset-password          | Token + password reset accept hook                                      |

Security notes: bcrypt cost = 12, JWT issuer = `cacsms-cinema`, cookie is `httpOnly + lax`, body schemas use Zod, 5xx errors are clamped to a generic message.

## Web routes (apps/web — Next.js App Router)

Route groups:
- `(auth)` — Unauthenticated flows, no AppShell
- `(app)`  — Authenticated flows, wrapped by AppShell

| Route                      | Page purpose                                                         |
|----------------------------|----------------------------------------------------------------------|
| `/`                        | Server redirect → `/login`                                           |
| `/login`                   | Sign in with `pipsengine@gmail.com` / `CacsmsDemo123!` prefills; demo-mode bypass → `/workspace` |
| `/forgot-password`         | Recovery email entry + success orb                                   |
| `/reset-password`          | Password rules card, reset form, "Return to sign in" CTA             |
| `/workspace`               | Workspace chooser (cards from `@/lib/module01-data`), sign-out footer|
| `/profile`                 | Profile & Security — personal info, sign-in security, account access |
| `/admin/users`             | 4 KPI cards, search, user table with Status pill, Invite drawer      |
| `/admin/roles`             | Roles list + permission matrix + sticky save bar, Super Admin locked |

## Scripts

```
pnpm install
pnpm -r build
pnpm --filter @cacsms/web dev        # http://localhost:3000
pnpm --filter @cacsms/api dev        # http://localhost:4000
pnpm --filter @cacsms/api test       # smoke-test route contracts
pnpm --filter @cacsms/database db:bootstrap
```
