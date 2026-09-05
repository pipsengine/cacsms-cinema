# Module 07 — Concept &amp; Script Production

Turns approved Research Packs into structured narrative concepts, an evidence-backed script with section outline, cross-referenced Fact &amp; Claim Links, retention pass, and versioned review/approval handoffs into the downstream CHARACTER_BIBLE and SCENE_MATRIX stages.

## Database

**Migration:** `packages/database/sql/migrations/009_module07_concept_script_production.sql`

Seven `IF OBJECT_ID IS NULL` tables with FKs, `CHECK` constraints, and covering indexes:

| Table | Purpose |
|---|---|
| `ScriptConcepts` | Generated narrative concepts per Research Pack Version. `ConceptCode UNIQUE ≤ 64`, `PackVersionId FK ResearchPackVersions`, `Title ≤ 512`, `Logline ≤ 2000`, `HookScore / StructureScore / EmotionalScore / EvidenceScore / RetentionScore DECIMAL(5,2)`, `Status CK in SHORTLISTED / SELECTED / APPROVED / REJECTED`. IX on (PackVersionId, Status) + (ConceptCode). |
| `ScriptDocuments` | Head document per project, points to current active + approved version. `ProjectId FK ContentProjects` unique, `CurrentVersionNum INT`, `ApprovedVersionNum INT NULL`, `EstimatedDurationSec INT`, `TotalWordCount INT`. |
| `ScriptVersions` | Snapshot per version bump. PK `(DocumentId, VersionNumber)`. `Status CK in DRAFT / IN_REVIEW / APPROVED / RETURNED / PUBLISHED`, `SnapshotJson NVARCHAR(MAX)`, `ChangeSummary NVARCHAR(2000)`, `CreatedAt`, `CreatedBy FK Users`. |
| `ScriptSections` | Ordered document body. `SectionOrder INT`, `SectionType CK in HOOK / CHAPTER / TAKEAWAY / TRANSITION / COLD_OPEN`, `StartSecOffset INT`, `EndSecOffset INT`, `SectionTitle ≤ 256`, `Purpose NVARCHAR(512)`, `Body NVARCHAR(MAX)`, `WordCount INT`, `Status CK in DRAFT / IN_REVIEW / APPROVED / LOCKED`, `LastEditedBy FK Users NULLABLE`. |
| `ScriptClaimLinks` | Evidence bridge from script sections ⇔ upstream ResearchClaims. `SectionId FK ScriptSections NULLABLE` (document-level link if NULL), `ResearchClaimId FK ResearchClaims NOT NULLABLE`, `IsMaterial BIT DEFAULT 1`, `Verification CK in VERIFIED / UNVERIFIED / CONFLICTING`, `EvidenceNote NVARCHAR(1000) NULLABLE`. IX on (SectionId, Verification). |
| `ScriptRetentionChecks` | Audience retention diagnostics. `SectionId FK ScriptSections NULLABLE`, `CheckType CK in HOOK / PACE / REPETITION / RHYTHM / TRIPLET / CALLBACK / CLIMAX`, `Score DECIMAL(5,2)`, `Status CK in KEEP / ACTION / REVIEW`, `IsBlocking BIT DEFAULT 0`, `Note NVARCHAR(1000) NULLABLE`, `WindowStartSec INT`, `WindowEndSec INT`. |
| `ScriptReviews` | Decision log. `VersionNumber INT NOT NULL` (composite FK ScriptVersions (DocumentId, VersionNumber)), `Decision CK in APPROVE / RETURN`, `Comment NVARCHAR(4000) NULLABLE`, `Reviewer FK Users NOT NULLABLE`, `CreatedAt DEFAULT GETUTCDATE()`. |

**Bootstrap demo data:** `packages/database/src/bootstrap-module07.ts`

Requires Module 01 workspace `Slug = 'cacsms-cinema'` and a Module 06 approved Research Pack for `ContentProject.Code = 'CAC-2026-000124'` ("Hidden AI"). If the Research Pack is not APPROVED yet, the bootstrap promotes a Version 1 snapshot and sets `ResearchPacks.Status = APPROVED` first so the precondition holds. Populates:

