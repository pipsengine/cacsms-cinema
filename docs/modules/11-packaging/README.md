# Module 11 — Thumbnail, SEO & Platform Packaging

Consumes the upstream Approved MasterVideoVersion (Module 10 Edit & QA) and delivers thumbnail variant scoring & approval, SEO metadata package versioning, caption tracks and chapter mapping, platform-specific derivative packaging, packaging QA checks with blocking gates, and package version governance that hand off a signed PACKAGING_PACKAGE contract to downstream Module 12 Final Approval. Every thumbnail variant carries 7 scored dimensions plus an IsPrimary flag. Every metadata package carries JSON keyword/tag/hashtag arrays. Platform packages link FK to a specific approved thumbnail + caption track. Blocking PackagingChecks gate the APPROVE decision with a 409.

## Database

**Migration:** `packages/database/sql/migrations/013_module11_packaging.sql` (source `012_module11_packaging.sql` renumbered because target migration 012 already holds Module 10 Editing & QA; byte-immutable).

Eight `IF OBJECT_ID IS NULL` tables wrapped in `SET XACT_ABORT ON · BEGIN TRANSACTION … COMMIT`. No extra indexes — all UNIQUE/FK constraints inline with inline table create.

| Table | Purpose |
|---|---|
| `PackagingProjects` | Head per content project. `WorkspaceId · ContentProjectId UNIQUE FK ContentProjects. `MasterVideoVersionId FK → MasterVideoVersions(M10)` — locked contract anchor the only APPROVED master. `Status ∈ {NOT_STARTED, IN_PROGRESS, IN_REVIEW, COMPLETED, LOCKED}`. `ProgressPercent DECIMAL(5,2) 0→100`. `CurrentPlatformReadyCount / TotalPlatformCount`. `ReadinessPercent`. `ApprovedPackageVersionId FK → PackagingVersions nullable. Created/UpdatedAt. |
| `ThumbnailVariants` | Variant row per generated candidate. `PackagingProjectId FK`. `VariantCode NVARCHAR(60)`. `Label · HeadlineText NVARCHAR(200)`. `ConceptText NVARCHAR(2000)`. `Status ∈ {DRAFT, GENERATING, SHORTLISTED, APPROVED, REJECTED}`. `OverallScore / ClarityScore / EmotionScore / CuriosityScore / MobileScore / ContrastScore / ClickScore (7 × DECIMAL(5,2))`. `IsPrimary BIT DEFAULT 0`. `ProviderName · PromptVersion NVARCHAR(200)`. `GeneratedAssetId NULLABLE FK → GeneratedAssets(M09). ApprovedByUserId / ApprovedAt. CreatedAt. |
| `MetadataPackages` | Per-platform-per-version SEO packages. `PackagingProjectId FK. UNIQUE(PackagingId, Platform, VersionNumber). `Platform ∈ {YouTube, YouTube_Shorts TikTok, Instagram, Facebook, X}`. `VersionNumber INT DEFAULT 1`. `Status ∈ {DRAFT IN_REVIEW, APPROVED, LOCKED}`. `PrimaryTitle NVARCHAR(200)`. `Description NVARCHAR(MAX)`. `Category · Language AudienceTarget Playlist · License` scalar. `KeywordsJson · TagsJson · HashtagsJson` (3 × NVARCHAR(MAX) JSON arrays). QualityScore DECIMAL(5,2). CreatedBy FK Users. Created/UpdatedAt. |
| `MetadataTitleVariants` | A/B candidate titles per package. `MetadataPackageId FK`. `TitleText NVARCHAR(200)` `Score DECIMAL(5,2)`. `IsSelected BIT DEFAULT 0`. `Source ∈ {HUMAN, AI}`. CreatedAt. |
| `CaptionTracks` | Localised tracks per packaging. `PackagingProjectId FK`. `LanguageCode NVARCHAR(10)`. `TrackType ∈ {FULL_CAPTIONS, CLEAN_TRANSCRIPT, TRANSLATED}`. `Status ∈ {NOT_STARTED IN_PROGRESS, APPROVED, REVIEWED}`. `SrtUri · VttUri · TranscriptUri × 3 NVARCHAR(1000). `WordCount INT · DurationSeconds DECIMAL(10,3)`. `ApprovedBy · ApprovedAt FK Users. CreatedAt. |
| `ContentChapters` | Chapter markers + scene linking for SEO table of contents. `PackagingProjectId FK`. UNIQUE(PackagingId, ChapterOrder). `ChapterOrder INT`. `TimecodeSeconds DECIMAL(10,3)`. `Title NVARCHAR(200)`. `SceneId NULLABLE FK → Scenes(M08)`. `Status ∈ {DRAFT, READY}`. CreatedAt. |
| `PlatformPackages` | Per-platform-per-format delivery. `PackagingProjectId FK`. UNIQUE(PackagingId, Platform, ContentFormat). `Platform ∈ enum same as Metadata`. `ContentFormat ∈ {LONG_FORM, SHORT_FORM, REEL, STORY, POST, THREAD}`. `AspectRatio · TargetDurationSeconds DECIMAL(10,3)`. `Status ∈ {DRAFT PLANNED, IN_PRODUCTION, READY, PUBLISHED, FAILED}`. `ThumbnailVariantId FK → ThumbnailVariants`. `CaptionTrackId FK → CaptionTracks`. `MetadataPackageId FK → MetadataPackages` nullable. `PublishUrl NVARCHAR(1000)`. `DerivedFrom LONG_FORM · PublishedAt · QualityScore DECIMAL(5,2)`. Created/UpdatedAt. |
| `PackagingChecks` | QA + blocking audit. `PackagingProjectId FK`. UNIQUE(PackagingId, CheckKey). `CheckKey ∈ {THUMBNAIL_PRIMARY, METADATA_COMPLETE, CAPTION_APPROVED, CHAPTER_COMPLETE, PLATFORM_SETTINGS, CLAIM_COMPLIANCE, AUDIENCE_SETTINGS, FACT_LINEAGE, COPYRIGHT}` 9 families. `CheckName · Category · Severity`. `Status ∈ {NOT_RUN, PASSED, FAILED, NEEDS_REVIEW}`. `IsBlocking BIT`. `Evidence NVARCHAR(MAX)`. `ResolvedBy/At FK Users. Created/UpdatedAt. |
| `PackagingVersions` | Immutable signed packages. `PackagingProjectId FK`. UNIQUE(PackagingId, VersionNumber). `VersionNumber INT`. `Status ∈ {DRAFT, IN_REVIEW, APPROVED, RETURNED, LOCKED}`. `PrimaryThumbnailVariantId FK NOT NULL` (enforced. `PrimaryMetadataPackageId FK NOT NULL` enforced. `ManifestJson NVARCHAR(MAX)` snapshot of all platform+chapter+caption references. `ChangeSummary NVARCHAR(2000)`. Created/Reviewed/Approved By/At FK Users. |

**Bootstrap demo data:** `packages/database/src/bootstrap-module11.ts`

Requires Module 01 workspace `Slug = 'cacsms-cinema'` and Module 10 `MasterVideoVersions` row with `Status = 'APPROVED'` for the shared cross-module ContentProject id `11111111-1111-1111-1111-111111111124` / code `CAC-2026-000124`. If approved master missing, bootstrap throws: `"Run Module 10 bootstrap first (approve master before packaging)."

