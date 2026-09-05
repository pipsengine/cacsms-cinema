# Module 05 — Opportunity Intelligence

Always-on, signal-driven discovery of angles, formats and audiences for each content project. Turns the Strategy & Content Brief into a ranked opportunity feed, then stores every decision (promote, archive, shortlist) alongside the evidence used.

## Database

**Migration:** `packages/database/sql/migrations/007_module05_opportunity_intelligence.sql`

Five `IF OBJECT_ID IS NULL` tables with FKs, checks and covering indexes:

| Table | Purpose |
|---|---|
| `OpportunityDiscoveryRuns` | Triggered snapshot (per project, per workspace); tracks RUNNING/SUCCESS/FAILED and a JSON `SignalSummary` of trend/platform/provider inputs. |
| `ContentOpportunities` | Ranked idea per project: `SignalSource`, `FormatType`, `Title`, `Description`, `AudienceInsight`, `OpportunityScore`, `ConfidenceScore`, `Status` = {DISCOVERED, SHORTLISTED, PROMOTED, ARCHIVED, REJECTED}, `IsSaved` bit, plus IX on workspace/project/status/score DESC. |
| `OpportunityTrendSignals` | Per-opportunity evidence rows: `TrendTopic`, `Platform`, `Volume`, `GrowthPct`, `SourceUrl`, `RelevanceScore`, `SignalDate`. |
| `OpportunityAudienceScores` | Per-opportunity segment scores: `SegmentName`, `ReachPotential`, `EngagementScore`, `PreferenceFit`, `SentimentPct`, `GeoMarket`. |
| `OpportunityDecisions` | Full audit trail: `Decision = SAVE|PROMOTE|SHORTLIST|REJECT|ARCHIVE`, `DecisionReason` ≤ 2000, `DecisionBy` user, `ProjectedImpactJson` ≤ MAX. |

**Bootstrap demo data:** `packages/database/src/bootstrap-module05.ts`

Requires Module 01 bootstrap user + workspace `cacsms-cinema`. Populates:
- 2 `OpportunityDiscoveryRuns` (one SUCCESS for Hidden AI / 000124, one RUNNING for AI Boss / 000123)
- 8 `ContentOpportunities` (4×YouTube long-form, 3×Shorts, 1×IG Reel) across projects 000121..000124 with varying OpportunityScore 62–91, mix of DISCOVERED / SHORTLISTED / PROMOTED / SAVED flags
- 12 `OpportunityTrendSignals` (YouTube/Shorts/TikTok/LinkedIn/IG)
- 8 `OpportunityAudienceScores` (Gen-Z-Nigeria, Gen-Z-Kenya, Millennials-SA, etc.)
- 3 `OpportunityDecisions` (SAVE + PROMOTE + ARCHIVE with reasons)

Run with: `pnpm --filter @cacsms/database db:bootstrap-module05`

## API endpoints (apps/api/src/server.ts — version 0.5.0)

7 Module 05 endpoints added:

| Method | Path | Contract |
|---|---|---|
| GET | `/api/opportunity-projects` | 409 if workspace absent; workspace-scoped opportunity-linked project register. |
| GET | `/api/projects/:projectId/opportunities` | Zod uuid + optional `{status? ≤30, search? ≤200}` query; returns ranked `{items}`. |
| POST | `/api/projects/:projectId/opportunities/discovery` | Zod uuid + optional body; triggers a new `OpportunityDiscoveryRuns` row SUCCESS snapshot with signal summary JSON; writes audit `DISCOVERY_RUN_STARTED`. |
| GET | `/api/opportunities/:opportunityId` | Zod uuid; full opportunity + trend signals + audience scores join. 404 if missing. |
| POST | `/api/opportunities/:opportunityId/save` | Zod uuid; toggles `IsSaved=1` + writes SAVE `OpportunityDecisions` row. Returns saved entity. |
| POST | `/api/opportunities/:opportunityId/promote` | Zod uuid; moves `Status=PROMOTED` + inserts PROMOTE decision with projectedImpact payload. audit `OPPORTUNITY_PROMOTED`. |
| POST | `/api/opportunities/:opportunityId/decide` | Zod uuid + body `{decision: SAVE\|PROMOTE\|SHORTLIST\|REJECT\|ARCHIVE, reason?: ≤2000}`. Generic decision path (covers /saved workflow). |

All writes use writeAudit; all paths Zod-parse uuid + body. `/health` returns:
```
{status:'ok', service:'cacsms-cinema-api', version:'0.5.0', module01..05: 'ready'}
```

Smoke test: `pnpm --filter @cacsms/api test` now prints Module 01..05 contracts.

## Web routes

AppShell now runs 4 nav groups, with Opportunity Intelligence live in PRODUCTION PIPELINE (second slot, after Strategy & Brief). Sidebar chip: `Module 05 · Opportunity`.

| Route | Page | Purpose |
|---|---|---|
| `/opportunities` | `apps/web/src/app/(app)/opportunities/page.tsx` | Full Opportunity register. 5-tab segments (ALL / DISCOVERED / SHORTLISTED / PROMOTED / ARCHIVED), + Format segmented (YouTube / Shorts / Reels / TikTok / Feed), score bars (Opportunity + Confidence), save ⭐, promote ⇧, view details →, discovery-run header, promote modal with projected impact. |
| `/opportunities/saved` | `apps/web/src/app/(app)/opportunities/saved/page.tsx` | Shortlist only. Compact saved-cards with remove. |
| `/opportunities/[opportunityId]` | `apps/web/src/app/(app)/opportunities/[opportunityId]/page.tsx` | Deep detail: Title + insight + 2× KPI tiles (Opportunity score, Confidence), Trend Signals table (volume / growth / relevance), Audience scores grid (ReachPotential / Engagement / Fit / Sentiment), 4-action toolbar (Save / Promote / Shortlist / Reject / Archive), decision reason field, breadcrumb Cacsms Cinema › OPPORTUNITY INTELLIGENCE › Title. |
| `/projects/[id]/opportunities` | `apps/web/src/app/(app)/projects/[id]/opportunities/page.tsx` | Per-project tab: overview + 4 KPI tiles, 8 segmented cards in grid, Run Discovery ⟳ primary, Save + Promote actions. |

All pages read `/api/opportunity-projects`, `/api/projects/:id/opportunities`, `/api/opportunities/:id` via [lib/api.ts](file:///c:/Trading-Engine/cacsms-cinema/apps/web/src/lib/api.ts) and fall back to [module05-data.ts](file:///c:/Trading-Engine/cacsms-cinema/apps/web/src/lib/module05-data.ts) when API is unavailable.

## Inventory

- **New DB migration:** `007_module05_opportunity_intelligence.sql` (5 tables + FK/CK/IX)
- **New bootstrap:** `bootstrap-module05.ts` with `db:bootstrap-module05` in package scripts
- **New repository exports in repository.ts:** `listOpportunityProjects, listOpportunities, getOpportunity, createDiscoveryRun, decideOpportunity`
- **New API routes in server.ts:** 7 (GET×3, POST×4) — health now carries `module05:'ready'`
- **New lib data file:** `module05-data.ts`
- **New web pages:** 4 (`/opportunities`, `/opportunities/saved`, `/opportunities/[opportunityId]`, `/projects/[id]/opportunities`)
- **AppShell sidebar:** PRODUCTION PIPELINE gains live Opportunity Intelligence link; chip updated to `Module 05 · Opportunity`
- **globals.css:** new opportunity-*, score-bar, segments, format-chip, trend-row, audience-cell, promote-modal, decision-reason styles plus ≤1300/≤760 reflow.
