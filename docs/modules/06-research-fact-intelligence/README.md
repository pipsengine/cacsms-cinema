# Module 06 — Research & Fact Intelligence

Authoritative evidence packs for every selected content opportunity. Turns promoted opportunities into structured Research Packs with verified claims, approved sources, entities, statistics, timelines, contradictions and risks before a script is ever written.

## Database

**Migration:** `packages/database/sql/migrations/008_module06_research_fact_intelligence.sql`

Twelve `IF OBJECT_ID IS NULL` tables with FKs, `CHECK` constraints, and covering indexes:

| Table | Purpose |
|---|---|
| `ResearchPacks` | Head entity per project. `PackId`, `ProjectId`, `Version`, `Status` = {DRAFT,IN_REVIEW,SUBMITTED,APPROVED,RETURNED,FLAGGED}, `Objective`, `CoverageScope`, `ResearcherId`. |
| `ResearchPackVersions` | Snapshots per bump. `PackId` + `Version` PK; `SnapshotJson` and `Notes`. |
| `ResearchQuestions` | Guiding question list per pack, sortable. `SortOrder`, `QuestionText`, `Status` = {OPEN,PARTIAL,ANSWERED,CLOSED}. |
| `ResearchSources` | Evidence items captured. `SourceUrl ≤ 2048`, `Title`, `Author`, `AuthorityScore DECIMAL(5,2)`, `IsApproved BIT`. IX on PackId+IsApproved+AuthorityScore DESC. |
| `ResearchClaims` | Material statements used downstream. `ClaimCode ≤ 64` unique, `Statement`, `Materiality` = {HIGH,MEDIUM,LOW}, `Confidence DECIMAL(5,2)`, `IsVerified BIT`, `Status`. |
| `ResearchClaimSources` | Junction `ClaimId -> SourceId`, with optional `QuoteExcerpt ≤ 4000` and `LocationMarker ≤ 256`. |
| `ResearchStatistics` | Citable numbers. `StatLabel`, `Value DECIMAL(19,4)`, `Unit ≤ 64`, `SourceRef`, `PublishedDate`. |
| `ResearchEntities` | Fact graph nodes. `EntityType` = {PERSON,ORG,PRODUCT,EVENT,TOPIC,PLACE,OTHER}, `EntityName ≤ 256`, `WikipediaUrl ≤ 2048`, `Role ≤ 512`. |
| `ResearchTimelineEvents` | Chronological sequence. `SortOrder INT`, `EventDate DATE`, `EventLabel ≤ 256`, `Summary ≤ 2000`. |
| `ResearchContradictions` | Statement A vs Statement B tracker. `ResolutionStatus` = {OPEN,INVESTIGATING,RESOLVED,DISMISSED}, `ResolutionNote ≤ 4000`. |
| `ResearchRisks` | Governance grid. `RiskCode ≤ 64` unique, `Severity` CK {CRITICAL,HIGH,MEDIUM,LOW}, `Likelihood`, `Impact`, `Description ≤ 2000`. |
| `ResearchNotes` | Analyst capture. `NoteId PK`, `PackId FK`, `AuthorId FK Users`, `NoteBody NVARCHAR(MAX)`, `CreatedAt` default. |

**Bootstrap demo data:** `packages/database/src/bootstrap-module06.ts`

Requires Module 01 + 05 bootstrap (workspace `cacsms-cinema` and a `SELECTED` opportunity for Hidden AI / Content Code `CAC-2026-000124`). Populates:

- 2 `ResearchPacks` (AI Boss `000123` DRAFT + Hidden AI `000124` IN_REVIEW, Version 1)
- 2 `ResearchPackVersions` snapshots
- 10 `ResearchQuestions` across packs with ordered Open/Partial/Answered mix
- 8 `ResearchSources` (ArXiv + YouTube + regulatory + news), approved + authority mix
- 16 `ResearchClaims` with unique claim codes, materiality, confidence and verified bits
- 20+ `ResearchClaimSources` junction rows with quote excerpts
- 10 `ResearchStatistics` with units (USD %, hours, viewers, Mbps, etc.)
- 8 `ResearchEntities` (PERSON/ORG/PRODUCT/EVENT/TOPIC/PLACE)
- 10 `ResearchTimelineEvents` sort-ordered
- 3 `ResearchContradictions` (OPEN first → INVESTIGATING → RESOLVED order)
- 4 `ResearchRisks` (CRITICAL → HIGH → MEDIUM → LOW sorted)
- 2 `ResearchNotes` analyst captures