Creates:
- 1 `PackagingProjects` row: `Status IN_PROGRESS · ProgressPercent 88`. 1 of 6 platforms ready.
- 3 `ThumbnailVariants`: TH-201 SHORTLISTED (91 overall), TH-202 APPROVED · IsPrimary = 1 (score 94), TH-203 REJECTED (78 overall). Each carries 7 dimension scores.
- 1 `MetadataPackages` v2 for YouTube: 94 QualityScore. 7 keywords, 7 tags, 5 hashtags JSON arrays. 3 alternate titles variants linked. NOT MADE FOR KIDS audience. Standard YouTube License. Science & Technology.
- 4 `CaptionTracks`: EN FULL_CAPTIONS APPROVED, EN CLEAN_TRANSCRIPT APPROVED, FR TRANSLATED NOT_STARTED, ES TRANSLATED NOT_STARTED. EN tracks carry SRT/VTT/TXT URIs.
- 8 `ContentChapters`: 0:00 / 0:42 / 1:31 / 2:24 / 3:15 / 4:06 / 5:02 / 6:10 matching 8 scenes M08. SceneId FK populated for each.
- 6 `PlatformPackages`: YouTube LONG_FORM 16:9 519s APPROVED th + 16:9 Shorts 60s DRAFT 9:16 TikTok DERIVATIVE ASPECT Instagram REEL 9:16 DRAFT Facebook LONG 16:9 PLANNED X POST THREAD 16:9 PLANNED.
- 8 `PackagingChecks`: 5 PASSED BLOCKING items (thumbnail/metadata/caption/chapter/claim). PLATFORM_SETTINGS BLOCKING NEEDS_REVIEW FB/X audience settings). 2 HIGH non-blocking NEEDS_REVIEW (fact_lineage PASS). copyright metadata non-blocking.
- 2 `PackagingVersions`: v1 RETURNED "Thumbnail variant contrast issues on mobile returned for re-generation + metadata YouTube hashtag spelling. v2 IN_REVIEW: 1 blocking QA remain (PLATFORM_SETTINGS).
- StageExecutions: `THUMBNAIL STAGE COMPLETED, SEO_METADATA IN_PROGRESS 88%.
- Handoffs: Upstream M10 EDIT_ASSEMBLY → THUMBNAIL SEO_METADATA FINAL_APPROVAL ProjectHandoffs PENDING on APPROVE.

Run with: `pnpm --filter @cacsms/database db:bootstrap-module11`

Package script inserted at L35 in [package.json](file:///c:/Trading-Engine/cacsms-cinema/packages/database/package.json#L35):
- `"db:bootstrap-module11": "tsx src/bootstrap-module11.ts"` (between `db:bootstrap-module10` L34 and `db:clear-demo` L36).

## API endpoints (apps/api/src/server.ts — version 0.11.0)

Twelve Module 11 endpoints. `/health` reports `version: '0.11.0'`, `service: 'cacsms-cinema-api'`, `module01..module11 = 'ready'` (11 modules). All body-accepting endpoints use Zod for body+param schema validation. `getPackagingWorkspace` upserts a PackagingProject row automatically if an APPROVED master exists and packaging has none. `decidePackagingVersion` enforces blocking-check gate before APPROVE.

| Method | Path | Contract |
|---|---|---|
| GET | `/api/packaging-projects` | Workspace list. Inner joins ContentProjects + MasterVideoVersions. Subqueries return PassedChecks / TotalChecks counts + IsBlocking summary. Passed count unresolved blocking = `Blocked flag chip. |
| GET | `/api/projects/:projectId/packaging` | getPackagingWorkspace. 409 `No APPROVED master video exists for this project` when MasterVideo row with status APPROVED FK missing. Return 8-recordset shape: `{project thumbnails metadata captions chapters platforms checks versions}`. Auto-creates PackagingProject row (IN_PROGRESS) + stage executions THUMBNAIL/SEO_METADATA seeded if APPROVED master present. |
| POST | `/api/projects/:projectId/packaging/metadata` | saveMetadataPackage. Zod: platform enum 9 members, versionNumber optional int, primaryTitle ≤200, description ≤4000, category/language/audience/playlist/license scalars, keywords array string max 100 × 50 chars max, tags same. Upsert MetadataPackage +  UNIQUE(Platform, VersionNumber). Audit PACKAGING_METADATA_SAVED. |
| POST | `/api/projects/:projectId/packaging/thumbnails` | saveThumbnailVariant. label headline concept scores OverallScore scores. Generates VariantCode auto TH-###. Status default DRAFT. GenerationJobs IMAGE capability THUMBNAIL queued via saveThumbnailVariant. |
| POST | `/api/packaging/thumbnails/:id/decision` | decideThumbnailVariant. Body: `{decision ∈ {APPROVE SHORTLIST / REJECT} decidedBy?}`. APPROVE → zeroes IsPrimary=0 for all siblings then sets IsPrimary=1 on chosen. Audit PACKAGING_THUMBNAIL_DECIDED. |
| PATCH | `/api/packaging/checks/:checkId` | status ∈ {PASSED, FAILED, NEEDS_REVIEW} evidence? resolvedBy? set ResolvedAt PASSED status PASSED. Writes audit PACKAGING_CHECK_UPDATED. BLOCKING bits flip Project ReadinessPercent recompute. |
| POST | `/api/projects/:projectId/packaging/versions` | createPackagingVersion. Validation: PrimaryThumbnailVariantId (APPROVED) + PrimaryMetadataPackageId NOT NULL both throw 409 both. Builds ManifestJson JSON snapshot of all platforms chapters captions metadata references IN_REVIEW default. Audit PACKAGING_VERSION_CREATED. |
| POST | `/api/projects/:projectId/packaging/decision` | decidePackagingVersion APPROVE/RETURN body: versionId, decision, comment, decidedBy. APPROVE gate: unresolved BLOCKING checks with IsBlocking=1 + status ≠ PASSED → count > 0 decision === 'APPROVE' throw HTTP 409 `Packaging approval blocked by N blocking(s): unresolved blocking checks.`. On APPROVE: UPDATE PackagingProjects Status=COMPLETED ProgressPercent=100%; StageExecutions COMPLETED 100% THUMBNAIL SEO_METADATA; UPSERT ProjectVersions PACKAGING_PACKAGE row; INSERT ProjectHandoffs SEO_METADATA → FINAL_APPROVAL with ManifestJson payload + PackagingVersionId reference; writeAudit PACKAGING_APPROVED PACKAGING_RETURNED on RETURN. |
| POST | `/api/projects/:projectId/packaging/thumbnail-jobs` | queueThumbnailGeneration. GenerationJob IMAGE Capability THUMBNAIL AssetRole THUMBNAIL_VARIANT body: prompt provider? Writes GenerationJobs (M09 table). |
| PUT | `/api/projects/:projectId/packaging/captions` | saveCaptionTrack upsert. Tracks array ≤ 4. LanguageCode + TrackType composite. Status NOT_STARTED IN_PROGRESS APPROVED REVIEWED. Captions SRT URI VTT URI Transcript. |
| PUT | `/api/projects/:projectId/packaging/chapters` | replaceChapters sql.Transaction wrapped. DELETE existing for project. INSERT up to 100 chapter items. ChapterOrder auto-sorted client. TimecodeSeconds Title. SceneId NULLABLE FK. READY/DRAFT status. |
| PUT | `/api/projects/:projectId/packaging/platforms` | savePlatformPackage upsert. Platform enum YouTube/Shorts/TikTok/Instagram/Facebook/X formats. ContentFormat. AspectRatio TargetDuration Status. ThumbnailVariantId Approved thumbnail. CaptionTrackId. Approved caption. Publish URL. QualityScore. DerivativeFrom LONG_FORM source. |
| GET | `/health` | Service `cacsms-cinema-api`, `version: '0.11.0'`, module01..module11 ready (11 entries). |

