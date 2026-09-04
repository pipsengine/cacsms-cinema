# Autonomous Content Generator

Production repository foundation for an end-to-end autonomous AI content generation platform.

## Repository goals

This repository is intentionally modular so the platform can be implemented one module at a time while preserving a single production architecture.

Core lifecycle:

`Human Start → Strategy → Opportunity → Research → Concept → Script → Fact Check → Character/Scene Planning → Images → Video → Voice/Audio → Edit → QA → Packaging → Approval → Publishing → Analytics → AI Learning`

## Monorepo structure

- `apps/web` — Next.js web application and professional enterprise UI
- `apps/api` — API/service layer
- `packages/ui` — shared Figma-style design system components
- `packages/types` — shared domain contracts
- `packages/config` — shared runtime/configuration helpers
- `packages/database` — database schema/client layer
- `docs` — architecture, module specifications, API/database/design/operations docs
- `infra` — Docker, reverse proxy and deployment scripts
- `.github/workflows` — CI pipelines

## Git identity

This repository is initialized with:

- Git user: `pipsengine`
- Git email: `pipsengine@gmail.com`

A GitHub remote is intentionally not hard-coded because a repository URL has not yet been provided. Create an empty GitHub repository, then run:

```bash
git remote add origin https://github.com/pipsengine/<repo-name>.git
git branch -M main
git push -u origin main
```

## Development prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL 16+ (planned production default)
- Docker Desktop (recommended)

## First development steps

```bash
pnpm install
pnpm dev
```

The starter currently provides the repository foundation, module boundaries, workflow contracts, UI tokens and placeholder applications. We will add each production module to this repo in sequence.