Run with: `pnpm --filter @cacsms/database db:bootstrap-module06`

## API endpoints (apps/api/src/server.ts — version 0.6.0)

10 Module 06 endpoints added. All body/path/query params use Zod; all writes call `writeAudit`; multi-record reads use the `(r.recordsets as any)` multi-query cast pattern for strict TS compatibility:

| Method | Path | Contract |
|---|---|---|
| GET | `/api/research-projects` | Workspace-scoped list of research projects; returns `{items: [...researchPackLite]}`. 409 if workspace bootstrap absent. |
| GET | `/api/projects/:projectId/research` | Zod uuid `projectId`. Returns 11 recordsets in one round-trip: pack + questions + sources + claims + claimSourceCount + statistics + entities + timeline sorted + contradictions (OPEN first) + risks (CRITICAL first) + versions. 404 if absent. |
| POST | `/api/projects/:projectId/research/start` | Zod uuid. Creates a new `DRAFT` ResearchPack for the project at Version 1 + inserts `ResearchPackVersions` baseline. Audit `RESEARCH_PACK_STARTED`. |
| PUT | `/api/projects/:projectId/research` | Zod uuid + body patch of objective/scope/questions text. Updates the draft pack + bumps the research edited-at audit. |
| POST | `/api/projects/:projectId/research/sources` | Zod uuid + body `{sourceUrl, title, author, authorityScore}`. Inserts a `ResearchSources` row (IsApproved=0). Audit `RESEARCH_SOURCE_ADDED`. |
| PATCH | `/api/projects/:projectId/research/claims/:claimId` | Zod uuid + `claimId` + body `{statement?, materiality?, confidence?, isVerified?, status?}`. Updates a single claim and refreshes evidence count; writes `RESEARCH_CLAIM_UPDATED`. |
| POST | `/api/projects/:projectId/research/submit` | Zod uuid. Flips `Status=SUBMITTED` + bumps `ResearchPackVersions` with submit note. Audit `RESEARCH_PACK_SUBMITTED`. |
| POST | `/api/projects/:projectId/research/decide` | Zod uuid + body `{decision: APPROVED\|RETURNED\|FLAGGED, reason?: ≤2000}`. Sets pack status, appends `ResearchPackVersions` with decision snapshot, inserts a `ResearchRisks` line if FLAGGED. |
| GET | `/api/projects/:projectId/research/facts` | View helper: returns claims + claimSourceCounts + statistics + entities join for downstream scripting. |
| GET | `/api/projects/:projectId/research/versions` | Lists `ResearchPackVersions` rows by project, newest first. |

`/health` returns:
```
{ status:'ok', service:'cacsms-cinema-api', version:'0.6.0',
  module01..06: 'ready' }
```

Smoke test: `pnpm --filter @cacsms/api test` prints Module 01..06 contracts.

## Web routes

AppShell groups now: COMMAND (3 live) · CONTENT OPS (2 live, 1 planned) · PRODUCTION PIPELINE (10 total: Strategy live, Opportunity live, **Research Studio live ↗**, Content Plan future, Script Studio future, Storyboard & Scene future, AI Asset Gen future, Edit & QA future, Packaging future, Approval & Release future). Sidebar chip: **`Module 06 · Research`**. Eyebrow default `CACSMS CINEMA`; brand title + workspace mini + breadcrumbs all use singular `Cacsms Cinema`.

