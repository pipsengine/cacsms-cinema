# Module 12 — Approval & Publishing

Consumes the upstream Approved PackagingVersion (Module 11 Thumbnail, SEO & Platform Packaging) signed PACKAGING_PACKAGE contract and delivers a two-step approval chain (Content Review → Final Publisher), governed release checks with blocking gates, platform publishing connection health, publish job queuing and retries, publication identity capture, and release activity feed that writes a signed PUBLICATION contract downstream to Module 13 Performance Monitoring. Every ReleaseProject auto-creates when an APPROVED PackagingVersion exists and no ReleaseProject yet. APPROVE decisions block on unresolved blocking checks + earlier step completion. Publish jobs require overall ReleaseStatus === 'APPROVED' before QUEUE/RETRY actions. Publication capture creates the PERFORMANCE_MONITORING handoff.

## Database

**Migration:** `packages/database/sql/migrations/014_module12_approval_publishing.sql` (source `013_module12.sql` renumbered because target migration 013 already holds Module 11 Packaging; byte-immutable idempotent).

Eight `IF OBJECT_ID IS NULL` tables wrapped in `SET XACT_ABORT ON · BEGIN TRANSACTION … COMMIT`. No extra indexes — all UNIQUE/FK constraints inline with inline table create.

| Table | Purpose |
|---|---|
| `ReleaseProjects` | Head per content project. `WorkspaceId · ContentProjectId UNIQUE FK ContentProjects. `PackagingVersionId FK → PackagingVersions(M11)` — locked contract anchor APPROVED packaging signed package. `ReleaseStatus ∈ {AWAITING_APPROVAL, APPROVED, IN_PUBLISHING, PUBLISHED, RETURNED, LOCKED}`. `CurrentPublishProgressPercent DECIMAL(5,2) 0→100`. `ApprovalChainStage INT DEFAULT 1` (1=Content Review, 2=Final Publisher). `PublicationId NULLABLE FK → Publications. Created/UpdatedAt. |
| `ReleaseApprovalSteps` | Approval chain rows. `ReleaseProjectId FK`. UNIQUE(ReleaseId, StepOrder). `StepOrder INT (1 or 2)`. `StepKey ∈ {CONTENT_REVIEW, FINAL_PUBLISHER}`. `StepStatus ∈ {PENDING, IN_PROGRESS, APPROVED, RETURNED, LOCKED}`. `AssignedToUserId / ApproverUserId FK Users. Comment NVARCHAR(2000). DecidedAt. Created/UpdatedAt. |
| `ReleaseChecks` | QA + blocking audit. `ReleaseProjectId FK`. UNIQUE(ReleaseId, CheckKey). `CheckKey ∈ {RELEASE_CONTENT_REVIEW, RELEASE_PACKAGE_SIGNED, RELEASE_PLATFORM_READY, RELEASE_THUMBNAIL_PRIMARY, RELEASE_METADATA_COMPLETE, RELEASE_CLAIM_COMPLIANCE, RELEASE_RIGHTS_CLEARANCE, RELEASE_PUBLISH_CONSENT}` 8 families. `CheckName · Category · Severity`. `Status ∈ {NOT_RUN, PASSED, FAILED, NEEDS_REVIEW}`. `IsBlocking BIT`. `Evidence NVARCHAR(MAX)`. `ResolvedBy/At FK Users. Created/UpdatedAt. |
| `PublishingConnections` | Platform OAuth/API connections. `WorkspaceId FK`. UNIQUE(WorkspaceId, Platform). `Platform ∈ {YouTube, YouTube_Shorts, TikTok, Instagram, Facebook, X}` enum match M11 MetadataPackages`. `ConnectionStatus ∈ {NOT_CONNECTED, CONNECTED, EXPIRED, REVOKED, HEALTHY}`. `AccountLabel NVARCHAR(200) singular Cacsms Cinema not Cinemas (account visible name. ScopesJson NVARCHAR(MAX). AccessTokenExpiresAt DATETIME2. LastHealthCheckedAt DATETIME2. Created/UpdatedAt. |
| `PublishJobs` | Per-platform publish unit of work. `ReleaseProjectId FK`. UNIQUE(ReleaseId, JobKey). `JobCode NVARCHAR(60). Platform enum same as connections. ContentFormat enum PlatformPackages match M11: LONG_FORM/SHORT_FORM/REEL/STORY/POST/THREAD. ExternalPlatformPackageId FK → PlatformPackages(M11) nullable. `JobStatus ∈ {DRAFT, SCHEDULED, QUEUED, IN_PROGRESS, PUBLISHED, FAILED, BLOCKED, CANCELLED}. ScheduledPublishAt DATETIME2 nullable. PublishUrl NVARCHAR(1000) populated post-publish. ExternalJobId NVARCHAR(200). RetryCount INT DEFAULT 0. MaxRetries INT DEFAULT 3. Created/UpdatedAt. |
| `PublishJobAttempts` | Attempt ledger per job. `PublishJobId FK → PublishJobs`. AttemptNumber INT. AttemptStatus ∈ {STARTED, SUCCESS, FAILED}. StartedAt. CompletedAt NULLABLE. ProviderMessage NVARCHAR(MAX). ErrorDetail NVARCHAR(MAX). CreatedAt. |
| `Publications` | Immutable signed publication identity. `ReleaseProjectId FK`. UNIQUE(ReleaseId, PublicationKey). `PublicationCode NVARCHAR(60). Status ∈ {PENDING, PUBLISHED, WITHDRAWN}. PublishedPlatformCount INT. FirstPublishedAt DATETIME2 NULLABLE. PublicationManifestJson NVARCHAR(MAX) snapshot of all PublishJobs PUBLISHED rows + URLs. ExternalPublicationId NVARCHAR(200) nullable becomes the Performance Monitoring handoff identity. CreatedAt. |
| `ReleaseActivities` | Append-only activity feed. `ReleaseProjectId FK`. ActorUserId FK Users. ActivityKey ∈ {RELEASE_CREATED, STEP_DECIDED, CHECK_UPDATED, CONNECTION_TESTED, JOB_QUEUED, JOB_STATUS, PUBLICATION_REGISTERED, PUBLICATION_HANDOFF}. Detail NVARCHAR(MAX). CreatedAt. |

**Bootstrap demo data:** `packages/database/src/bootstrap-module12.ts`

Requires Module 01 workspace `Slug = 'cacsms-cinema'` and Module 11 `PackagingVersions` row with `Status = 'APPROVED'` for the shared cross-module ContentProject id `11111111-1111-1111-1111-111111111124` / code `CAC-2026-000124`. If APPROVED packaging missing, bootstrap throws: `"Run Module 11 bootstrap first (approve the PackagingVersion signed manifest before release)."`.

Creates:
- 1 `ReleaseProjects` row: `ReleaseStatus AWAITING_APPROVAL · ApprovalChainStage 2 · CurrentPublishProgressPercent 55`. PackagingVersionId → APPROVED M11 v2.
- 2 `ReleaseApprovalSteps`: CONTENT_REVIEW Step 1 APPROVED Amina Bello Comment "Package manifest + thumbnail primary + metadata v2 all approved". Step 2 FINAL_PUBLISHER PENDING AssignedTo Pips Engine comment pending final publish sign-off.
- 8 `ReleaseChecks`: 4 PASSED (CONTENT_REVIEW, PACKAGE_SIGNED, THUMBNAIL_PRIMARY, METADATA_COMPLETE). 3 NEEDS_REVIEW BLOCKING (PLATFORM_READY YouTube SHORTS connection expired, CLAIM_COMPLIANCE 3rd party audio, RIGHTS_CLEARANCE talent). 1 non-blocking PASSED PUBLISH_CONSENT.
- 5 `PublishingConnections`: YouTube CONNECTED HEALTHY account Cacsms Tv. Shorts EXPIRED scope refresh needed. TikTok NOT_CONNECTED Cacsms Cinema. Instagram NOT_CONNECTED Cacsms Cinema. Facebook NOT_CONNECTED Cacsms Cinema. X NOT_CONNECTED Cacsms Cinema singular label.
- 4 `PublishJobs`: PUB-2401 YouTube LONG_FORM SCHEDULED ScheduledPublishAt future date. PUB-2402 Shorts SHORT_FORM DRAFT. PUB-2403 TikTok REEL BLOCKED NOT_CONNECTED. PUB-2404 Instagram REEL BLOCKED NOT_CONNECTED.
- 3 `ReleaseActivities`: RELEASE_CREATED when packaging approved, STEP_DECIDED CONTENT_REVIEW Amina Bello approved step 1, CHECK_UPDATED PLATFORM_READY needs review.
- StageExecutions: FINAL_APPROVAL IN_PROGRESS 55%, PUBLISHING PENDING.

Run with: `pnpm --filter @cacsms/database db:bootstrap-module12`

Package script inserted at L36 in [package.json](file:///c:/Trading-Engine/cacsms-cinema/packages/database/package.json#L36):
- `"db:bootstrap-module12": "tsx src/bootstrap-module12.ts"` (between `db:bootstrap-module11` L35 and `db:clear-demo` L37).

## API endpoints (apps/api/src/server.ts — version 0.12.0)

Eight Module 12 endpoints. `/health` reports `version: '0.12.0'`, `service: 'cacsms-cinema-api'`, `module01..module12 = 'ready'` (12 modules). All body-accepting endpoints use Zod for body+param schema validation. `getReleaseWorkspace` upserts a ReleaseProject row automatically if an APPROVED PackagingVersion exists and release has none. `decideReleaseApproval` enforces blocking-check gate before APPROVE. `controlPublishJob` enforces ReleaseStatus === 'APPROVED' for QUEUE/RETRY actions. `registerPublication` writes the PUBLICATION contract + PERFORMANCE_MONITORING handoff.

| Method | Path | Contract |
|---|---|---|
| GET | `/api/release-projects` | Workspace list. Inner joins ContentProjects + PackagingVersions. Subqueries return PassedChecks / TotalChecks counts + IsBlocking summary. Blocked flag chip when unresolved blocking count > 0. ReleaseStatus column. PublishProgressPercent progress. |
| GET | `/api/projects/:projectId/release` | `getReleaseWorkspace`. 409 `No APPROVED packaging version signed for this project` when PackagingVersion row with status APPROVED FK missing. Return 7-recordset Promise.all shape: `{project, approvalSteps, releaseChecks, connections, publishJobs, publications, activities}`. Auto-creates ReleaseProjects row (AWAITING_APPROVAL) + 2 approval steps + 8 release checks seeded if APPROVED package present. StageExecutions FINAL_APPROVAL + PUBLISHING seeded. |
| PATCH | `/api/release/checks/:checkId` | `updateReleaseCheck`. Body: `{status ∈ {PASSED, FAILED, NEEDS_REVIEW} evidence? resolvedBy?}` Status transition. Sets ResolvedAt on PASSED/FAILED. Writes audit RELEASE_CHECK_UPDATED. BLOCKING bits flip ReleaseProject PublishProgressPercent recompute. |
| POST | `/api/projects/:projectId/release/decision` | `decideReleaseApproval`. Body: `{decision ∈ {APPROVE, RETURN} stepKey comment? decidedBy?}`. APPROVE gate: unresolved BLOCKING checks with IsBlocking=1 AND status ≠ PASSED → count > 0 AND decision === 'APPROVE' → HTTP 409 `Release approval blocked by N unresolved blocking check(s).`. Also earlier approval step must be APPROVED before later APPROVE (Step1 before Step2). On full APPROVE both steps: UPDATE ReleaseProjects SET ReleaseStatus=APPROVED, ApprovalChainStage=COMPLETE; StageExecutions COMPLETED 100% FINAL_APPROVAL; PUBLISHING stage IN_PROGRESS; UPSERT ProjectVersions RELEASE_PACKAGE v1 row; writeAudit RELEASE_APPROVED. On RETURN: ReleaseStatus RETURNED + RELEASE_RETURNED audit. |
| PUT | `/api/publishing/connections` | `savePublishingConnection`. Zod: Platform enum 6 members, connectionStatus ∈ NOT_CONNECTED/CONNECTED/EXPIRED/REVOKED/HEALTHY. AccountLabel, scopes, ExpiresAt. Upsert PublishingConnections UNIQUE WorkspaceId+Platform. Audit CONNECTION_TESTED ReleaseActivity. |
| POST | `/api/projects/:projectId/publish-jobs` | `createPublishJob`. Platform + Format + PlatformPackageId FK reference M11 package. Status default DRAFT, ScheduledPublishAt nullable. JobCode generated PUB-####. ReleaseActivity JOB_QUEUED when SCHEDULED status. |
| POST | `/api/publish-jobs/:jobId/control` | `controlPublishJob`. Body: `{action ∈ {QUEUE, RETRY, CANCEL}}`. QUEUE/RETRY gate: `SELECT ReleaseStatus FROM ReleaseProjects rp JOIN PublishJobs pj ON rp.Id=pj.ReleaseProjectId WHERE pj.Id=@jobId` — if ReleaseStatus != 'APPROVED' throw 409 `Publish job control blocked: release not yet APPROVED. Final Publisher signed APPROVAL step complete.`. RETRY increments RetryCount (MaxRetries enforced). Attempt ledger PublishJobAttempts STARTED. Status transition. |
| POST | `/api/publish-jobs/:jobId/publication` | `registerPublication`. Body: `{publicationCode? publishUrl? externalJobId? externalPublicationId? manifestSnapshot}`. Captures Publication (PENDING → PUBLISHED). Upserts Publications row. StageExecutions PUBLISHING → COMPLETED 100%. ProjectHandoff created PUBLISHING → PERFORMANCE_MONITORING. Handoff ExternalId = ExternalPublicationId (passed downstream Performance Monitoring identity). writeAudit PUBLICATION_REGISTERED + PUBLICATION_HANDOFF + CONTENT_PUBLISHED. |
| GET | `/health` | Service `cacsms-cinema-api`, `version: '0.12.0'`, module01..module12 ready (12 entries). |

Smoke test: `node apps/api/dist/smoke-test.js` prints 12 lines ending in:
`Module 12 API contracts: release workspace, approval chain decisions, release controls update, publishing connections, publish jobs create/control, publications register, release-projects list.`

## Web routes

AppShell PRODUCTION PIPELINE 9th live slot: **Approval & Publishing** (`✓`, href `/approval`). Sidebar chip `Module 12 · Approval & Publishing`.

| Route | Page | Purpose |
|---|---|---|
| `/approval` | `apps/web/src/app/(app)/approval/page.tsx` | Approval Center dashboard. 4 StatCards: Approval progress 55%, 3 unresolved blocking, Jobs upcoming publish queue 4 jobs 1 SCHEDULED, Platforms healthy 1/5. Post-flow 5-stage pipeline cards: 01 Signed Package ✓ done, 02 Content Review Amina Bello done ✓, 03 Final Publisher active, 04 Schedule/Publish in progress, 05 Performance future locked. Approval chain list-row. Release Blockers filter blocking unresolved NEEDS_REVIEW PLATFORM_READY Shorts EXPIRED. Upcoming publish jobs data-table PUB-2401 YouTube SCHEDULED. |
| `/projects/[id]/release/review` | `apps/web/src/app/(app)/projects/[id]/release/review/page.tsx` | Final Review 3-column layout. PublishingTabs active=review. three-col: Immutable release package detail list signed manifest v2 + Content preview video placeholder 16:9 + Final publisher decision box + Approval chain + Final release controls 8 checks data-table BLOCKING PLATFORM_SETTINGS NEEDS_REVIEW. Governed release contract chain PACKAGING_PACKAGE → RELEASE_PACKAGE → PUBLICATION. |
| `/projects/[id]/release/publishing` | `apps/web/src/app/(app)/projects/[id]/release/publishing/page.tsx` | Publishing & Scheduling panel. PublishingTabs active=publishing. form-grid YouTube release date time inputs with ScheduledPublishAt. control-stack Start/Pause/Retry/Stop buttons. btn.danger Stop. Platform publishing plan data-table 4 jobs. YouTube LONG_FORM scheduled 2 Shorts DRAFT. TikTok BLOCKED. Instagram BLOCKED with status pills. |
| `/projects/[id]/release/connections` | `apps/web/src/app/(app)/projects/[id]/release/connections/page.tsx` | Publishing Connections health panel. PublishingTabs active=connections. data-table 5 platforms (YouTube HEALTHY Cacsms Tv scopes email/readonly expires. YouTube Shorts EXPIRED test-connect. TikTok Instagram Facebook X NOT_CONNECTED Cacsms Cinema labels. 3 mini-card policy guards: least-privilege scopes, expiry-monitoring, revocation-safety. |
| `/projects/[id]/release/jobs` | `apps/web/src/app/(app)/projects/[id]/release/jobs/page.tsx` | Publish Jobs queue + Retry ledger. PublishingTabs active=jobs. Queue data-table PUB-2401 SCHEDULED external state. Retry policy detail list max 3 exp backoff. Publication identity pending capture detail list. ExternalPublicationId reserved for downstream Performance identity. |
| `/projects/[id]/release/history` | `apps/web/src/app/(app)/projects/[id]/release/history/page.tsx` | Release history + activity feed. PublishingTabs active=history. Activity rows 3 release events. Decision ledger CONTENT_REVIEW approved by Amina Bello. Post-publication handoff chain PUBLICATION → PERFORMANCE_MONITORING → AI_LEARNING diagram. |

New components:
- `apps/web/src/components/publishing-tabs.tsx` — `PublishingTabs({projectId, active})` renders a `className="module-tabs"` 5-link pill strip: Final Review / Publishing & Scheduling / Connections / Publish Jobs / Release History. Reuses M10 `.module-tabs` CSS class shared style.

Shared additions:
- `apps/web/src/lib/module12-data.ts` — demo fallback under `NEXT_PUBLIC_DEMO_MODE=true`: `releaseProject {id=11111111-1111-1111-1111-111111111124 CAC-2026-000124 Hidden AI AWAITING_APPROVAL stage=2 progress=55`. 2 approvalSteps step1 APPROVED Amina step2 PENDING Pips Engine. 8 ReleaseChecks: 4 PASSED 3 NEEDS_REVIEW BLOCKING 1 PASSED non-blocking. 5 Connections YouTube HEALTHY "Cacsms Tv" Shorts EXPIRED TikTok/Instagram/Facebook/X all "Cacsms Cinema" NOT_CONNECTED singular brand. 4 PublishJobs PUB-2401 SCHEDULED 2402 DRAFT 2403/2404 BLOCKED NOT_CONNECTED. 3 ReleaseActivities.
- `apps/web/src/styles/globals.css` — appended Module 12 block tail after M11 `@media(max-width:720px){...`: `.three-col main + 2×270px. detail-list list. review-preview video-placeholder 16:9. approval-box decision. text-area. check-row rows. control-stack buttons. btn.danger red. mini-card 3 column. activity-row feed. calendar-grid calendar-day + calendar-event tile. filter-row responsive. @media max-width 1050 collapse columns collapse.

## Inventory & pipeline position

| Component | Count / demo seed |
|---|---|
| SQL tables | 8 (ReleaseProjects · ReleaseApprovalSteps · ReleaseChecks · PublishingConnections · PublishJobs · PublishJobAttempts · Publications · ReleaseActivities) inline UQ/FK constraints zero additional indexes |
| API endpoints | 8 (list release-projects · get release workspace · PATCH check · POST APPROVE/RETURN decision · PUT connections · POST publish-job · POST job/control QUEUE/RETRY/CANCEL · POST publication register) + /health v0.12.0 module12 ready |
| Next.js pages | 6 (/approval dashboard · projects/[id]/release/{review · publishing · connections · jobs · history}) + 1 component publishing-tabs.tsx 5-pill pill-nav |
| Demo ReleaseProject | 1 project AWAITING_APPROVAL stage=2 progress=55% · PackagingVersionId → APPROVED M11 v2 signed manifest |
| Demo ReleaseApprovalSteps | 2 steps: CONTENT_REVIEW APPROVED Amina Bello step 1 · FINAL_PUBLISHER PENDING Pips Engine step 2 |
| Demo ReleaseChecks | 8 total: 5 PASSED · 3 NEEDS_REVIEW BLOCKING (PLATFORM_READY YouTube Shorts expired, CLAIM_COMPLIANCE 3rd party audio, RIGHTS_CLEARANCE talent release) |
| Demo PublishingConnections | 5: YouTube HEALTHY Cacsms Tv · Shorts EXPIRED · TikTok/Instagram/Facebook/X NOT_CONNECTED Cacsms Cinema singular brand labels |
| Demo PublishJobs | 4: PUB-2401 YouTube LONG_FORM SCHEDULED · PUB-2402 YT Shorts DRAFT · PUB-2403 TikTok REEL BLOCKED NOT_CONNECTED · PUB-2404 Instagram REEL BLOCKED NOT_CONNECTED |
| Demo Publications | 1 PENDING publication identity reserved, ExternalPublicationId TBD post-register |
| Demo ReleaseActivities | 3 rows: RELEASE_CREATED auto-create · STEP_DECIDED CONTENT_REVIEW approval · CHECK_UPDATED PLATFORM_READY NEEDS_REVIEW |
| StageExecutions bootstrap | FINAL_APPROVAL IN_PROGRESS 55% · PUBLISHING PENDING stage seeded auto-create · downstream PERFORMANCE_MONITORING await PUBLICATION |
| Handoffs seeded | Upstream M11 PACKAGING_PACKAGE → RELEASE_PACKAGE ProjectHandoffs consumed as prerequisite. Downstream PUBLISHING → PERFORMANCE_MONITORING PENDING await PUBLICATION.registeredPublication creates handoff. |

**Upstream prerequisites** (enforced by `getReleaseWorkspace` 409 + bootstrap `EXISTS PackagingVersions WHERE Status='APPROVED'` for ContentProjectId …124): An APPROVED Module 11 PackagingVersion row. `ReleaseProjects.PackagingVersionId` FK is the contract binding anchor. Only APPROVED packages trigger the auto-create ReleaseProject + 2 approval steps + 8 release checks. Release decisions can not proceed without the upstream signed packaging manifest lock.

**Downstream handoffs on (a) PackagingVersion.APPROVED → APPROVED full chain both steps (post-decision gate pass) AND (b) Publication PUBLISHED (registerPublication):**

**(a) Release APPROVED (both steps passed):**
- 1 `ProjectVersions` row RELEASE_PACKAGE (VersionNumber=1) inserted. VersionId reference `PackagingVersionId` + ReleaseProject FK.
- StageExecutions FINAL_APPROVAL → COMPLETED 100%. StageExecutions PUBLISHING → IN_PROGRESS. writeAudit RELEASE_APPROVED.

**(b) Publication registerPublication (job → PUBLISHED status):**
- 1 `Publications` row status = PUBLISHED. PublicationManifestJson snapshot captured. FirstPublishedAt stamped. ExternalPublicationId populated platform returned.
- StageExecutions PUBLISHING → COMPLETED 100%.
- 1 `ProjectHandoffs` PUBLISHING → PERFORMANCE_MONITORING READY. FromStageKey PUBLISHING → ToStageKey PERFORMANCE_MONITORING. ExternalId = ExternalPublicationId (becomes the analytics identity in M13). Payload carries the Publication manifest snapshot.
- writeAudit triple: PUBLICATION_REGISTERED + PUBLICATION_HANDOFF + CONTENT_PUBLISHED (3 linked events appended ReleaseActivities rows.)
