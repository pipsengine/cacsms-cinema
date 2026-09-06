# Module 14 — Platform Administration &amp; AI Infrastructure

> **Status:** Integrated
> **Release version:** `cacsms-cinema-api v0.14.0`
> **Bootstrap script:** `db:bootstrap-module14`
> **Migration file:** `016_module14_platform_administration.sql`

Module 14 closes the upstream pipeline with a cross-cutting administration and governance layer that operationalises the earlier content modules. Agents, workflows, provider integrations, budgets, audit, notification policies, backup and system health are exposed to the operations team through 15 static `/admin/*` pages while repository/API clients can inspect and save records through the 12 new endpoints below.

---

## 1. Database — 9 tables + 5 indexes

All tables live in the `dbo` schema and carry `WorkspaceId` (tenant isolation) plus `CreatedAt`/`UpdatedAt` timestamps. Idempotent DDL uses `IF OBJECT_ID(N'dbo.TableName','U') IS NULL` so migrations can be re-run on any environment without risk.

| # | Table | Purpose | Unique key |
|---|-------|---------|------------|
| 1 | `AgentDefinitions` | Registered AI agent blueprints (key, purpose, model, status, queue depth, last heartbeat) | `WorkspaceId, AgentKey` |
| 2 | `WorkflowConfigurations` | Published 21-stage workflow versions mirroring the PRODUCTION PIPELINE stages | `WorkspaceId, WorkflowKey, VersionNo` |
| 3 | `ProviderIntegrations` | LLM, video, image, audio and social provider connection metadata + `Status` / last sync | `WorkspaceId, ProviderKey` |
| 4 | `ProviderBudgets` | Monthly provider `BudgetAmount` / `SpentAmount` / `HardLimit` / currency controls | `WorkspaceId, ProviderKey, PeriodKey` |
| 5 | `AssetCatalog` | Master registered assets `AssetType` (IMAGE / VIDEO / AUDIO / THUMBNAIL / SCRIPT) with SHA and size | `AssetId` PK |
| 6 | `NotificationPolicies` | Severity-aware notification rules with channel + enabled flag | `WorkspaceId, PolicyKey` |
| 7 | `SystemSettings` | `SettingKey` → `SettingValue` key/value store for workspace, generation, publishing & retention defaults | `WorkspaceId, SettingKey` |
| 8 | `BackupRuns` | `BackupType` (FULL / TLOG / ASSET / CONFIG) with `SourcePath`, `Target`, size, verified timestamp | `BackupRunId` PK |
| 9 | `ServiceHealthChecks` | Per-service probe rows for WEB / API / MSSQL / Worker / Video / Publishing / Analytics status | `WorkspaceId, ServiceKey, CheckedAt` |

### 1.1 Index inventory (5)

| Name | Table | Columns |
|------|-------|---------|
| `IX_AgentDefinitions_Workspace_AgentKey` | `AgentDefinitions` | `WorkspaceId, AgentKey` |
| `IX_WorkflowConfigurations_Workspace_Active` | `WorkflowConfigurations` | `WorkspaceId, IsActive DESC, VersionNo DESC` |
| `IX_ProviderBudgets_Workspace_Period` | `ProviderBudgets` | `WorkspaceId, PeriodKey, ProviderKey` |
| `IX_AssetCatalog_Workspace_Type_Approved` | `AssetCatalog` | `WorkspaceId, AssetType, ApprovedAt DESC` |
| `IX_ServiceHealthChecks_Workspace_Service_Latest` | `ServiceHealthChecks` | `WorkspaceId, ServiceKey, CheckedAt DESC` |

---

## 2. API — 12 new endpoints