- 3 `ScriptConcepts` (CON-001 APPROVED 92 / CON-002 SHORTLISTED 84 / CON-003 REJECTED 77)
- 1 `ScriptDocuments` row with CurrentVersionNum = 2, ApprovedVersionNum = 1, EstimatedDuration 542s, 1917 words
- 2 `ScriptVersions` (v1 APPROVED 1402w 398s; v2 IN_REVIEW 1917w 542s with snapshot + change summary)
- 6 `ScriptSections` ordered HOOK + 4× CHAPTER + TAKEAWAY with status APPROVED/IN_REVIEW/DRAFT mix and body/purpose/offsets pre-filled
- 5 `ScriptClaimLinks` (4 VERIFIED/APPROVED claim codes CLAIM-R-003/007/010/012; 1 CONFLICTING/NEEDS_REVIEW CLAIM-R-015)
- 6 `ScriptRetentionChecks` (4 KEEP with Score 80–95; 2 ACTION with IsBlocking=1 for the "Auction" pacing section + triplet repetition)
- 2 `ScriptReviews` (v1 APPROVED by Pips Engine; v2 RETURNED by Research Lead re CLAIM-R-015 conflict)

Run with: `pnpm --filter @cacsms/database db:bootstrap-module07`

## API endpoints (apps/api/src/server.ts — version 0.7.0)

10 Module 07 endpoints. All params Zod-parsed; writes and transitions route through MSSQL transactions with handoff propagation from concept → CHARACTER_BIBLE / SCENE_MATRIX. Reads use the `(r.recordsets as any)` multi-cast pattern for strict-TypeScript multiple-recordsets:

| Method | Path | Contract |
|---|---|---|
| GET | `/api/script-projects` | Workspace-scoped listing of content projects with an approved Research Pack, enriched with script KPIs (concept count, approved concept, current version, status, words, duration, evidence coverage %, retention block count). 409 if workspace bootstrap absent. |
| GET | `/api/projects/:projectId/script` | Zod uuid `projectId`. Returns one round-trip with 8 recordsets: `ScriptDocuments` head, `ScriptSections` ordered, `ScriptConcepts` (APPROVED first), `ScriptClaimLinks` (UNVERIFIED/CONFLICTING first), `ScriptRetentionChecks` (BLOCKING first), `ScriptVersions` newest-first, `ScriptReviews` per version, `ResearchClaims` join. 409 "Approved Research Pack required" if no approved pack. |
| POST | `/api/projects/:projectId/script/concepts/generate` | Kick off LLM concept generation for the approved Research Pack. Body `{briefSeed?}`. Inserts 3+ `ScriptConcepts` rows with Status = `SHORTLISTED` and 5-dimension scores. Audit `SCRIPT_CONCEPTS_GENERATED`. |
| POST | `/api/projects/:projectId/script/concepts/:conceptId/decision` | Decision enum via body `{decision: SHORTLISTED \| SELECTED \| REJECTED \| APPROVED, reason? ≤ 2000}`. Transaction: on `APPROVED` → sets WorkflowStage `CONCEPT_APPROVAL = COMPLETED` → inserts `SCRIPT` stage with status `NOT_STARTED` (auto-handoff), creates base `ScriptDocuments` + `ScriptVersions` 1 DRAFT baseline. |
| POST | `/api/projects/:projectId/script/start` | Start drafting. If `ScriptDocuments` absent, inserts the DRAFT skeleton. Bumps `CurrentVersionNum` if moving from APPROVED → DRAFT/IN_REVIEW. Inserts 6 default section placeholders (HOOK, CHAPTER×4, TAKEAWAY). Audit `SCRIPT_DRAFT_STARTED`. |
| PUT | `/api/projects/:projectId/script/sections` | Save `ScriptSections` array bulk. Body `[{id?, sectionOrder, type, title, purpose, startSec, endSec, body, wordCount, status}]`. Upsert by `SectionId`/`SectionOrder`; recompute `TotalWordCount` + `EstimatedDurationSec` on `ScriptDocuments` after save. |
| GET | `/api/projects/:projectId/script/claims` | View helper: returns `ScriptClaimLinks` + upstream `ResearchClaims.Statement/ClaimCode/Materiality` join, order by `Verification DESC` so CONFLICTING/UNVERIFIED surface at top. |
| GET | `/api/projects/:projectId/script/retention` | Returns `ScriptRetentionChecks` joined to section titles, blocking first. Includes summary aggregates (`AvgScore`, `BlockingOpen`, `KeepCount`, `StrongestSection`). |
| POST | `/api/projects/:projectId/script/submit` | Submit for review. **Hard gates**: (a) zero `IsBlocking=1` retention checks, (b) ≤ 1 `CONFLICTING` claim link. Flips `ScriptVersions.Status = IN_REVIEW` on current version + inserts baseline `ScriptReviews` shell. Audit `SCRIPT_SUBMITTED`. |
| POST | `/api/projects/:projectId/script/decision` | Reviewer decision. Body `{decision: APPROVE \| RETURN, comment? ≤ 4000, reviewerId? FK Users}`. Transaction on `APPROVE`: flips `ScriptVersions.Status = APPROVED` → sets `ScriptDocuments.ApprovedVersionNum = CurrentVersionNum` → inserts downstream `ProjectHandoff` to `CHARACTER_BIBLE` + `SCENE_MATRIX` WorkflowStages (both `NOT_STARTED`) and creates `Activities` rows for both. Audit `SCRIPT_DECISION_RENDERED`. |

