# Module 03 — Content Projects

Module 03 establishes the governed **master content record** used by every downstream Cacsms Cinema module.

## Production pages

- `/projects` — project register with KPIs, search, filters, table/card views, live status and workflow progress.
- `/projects/new` — five-step project initiation wizard.
- `/projects/:id` — complete project workspace with Overview, Workflow, Assets, Versions, Approvals and Activity tabs.
- `/projects/:id/activity` — dedicated full activity/audit history and cross-stage handoff ledger.

## Initiation contract

Each project receives a unique `CAC-YYYY-######` content code and stores content type, primary platform, audience, markets, language, planned duration, aspect ratio, category, objective, creative direction, autonomy mode, priority, owner, deadline and generation budget.

Creation initializes all active workflow stages as `NOT_STARTED`; production begins only through the human workflow control already implemented in Module 02.

## Database

**Migration:** `packages/database/sql/migrations/005_module03_content_projects.sql`

Extends `ContentProjects` with production metadata and adds:

- `ProjectDistributionTargets`
- `ProjectCollaborators`
- `ProjectAssets`
- `ProjectVersions`
- `ProjectApprovals`
- `ProjectActivities`
- `ProjectHandoffs`

`ProjectHandoffs` is the cross-module lineage contract for Module 04+.

**Bootstrap (optional enrichment):** `pnpm --filter @cacsms/database db:bootstrap-module03`

## API endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/projects` | Search/filter list |
| POST | `/api/projects` | Create + seed 22 stages |
| GET | `/api/projects/:projectId` | Detail + distribution + collaborators |
| PATCH | `/api/projects/:projectId` | Metadata update |
| DELETE | `/api/projects/:projectId` | Soft archive |
| GET | `/api/projects/:projectId/assets` | |
| GET | `/api/projects/:projectId/versions` | |
| GET | `/api/projects/:projectId/approvals` | |
| GET | `/api/projects/:projectId/activity` | |
| GET | `/api/projects/:projectId/handoffs` | |

Health: `version:0.4.0`, `module03:'ready'`.

Stage Start/Pause/Resume/Stop remain on Module 02 `/api/command-center/projects/:id/*` routes.

## Scripts

```bash
pnpm --filter @cacsms/database db:migrate
pnpm --filter @cacsms/database db:bootstrap-module03
pnpm --filter @cacsms/api test
```