All endpoints return Fastify 2xx when MSSQL is reachable and row-affecting operations accept `application/json` bodies validated through the Zod schemas in `server.ts`.

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/admin/operations` | Returns 8 parallel result sets (agent fleet, providers, budgets, catalog summary, policies, settings, audit preview, latest backups, latest health) — uses per-query `.recordset` destructuring. |
| `PUT`  | `/api/admin/agents` | `saveAgentDefinition` — MERGE upsert by `WorkspaceId + AgentKey`; toggles `IsActive` and stores `DefaultModel`, `Concurrency`, `HeartbeatAt`. |
| `POST` | `/api/admin/workflows/publish` | `publishWorkflowConfiguration` — snapshots the 21-stage definition, bumps `MAX(VersionNo)+1`, demotes previous `IsActive=1`, inserts new ACTIVE row, returns new `VersionNo`. |
| `PUT`  | `/api/admin/integrations` | `saveProviderIntegration` — MERGE by `WorkspaceId + ProviderKey`, stores `AuthType`, `Endpoint`, `Status = NOT_CONNECTED / CONNECTED / ERROR`, `LastSyncedAt`. |
| `PUT`  | `/api/admin/budgets` | `saveProviderBudget` — MERGE by `WorkspaceId + ProviderKey + PeriodKey`, tracks `BudgetAmount`, `SpentAmount`, `HardLimit`, `CurrencyKey`. |
| `PUT`  | `/api/admin/notification-policies` | `saveNotificationPolicy` — MERGE by `WorkspaceId + PolicyKey`, severity-based routing, `IsEnabled`, `ChannelConfig` (json). |
| `PUT`  | `/api/admin/settings` | `saveSystemSettings` — array batch MERGE, one row per `SettingKey`, used by Workspace name, Generation controls, Publishing defaults, Data retention. |
| `GET`  | `/api/admin/audit` | `listAdminAudit` — `LEFT JOIN Users` for actor name/email, `TOP 200` ordered `OccurredAt DESC`. |
| `POST` | `/api/admin/assets` | `registerAdminAsset` — `INSERT OUTPUT AssetCatalog` for master-approved assets with SHA-256, size, MIME, ApprovedBy. |
| `POST` | `/api/admin/backups` | `recordBackupRun` — inserts backup manifest, sets `VerifiedAt = SYSUTCDATETIME` when body `@verified = 1`. |
| `POST` | `/api/admin/health-checks` | `recordServiceHealth` — inserts per-service health probe with latency, status and optional note JSON. |

Health summary lives on the existing root endpoint: `/health` returns `{ version: "0.14.0", module14: "ready" }` alongside the `module01`…`module13: "ready"` status keys.

---

## 3. Web UI — 15 admin pages

The side navigation now exposes 14 LIVE admin hrefs grouped under three new sections (old single ADMIN group removed).

### 3.1 Navigation structure

```
AI & AUTOMATION          OPERATIONS               GOVERNANCE & SECURITY
  ◫  Platform Admin        $  Usage & Cost Ctr       ♙   Users
  ✦  Agent Control         ▣  Asset Library          ⌘   Roles & Permissions
  ⌘  Workflow Designer     ♡  System Health          ≡   Audit Trail
  ↔  Integrations                                    ◌   Notification Rules
                                                     ◆   Security
                                                     ↻   Backup Recovery
                                                     ⚙   System Settings