Smoke test: `pnpm --filter @cacsms/api exec tsx src/smoke-test.ts` prints 11 lines ending in:
`Module 11 API contracts: packaging projects workspace, thumbnails variants/decide, metadata/captions/chapters save, platforms, checks update, packaging versions/decision.`

## Web routes

AppShell PRODUCTION PIPELINE 8th live slot: **Packaging** (`◈`, href `/packaging`). Sidebar chip `Module 11 · Packaging`.

| Route | Page | Purpose |
|---|---|---|
| `/packaging` | `apps/web/src/app/(app)/packaging/page.tsx` | Packaging dashboard. 4 StatCards: Packaging readiness 88% 1 blocking, Primary thumbnail 94, Platform variants 1/6 ready, QA passed 6/8. post-flow 5-stage pipeline cards: 01 Approved Master ✓ done, 02 Thumbnail TH-202 approved ✓ done, 03 SEO metadata active, 04 Platform variants small ready, 05 Final handoff locked future. Two-col section: Packaging QA exceptions list-row NEEDS_REVIEW blocking PLATFORM_SETTINGS visible; Platform readiness 6 platforms slice 5 rows. Version governance 2 rows v1 RETURNED v2 IN_REVIEW. |
| `/projects/[id]/packaging/thumbnails` | `apps/web/src/app/(app)/projects/[id]/packaging/thumbnails/page.tsx` | Thumbnail Studio. PackagingTabs active=thumbnails. thumbnail-layout 2-col: Left thumbnail-grid 2-col × 3 cards TH-201/202/203 with gradient preview dark 190px headline badge + body (p concept, provider prompt) + score-bar bignum + score-grid 3×2 scores (Clarity Emotion Curiosity Mobile Contrast Click). TH-202 approved.green shadow. Right inspector sticky top:80 — TH Inspector List guardrails info callout human-review gate before APPROVE. |
| `/projects/[id]/packaging/seo` | `apps/web/src/app/(app)/projects/[id]/packaging/seo/page.tsx` | SEO & Metadata form. PackagingTabs active=seo. metadata-form: label Primary title with counter + 3 alt-titles pill buttons + description textarea. 3 token-box keyword/tag/hashtag token pill arrays 5 hashtags pill chips. Inspector right sidebar: platform settings list context, seo-score card 94 blue gradient + line + small metadata rules caption YouTube 9:16 shorts 60s description shorter format small. |
| `/projects/[id]/packaging/captions` | `apps/web/src/app/(app)/projects/[id]/packaging/captions/page.tsx` | Captions & Chapters + accessibility panels. PackagingTabs active=captions. two-col: Left Caption data-table 4 rows (CAP ID Lang Type Status URIs Word Count). Right 3 × mini-panel Accessibility. 8 chapter-row chapter validation list. |
| `/projects/[id]/packaging/platforms` | `apps/web/src/app/(app)/projects/[id]/packaging/platforms/page.tsx` | Platform Variants 3×2 grid 6 cards platform preview gradient background center duration format + status pill. PackagingTabs active=platforms platform grid pack 16x9 LONG SHORTS 9:16 derivative. Inspector rightlist variant metadata. Validate Edit button-row. |
| `/projects/[id]/packaging/versions` | `apps/web/src/app/(app)/projects/[id]/packaging/versions/page.tsx` | Versions & Governance. PackagingTabs active=versions. two-col: Left version data v1 RETURNED v2 IN_REVIEW. 8 packaging checks list-row blocking. Right Governance chain UPSTREAM→THIS→DOWNSTREAM handoff contract diagram. APPROVAL disabled button disabled unresolved blocking count > 0. |

