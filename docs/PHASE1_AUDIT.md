# Phase 1: Repository Audit and Protected Rebuild Planning

## 1. Current-State Audit
After inspecting the entire workspace, the current repository state is a **fresh, empty Next.js environment** bootstrapped with Tailwind CSS, TypeScript, and basic Next.js routing.
- **Expected vs. Actual:** The prompt assumes an existing CACSMS stack with `apps/web/*`, `apps/api/src/main.ts`, an existing sidebar, background workers, and MS SQL integrations. None of these exist in the current repository.
- **Frontend:** Basic Next.js App Router structure in `/app`. No `apps/web/features` or shared components.
- **Backend:** No Node.js custom server (`server.js` or `main.ts`) exists yet. No API routes.
- **Database:** No MS SQL Server drivers, ORMs, schemas, or migrations present.
- **Image Generation:** No existing image generation services, provider integrations, background workers, or prompt-building logic.

## 2. Blank-Image Root-Cause Analysis
- **Finding:** N/A. Since there is no existing system or previous generation logic in this workspace, there are no historical blank-image failures to diagnose. Future architecture will implement the "Blank-Image Prevention" gate (checking file signature, alpha channel, pixel variance) to prevent this from occurring.

## 3. Reusable-Component Inventory
- **Reusable:** The base Next.js 15 App Router configuration, Tailwind v4 setup, and TypeScript configurations are solid and will be used as the foundation.
- **Missing:** The established CACSMS design system, sidebar, navigation, shell, and breadcrumbs are not present and will need to be built from scratch.

## 4. Fake and Incomplete Implementation Inventory
- **Finding:** No fake or simulated implementations exist because no implementation exists yet. We will build real integrations from the start.

## 5. Database and Storage Assessment
- **Finding:** No MS SQL Server database or storage mechanism is currently configured.
- **Action:** We must initialize an MS SQL ORM (e.g., Prisma or Drizzle ORM configured for SQL Server) and set up the schema and migration pipeline in the next phase. Durable file storage (e.g., local disk staging mirroring an object store) must be established.

## 6. Target Architecture
Given the constraints and the goal of a robust, autonomous system:
- **Monorepo vs. Fullstack Next.js:** To align with standard Next.js deployment and the AI Studio environment, we will use the Next.js App Router for both the frontend (React/Tailwind) and the API layer (`app/api/*`). Complex orchestrations and background workers will be managed via robust server-side async logic (or a custom Node server if strict Windows Service compatibility is required later, but API routes will suffice for the orchestration state machine).
- **Database:** MS SQL Server accessed via an ORM (Prisma/Drizzle) for strong typing and migration management.
- **State Machine:** A transactional outbox pattern stored in MS SQL to manage the complex autonomous lifecycle (Discover -> Interpret -> ... -> Approve).
- **Provider Adapters:** Abstracted interfaces for models (e.g., using `@google/genai` for reasoning/evaluations and external adapters for generation).

## 7. Migration Plan & Protected Reset Plan
- Since the repository is empty, no data migration or quarantine is needed.
- **Protected Reset Plan:** We will implement a database reset script (`npm run db:reset`) that strictly checks `process.env.ALLOW_DEVELOPMENT_RESET === 'true'` and `process.env.NODE_ENV !== 'production'` before dropping or migrating schemas.

## 8. Implementation Backlog
Based on the mandatory implementation order:
1. **Phase 1:** Repository Audit and Protected Rebuild Planning (Completed).
2. **Phase 2:** Base Architecture, MSSQL Setup, and Protected Reset scripts.
3. **Phase 3:** Core Shell UI (Sidebar, Navigation, Layout).
4. **Phase 4:** Durable Job Orchestration Engine (State machine models & API).
5. **Phase 5:** Provider Adapters & Capability Registry.
6. **Phase 6:** Visual Requirements Compiler & Scene Graph validation.
7. **Phase 7:** Script Writer & Storyboard Improvements.
8. **Phase 8:** Real Candidate Generation & Storage Abstraction.
9. **Phase 9:** Quality Evaluation Ensemble & Defect Diagnosis.
10. **Phase 10:** Autonomous Repair & Operational Dashboards.

## 9. Phase-One Acceptance Criteria
- [x] Repository audit completed and documented.
- [x] Discrepancies between expected and actual state identified.
- [x] Target architecture defined.
- [x] Implementation backlog and phased approach established.
- [x] Protected reset and migration strategy defined.