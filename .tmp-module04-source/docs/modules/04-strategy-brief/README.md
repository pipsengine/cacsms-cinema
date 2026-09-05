# Module 04 — Strategy & Content Brief

Module 04 converts the governed Content Project into the strategic source of truth consumed by Opportunity Discovery and all later production stages.

## Implemented pages

- `/strategy` — workspace-wide brief register and readiness dashboard.
- `/projects/:id/strategy` — complete strategy workspace with nine guided sections.
- `/projects/:id/strategy/versions` — immutable version history, review evidence and handoff governance.

## Input → process → output

**Input:** Content Project master record from Module 03.

**Process:** human/AI-assisted strategy definition → draft → version submission → mandatory human review → approve/return.

**Output:** **Approved Content Brief**. Approval creates a governed `ProjectVersions` snapshot and a `ProjectHandoffs` record from `STRATEGY_BRIEF` to `OPPORTUNITY_DISCOVERY` with status `READY`.

## Strategy model

The module captures objectives, audience segments, target markets, platform strategy, creative direction, story approach, voice, visual style, master duration/aspect ratio, CTA, monetisation intent, research focus, content restrictions, required/avoided elements, references, success definition and measurable success metrics.

## MSSQL entities

- `ContentBriefs`
- `ContentBriefVersions`
- `ContentBriefAudienceSegments`
- `ContentBriefPlatformStrategies`
- `ContentBriefReferences`
- `ContentBriefSuccessMetrics`

It also writes into the shared governance entities `ProjectApprovals`, `ProjectVersions`, `ProjectActivities`, `ProjectStageExecutions` and `ProjectHandoffs`.

## API

- `GET /api/strategy-briefs`
- `GET /api/projects/:projectId/strategy-brief`
- `PUT /api/projects/:projectId/strategy-brief`
- `POST /api/projects/:projectId/strategy-brief/submit`
- `POST /api/projects/:projectId/strategy-brief/decision`

## Human control

A draft may be edited freely. Submission creates a version and an approval request. Only an explicit `APPROVE` decision creates the downstream handoff. `RETURN` sends the brief back for changes. Approved strategy versions are treated as immutable; material changes must create a new review version.
