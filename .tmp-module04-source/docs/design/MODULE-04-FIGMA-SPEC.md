# Module 04 — Figma Design Specification

## Design language

White enterprise workspace, restrained blue primary accent, 1px neutral borders, subtle shadows, 8–11px corner radii, dense but readable information hierarchy and status colour consistency with Modules 01–03.

## Strategy register

Header + brief status KPI band + search/filter toolbar + governed project/brief table. Rows show project identity, strategic direction, version, priority, status and last update.

## Strategy workspace

Three-column desktop layout:

1. **Section rail** — nine strategy sections with completion indicator and output contract.
2. **Main editor** — structured form workspace; cards only for repeatable entities such as audience segments/platform strategies/success metrics.
3. **Context rail** — upstream project input, AI-assistant actions and version/approval state.

The page header always shows project code, working title, brief status, version, unsaved-state indicator and completeness percentage.

## Status colours

- Draft / Not Started: neutral grey
- In Review / Awaiting Approval: blue
- Approved / Completed: green
- Returned / Blocked: red
- AI processing: purple where applicable
- In-progress workflow: amber

## Handoff visualisation

The Review section ends with a visible `Strategy & Brief → Opportunity Discovery` contract. On approval, the first node is green/completed and the downstream node is blue/ready.

## Responsive behaviour

Below 1200px the context rail moves beneath the editor. Below 850px section navigation becomes horizontally scrollable and all multi-column forms collapse to one column.