`/health` returns:
```
{ status:'ok', service:'cacsms-cinema-api', version:'0.7.0',
  module01:'ready', module02:'ready', module03:'ready', module04:'ready',
  module05:'ready', module06:'ready', module07:'ready' }
```

Smoke test: `pnpm --filter @cacsms/api test` prints Module 01..07 contracts.

## Web routes

AppShell PRODUCTION PIPELINE group now has 4 live links: Strategy Studio ↗ · Opportunity Studio ↗ · Research Studio ↗ · **Script Studio ↗** (new). Sidebar footer chip: **`Module 07 · Concept & Script`**. Eyebrow default `CACSMS CINEMA`; brand title + workspace mini + breadcrumbs all use the singular `Cacsms Cinema` convention.

| Route | Page | Purpose |
|---|---|---|
| `/scripts` | `apps/web/src/app/(app)/scripts/page.tsx` | Script Register. 5 KPI tiles (Active scripts · In pipeline review · Approved versions · Pending concepts X/Y · Total script words + Duration). 9-column register grid header: Project · Title &amp; Selected concept · Sections · Concepts · Version/Status · Words · Duration · Evidence · Status. Row for CAC-2026-000124 with "Open Studio →" deep-link. |
| `/projects/[id]/script` | `apps/web/src/app/(app)/projects/[id]/script/page.tsx` | Script Studio editor. 5-tab nav (Concept Studio / Script Studio / Fact &amp; Claim Links / Retention / Versions). 3-col layout: left **Outline** with 6 section buttons (active state via `useState`); centre **Editor** canvas with toolbar (B / § / ↻ / ¶) + 3-block section KPI (Word count · Status · Purpose) + monospace textarea; right **Assistant** column (prompt chips, evidence coverage panel with claim-chip badges, assistant-tools: retention pass, claims audit, suggest reorder, summarise). Footer aggregates v2 · 5 claim links · 1,917 words · 09:02 · 3 APPROVED · 2 REVIEW · 1 DRAFT. |
| `/projects/[id]/script/concepts` | `apps/web/src/app/(app)/projects/[id]/script/concepts/page.tsx` | Concept Studio. 2×2 concept-card grid with selected/rejected variants. Each card: ConceptCode chip + status pill + Title + Logline + `<S>` 5-dim score bars (Hook/Structure/Emotional/Evidence/Retention) + action matrix: APPROVED cards show "✓ APPROVED · Use Script →"; SHORTLISTED get SELECT/APPROVE/REJECT; REJECTED gets "REVIEW"; DRAFT gets all four. Concept detail hook / structure acts / selectedAt timestamp. |
| `/projects/[id]/script/claims` | `apps/web/src/app/(app)/projects/[id]/script/claims/page.tsx` | Fact &amp; Claim Links. 6-column register: Claim Code · Statement · Source · Verification · Materiality · Usage in script. 5 rows from bootstrap: CLAIM-R-003/007/010/012 VERIFIED/APPROVED; CLAIM-R-015 CONFLICTING/NEEDS_REVIEW (highlighted row). Claim-chip variants: verified (green) · conflicting (amber) · pending (gray). Usage pill underscore → space replace. |
| `/projects/[id]/script/retention` | `apps/web/src/app/(app)/projects/[id]/script/retention/page.tsx` | Retention pass. `retention-layout` main+aside. Main: 6 retention-check rows with left status-bar (red BLOCKING if IsBlocking; green RESOLVED/KEEP otherwise); `fmt(seconds)` → `mm:ss` section window; score gauge + Note. Aside: 4-block summary (Avg 86% green · Blocking open 2 red · Kept 4 · Strongest S6 amber), score-bars chart (S1-S6 per section; low=red/mid=amber/high=blue), and SUBMIT GATE handoff box ("Script cannot submit until 2 blocking actions resolved"). |
| `/projects/[id]/script/versions` | `apps/web/src/app/(app)/projects/[id]/script/versions/page.tsx` | Versions &amp; Reviews. 2 `ScriptVersions` cards; current (v2) with blue box-shadow. Per card: 4-stat strip (words · duration · sections · concept) + `<pre>` section outline + per-version review-item list with avatar initials + decision-pill (APPROVE green · RETURN red). Reviews: v2 RETURN "Research Lead · re: CLAIM-R-015 the conflict with Morning Mood claim — reconcile before resubmit" vs v1 APPROVED "Pips Engine · Evidence coverage 4/5 meets threshold". |