New components:
- `apps/web/src/components/packaging-tabs.tsx` — `PackagingTabs({projectId, active})` renders a `className="module-tabs"` 5-link pill strip: Thumbnail Studio / SEO & Metadata / Captions & Chapters / Platform Variants / Versions & Governance. Reuses M10 `.module-tabs` CSS class shared style.

Shared additions:
- `apps/web/src/lib/module11-data.ts` — demo fallback under `NEXT_PUBLIC_DEMO_MODE=true`: `packagingProject {id=11111111-1111-1111-1111-111111111124 CAC-2026-000124 Hidden AI IN_PROGRESS Progress 88%`. 3 ThumbnailVariant (TH-201 SHORTLISTED TH-202 APPROVED primary TH-203 REJECTED with 7 scores each). metadata YouTube v2 94 quality 7 keywords 7 tags 5 hashtags. 8 chapters 4 caption 4 tracks EN/FR/ES 6 platform YouTube Long ready shorts draft. 8 Packaging checks BLOCKING. PLATFORM_SETTINGS NEEDS_REVIEW. 2 PackagingVersions v1 RETURNED v2 IN_REVIEW.
- `apps/web/src/styles/globals.css` — appended Module 11 block after M10 @media tail: `.thumbnail-layout .seo-layout (main + 270px).thumbnail-grid 2-col cards.thumbnail-card.approved green #75e0a7 border+shadow TH-202.thumbnail-preview gradient 190px headline badge. score-bar + .score-grid 3x2 .inspector sticky top:80px .metadata-form label input textarea .alt-titles .token-box pills .seo-score 94 gradient blue bar .chapter-row b timecode .mini-panel .platform-grid 3-col .platform-preview gradient center duration @media 1100px collapse single-col @media 720px thumbnail/platforms/grid 1-col responsive.

## Inventory & pipeline position

| Component | Count / demo seed |
|---|---|
| SQL tables | 8 (PackagingProjects · ThumbnailVariants · MetadataPackages · MetadataTitleVariants · CaptionTracks · ContentChapters · PlatformPackages · PackagingChecks · PackagingVersions) inline UQ/FK constraints zero additional indexes |
| API endpoints | 12 (list packaging-projects, get workspace, metadata POST save, thumbnail POST save + /decision, PATCH check, create PackagingVersion, decide APPROVE/RETURN, queue thumbnail jobs image capability, captions PUT upsert, chapters PUT replace transaction, platforms PUT upsert) + /health v0.11.0 |
| Next.js pages | 6 (/packaging dashboard · projects/[id]/packaging/{thumbnails seo captions platforms versions) + 1 component `packaging-tabs.tsx` 5-pill pill-nav |
| Demo PackagingProject | 1 project IN_PROGRESS 88% · 519s current duration · master v3 APPROVED |
| Demo ThumbnailVariants | 3: TH-201 SHORTLISTED 91, TH-202 IsPrimary=APPROVED 94, TH-203 REJECTED 78 |
| Demo MetadataPackages | YouTube v2, 94 QualityScore, 7 keywords / 7 tags / 5 hashtags JSON arrays, Science & Tech category, EN language, audience Not made for kids, Standard YouTube License, Playlist AI & The Future |
| Demo CaptionTracks | 4: EN FULL CAPTIONS APPROVED, EN CLEAN TRANSCRIPT APPROVED, FR/ES TRANSLATED NOT_STARTED (track type FULL_CAPTIONS CLEAN_TRANSCRIPT TRANSLATED) |
| Demo ContentChapters | 8 (00:00..06:10), 8 scenes SceneId FK M08, all status READY |
| Demo PlatformPackages | 6: YouTube LONG 16:9 519s READY 96 Quality · Shorts 60s 9:16 DRAFT · TikTok REEL 60s 9:16 PLANNED · Instagram REEL 45s 9:16 DRAFT · Facebook LONG 16:9 PLANNED · X THREAD 16:9 PLANNED |
| Demo PackagingChecks | 8 total: 6 PASSED · 1 NEEDS_REVIEW PLATFORM_SETTINGS BLOCKING · 2 HIGH severity non-blocking NEEDS_REVIEW · FACT_LINEAGE PASS · COPYRIGHT OK |
| Demo PackagingVersions | 2 versions — v1 RETURNED (THUMBNAIL MOBILE CONTRAST), v2 IN_REVIEW with PLATFORM_SETTINGS BLOCKING 1 unresolved |
| StageExecutions bootstrap | THUMBNAIL COMPLETED 100% · SEO_METADATA IN_PROGRESS 88% · downstream FINAL_APPROVAL PENDING pending PackageVersion.APPROVE |
| Handoffs seeded | Upstream M10 MASTER APPROVED → THUMBNAIL READY handoff; FINAL_APPROVAL ProjectHandoffs PENDING await APPROVE |

**Upstream prerequisites** (enforced by `getPackagingWorkspace` 409 + bootstrap `EXISTS MasterVideoVersions WHERE Status='APPROVED'` for ContentProjectId …124): An APPROVED Module 10 MasterVideoVersion row. `PackagingProjects.MasterVideoVersionId` FK is the contract binding anchor. Only APPROVED masters trigger the auto-create. Thumbnail/metadata edits can not proceed without the upstream video master asset.

**Downstream handoffs on PackagingVersion.APPROVED (post-decision gate pass):**
- 1 `ProjectVersions` row PACKAGING_PACKAGE (VersionNumber=Version) inserted. VersionId reference `PackagingVersionId.
- 1 `ProjectHandoffs` SEO_METADATA → FINAL_APPROVAL READY. FromStageKey SEO_METADATA → ToStageKey FINAL_APPROVAL. Payload carries the PackagingVersionId ManifestJson snapshot (platform package manifest lock).
- StageExecutions COMPLETED both THUMBNAIL and SEO_METADATA stages 100%. Module 12 Final Approval consumes this signed manifest lock, validates the PACKAGING_PACKAGE, and publishes.