| Route | Page | Purpose |
|---|---|---|
| `/research` | `apps/web/src/app/(app)/research/page.tsx` | Research & Fact Intelligence register. 4 KPI tiles (packs count, approved sources count, verified claims X/Y %, open risks). Research project grid with link → Open Research Studio, code + title, opportunity name, sources/claims/verification %/status pill. |
| `/projects/[id]/research` | `apps/web/src/app/(app)/projects/[id]/research/page.tsx` | Project Research Overview. 4-tab sub-nav (Overview / Facts / Sources / Versions). Overview renders: Research Questions ordered list with Open status badges, Approved sources count, Claims grid with evidence counts, Statistics inline table, Entities chips, Timeline rows sort-ordered, Contradictions (OPEN first), Risks grid (CRITICAL→LOW) with severity chips, and actions (Save draft · Submit for review · Decide dropdown). |
| `/projects/[id]/research/facts` | `apps/web/src/app/(app)/projects/[id]/research/facts/page.tsx` | Facts & Evidence page. Materiality filter + search. Claim tiles with statement + `ClaimCode` chip + materiality/confidence bars + verified pill + **Supporting evidence** panel listing source title + authority score + quote excerpt + source ⇗ link. Statistics strip + entity role chips inline. |
| `/projects/[id]/research/sources` | `apps/web/src/app/(app)/projects/[id]/research/sources/page.tsx` | Sources Registry. Segmented (ALL / APPROVED / UNAPPROVED). Source tiles: title + author + `AuthorityScore` slider, `Approved` toggle, URL link, Capture date, and **Claims using this source** back-reference list. Add Source drawer with URL/title/authority. |
| `/projects/[id]/research/versions` | `apps/web/src/app/(app)/projects/[id]/research/versions/page.tsx` | Versions & Decisions audit. Timeline strip of Version 1 → Version N with snapshot notes, SUBMITTED marker, APPROVED/RETURNED/FLAGGED chips and who decided. Decisions history table (Decision · Reason · By · At). |

Shared additions:
- `apps/web/src/components/app-shell.tsx` — Research Studio is 3rd live link in PRODUCTION PIPELINE at `/research` ↗.
- `apps/web/src/lib/module06-data.ts` — demo static fallback for `NEXT_PUBLIC_DEMO_MODE=true` covering demoResearchPacks, questions, sources, claims (with synthetic EvidenceCount), stats, entities, timeline, contradictions (OPEN first), risks (CRITICAL first).
- `apps/web/src/styles/globals.css` — `.research-register`, `.research-table-head/row`, `.research-kpis`, `.claim-tile`, `.claim-materiality`, `.evidence-list`, `.source-tile`, `.source-authority`, `.risk-tile` + severity classes (CRITICAL/HIGH/MEDIUM/LOW), `.contradiction-tile`, `.timeline-row`, plus responsive reflow for `≤1300px` and `≤760px`.

## Inventory

| Component | Files added/changed |
|---|---|
| Migration (idempotent) | `packages/database/sql/migrations/008_module06_research_fact_intelligence.sql` (12 tables, CKs, IXs) |
| Bootstrap | `packages/database/src/bootstrap-module06.ts` (2 packs, 10 questions, 8 sources, 16 claims, 10 stats, 8 entities, 10 timeline, 3 contradictions, 4 risks) |
| Database package scripts | `packages/database/package.json` adds `db:bootstrap-module06` alongside 01-05 |
| Repository layer | `apps/api/src/repository.ts` Module 06 block: 10 exported functions with `(r.recordsets as any)` multi-query pattern; import corrected to `@cacsms/database` |
| Fastify server | `apps/api/src/server.ts` imports + 10 routes; `/health` bumped `0.6.0`; `setErrorHandler (err:any, req, reply)` cast |
| Smoke test | `apps/api/src/smoke-test.ts` adds Module 06 contract line (6 total) |
| Shared UI | `apps/web/src/components/app-shell.tsx` — Research Studio live + `Module 06 · Research` chip + singular brand/eyebrow |
| Styles | `apps/web/src/styles/globals.css` — research tiles, claim/source/risk/contradiction classes, ≤1300/≤760 reflow |
| Demo data | `apps/web/src/lib/module06-data.ts` — research pack + facts/sources/versions fallback data |
| Pages | 5 new routes: `/research`, `/projects/[id]/research/{,facts,sources,versions}` |
| Auth mirror | `/auth/sign-in/page.tsx` mirrors `/login/page.tsx` so `/login → /auth/sign-in` 307 resolves cleanly in dev |