```

### 3.2 Admin pages inventory

| Route | Page | Key components |
|-------|------|----------------|
| `/admin/operations`     | Platform Administration Overview | 4 stat cards, agent fleet status grid, 7 service health rows, 12-tile admin map |
| `/admin/agents`         | Agent Control                    | Enterprise-table 9 agents, Online/Running/Degraded/Waiting tone map, queue/safety/guardrails 3-col |
| `/admin/workflows`      | Workflow Designer                | WorkflowAdminList 21-order-badge grid, SLA column, 6-tile governance map |
| `/admin/roles`          | Roles &amp; Permissions          | Client-component role selector, sticky-actions bar, permission matrix from `module01-data.roles/.permissions` |
| `/admin/users`          | Users                            | Client-component invite drawer, query state, MFA badge, Active/Invited/Suspended tone cast |
| `/admin/integrations`   | Integrations (hub)               | 8-card `integration-grid`; group split AI ✦ vs SOCIAL ↗ provider chips, Status pill NOT_CONNECTED grey |
| `/admin/integrations/ai`        | AI Providers            | AI rows filtered, ProviderDetail 6 `provider-contract` spans, credential policy map 4-tile |
| `/admin/integrations/platforms` | Social &amp; Publishing | SOCIAL rows filtered, enterprise-table, publishing-scopes vs analytics-scopes two-col |
| `/admin/notification-rules`     | Notification Rules     | Enterprise-table 6 rules, Enabled green / Disabled grey, CRITICAL=red / WARNING=amber / INFO=blue severity |
| `/admin/costs`                  | Usage &amp; Cost Center | 4 stat cards, costRows progress bar inline width, trend +/- amber/green |
| `/admin/assets`                 | Asset Library          | Enterprise-table 5 approved master assets, filter-row buttons All / Master / Images / Video / Audio |
| `/admin/health`                 | System Health          | Enterprise-table 7 services, green SYSTEM OPERATIONAL header, degraded rows amber tone |
| `/admin/audit`                  | Audit Trail            | Enterprise-table action `<code>` cells, actor IP column, search-inline filter box |
| `/admin/security`               | Security Posture       | 3 SectionCards (Authentication / Secrets / Data protection), admin-row 6 posture indicators PASSED / NEEDS REVIEW |
| `/admin/backup`                 | Backup &amp; Recovery  | Run backup / Verify latest actions, 3 detail cards Recovery objectives / Restore tests / DR exercises |
| `/admin/settings`               | System Settings        | 4 settings-form cards: workspace name, generation controls, publishing defaults, data retention |

All 15 pages include the `AdminTabs` 12-link pill strip (Overview → Agents → Workflow → Integrations → Usage &amp; Cost → Assets → Audit → Notifications → Security → Backup → Health → Settings) for fast lateral navigation.

---

## 4. Upstream ↔ downstream handoffs

### 4.1 Inbound dependencies (from earlier modules)

| Producer module | Artefact | Consumer in M14 | How consumed |
|-----------------|----------|-----------------|--------------|
| **M12 – Approval &amp; Publishing** | `Publications.ExternalId` (Youtube/Instagram/X IDs + `PublishedAt`) | Audit trail + analytics admin views | Correlates agent job receipts with final published external IDs, powers `listAdminAudit` publication join. |
| **M13 – Analytics &amp; AI Learning** | `PublicationAnalytics.MetricsSnapshot`, audience/recycling/learning rows | Provider budgets (`ProviderBudgets.SpentAmount` cost-rollup + cost progress bar) | Performance-weighted budget attribution by provider; feeds `/admin/costs` trend and `/admin/integrations/*` health status. |

### 4.2 Outbound governed feeds (to future operational modules)

| Governor in M14 | Output | Controls downstream behaviour |
|-----------------|--------|-------------------------------|
| `AgentDefinitions.IsActive + Concurrency` | Agent execution policy | Future orchestration worker — agent cannot run unless active + within concurrency budget. |
| `ProviderBudgets.BudgetAmount / HardLimit` + `PeriodKey` | Monthly spend cap | Generation jobs in M09 refuse provider calls once the budget row `SpentAmount >= BudgetAmount` (hard stop at `HardLimit`). |
| `WorkflowConfigurations.IsActive + VersionNo` | Stage gate contracts | Every M07–M12 production stage compares its order against the active workflow config; version bump audits old vs new. |
| `NotificationPolicies.ChannelConfig + IsEnabled` | Alert routing | Publishing / health / anomaly events from M09/M10/M12/M13 route per matching severity policy. |
| `BackupRuns.BackupType + VerifiedAt` | Disaster-recovery rotation | Weekly FULL, hourly TLOG, nightly ASSET, daily CONFIG schedules; verified rows are eligible for DR restore drills. |

### 4.3 DR objectives (documented for Operations runbook)

| Recovery target | RPO | RTO | Verification cadence |
|-----------------|-----|-----|----------------------|
| MSSQL user data | 1 hour (TLOG + FULL) | 4 hours | Monthly restore drill |
| Master assets (AssetCatalog) | 24 hours (ASSET type) | 8 hours | Quarterly hash re-check |
| Workspace configuration | 1 day (CONFIG type) | 4 hours | Monthly settings diff |
| Agent + provider keys | 7 days (CONFIG, encrypted) | 2 hours | Weekly secret rotation smoke |

---

## 5. Health &amp; readiness

- `GET /health` → `{"version":"0.14.0","module01..module14":"ready"}`
- `node apps/api/dist/smoke-test.js` prints exactly **14** lines, Module 01 → Module 14.
- Recursive typecheck + build (`pnpm -r typecheck && pnpm -r build`) both exit 0.
- 16 admin routes plus 9 pipeline regressions all answer HTTP 200 in demo mode with `NEXT_PUBLIC_DEMO_MODE=true`.