Shared additions:
- `apps/web/src/components/app-shell.tsx` — Script Studio (icon ¶) is the 4th live slot in PRODUCTION PIPELINE at `/scripts`; sidebar chip updated to `Module 07 · Concept & Script`.
- `apps/web/src/lib/module07-data.ts` — demo static fallback for `NEXT_PUBLIC_DEMO_MODE=true`: `scriptProject` (id …124, CAC-2026-000124, Hidden AI, v2 IN_REVIEW), `concepts[4]`, `scriptSections[6]` with body/purpose/offsets/wordCount/status, `claimLinks[5]`, `retentionChecks[6]`, `scriptVersions[2]`.
- `apps/web/src/styles/globals.css` — appended **Module 07** classes after M06: `.script-kpis` (5-col) `.script-register-head/row` (9-col), `.script-tabs a.active`, `.script-studio-layout` (230 / 1fr / 260), `.script-outline .script-section-btn .active`, `.script-editor head/toolbar/meta/canvas`, `.script-canvas textarea` monospace, `.ai-panel` + `.ai-prompt-chip` + `.assistant-tools`, `.concept-card-grid` 2-col + selected/rejected states, `.concept-scores` 5-dim bars, `.claim-head / .claim-row / .claim-chip` variants, `.retention-layout main/side` + `.retention-check.blocking` inset-red, `.retention-score-bars` (low/mid/high colors), `.version-timeline` + `.version-card.current` + `.review-item` + `.decision-pill approve/return`. Responsive reflow at ≤1300px / ≤980px / ≤760px / ≤520px matching M01–06.

## Inventory &amp; pipeline position

| Component | Count / demo seed |
|---|---|
| SQL tables | 7 (Concepts · Documents · Versions · Sections · ClaimLinks · RetentionChecks · Reviews) |
| API endpoints | 10 (register · workspace · concepts generate · concept decide · start · sections save · claims · retention · submit · decide) |
| Next.js pages | 6 (scripts register · studio · concepts · claims · retention · versions) |
| Demo concepts | 4 (CON-001 APPROVED · CON-002 SHORTLISTED · CON-003 REJECTED · CON-004 SHORTLISTED) |
| Demo sections | 6 (1 HOOK · 4 CHAPTER · 1 TAKEAWAY) — 1917 words total · 09:02 |
| Demo claim links | 5 (4 VERIFIED · 1 CONFLICTING) — CLAIM-R-003/007/010/012/015 |
| Demo retention checks | 6 (4 KEEP · 2 ACTION including Auction pacing + triplet repeat — both IsBlocking=1) |
| Demo versions | 2 (v1 APPROVED 1402w · v2 IN_REVIEW 1917w) |
| Demo reviews | 2 (v1 APPROVE Pips Engine · v2 RETURN Research Lead) |

**Upstream prerequisite:** Approved Research Pack (Module 06) for project `CAC-2026-000124`. Bootstrap-module07 auto-promotes the ResearchPack to APPROVED if needed.

**Downstream handoffs on Script APPROVE:** `WorkflowStage CHARACTER_BIBLE = NOT_STARTED` + `WorkflowStage SCENE_MATRIX = NOT_STARTED`, both with `ProjectHandoff` + `Activities` rows inserted by the decide transaction. (Module 08 / 09 will consume these stages.)

