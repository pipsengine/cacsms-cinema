# Module 01 — Authentication, Workspace & Access Control

Status: **Implemented foundation / production integration ready**

## Pages
1. `/login` — secure sign-in with API session creation and demo fallback for UI-only development.
2. `/forgot-password` — enumeration-safe password recovery request.
3. `/reset-password` — strong-password reset experience and token contract.
4. `/workspace` — role-aware workspace selector.
5. `/profile` — personal profile, password, MFA and active-session controls.
6. `/admin/users` — user directory, search/filter, status/MFA visibility and invite drawer.
7. `/admin/roles` — role catalogue and permission matrix.

## UX standard
- White enterprise SaaS canvas with restrained light-neutral page background.
- Consistent Cacsms Cinema blue accent.
- Responsive authenticated shell with workspace selector, grouped sidebar, search and account utilities.
- Status chips reserve green for active/completed, blue for invited/approval, amber for attention, red for suspended/failed, grey for neutral and purple for AI processing.

## MSSQL entities
Existing: `Workspaces`, `Users`, `Roles`, `WorkspaceUsers`.

Module 01 adds:
- `Permissions`
- `RolePermissions`
- `PasswordResetTokens`
- `UserSessions`
- `AuditEvents`
- `Users.LastLoginAt`
- `Users.MfaEnabled`
- `WorkspaceUsers.MembershipStatus`

## API contracts
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/workspaces`
- `POST /api/workspaces/select`
- `GET /api/admin/users`
- `GET /api/admin/roles`

Sessions are issued as HttpOnly cookies. Production enables the Secure cookie flag automatically when `NODE_ENV=production`.

## Bootstrap development administrator
The bootstrap script creates/links the development administrator using environment variables:

- `BOOTSTRAP_ADMIN_EMAIL=pipsengine@gmail.com`
- `BOOTSTRAP_ADMIN_PASSWORD=...`

Run after migrations and seeds:

```bash
pnpm --filter @cacsms/database db:migrate
pnpm --filter @cacsms/database db:seed
pnpm --filter @cacsms/database db:bootstrap
```

Change the bootstrap password before any shared or production deployment.

## Production hardening still provider-dependent
The application contract is ready for an SMTP/email provider and authenticator/TOTP provider. Before public production go-live, connect those providers, persist hashed reset tokens, rotate JWT secrets from a secret manager, enable TLS, enforce rate limits, and run dependency/security scans in CI.
