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
- `packages/database` — Microsoft SQL Server client, migrations, seeds and schema layer
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
- Microsoft SQL Server 2019+ / SQL Server 2022 recommended
- Docker Desktop (recommended)

## First development steps

1. Copy `.env.example` to `.env` and change the MSSQL password.
2. Start the local SQL Server container:

```bash
docker compose up -d mssql
```

3. Create the database with `infra/mssql/create-database.sql`, then install and migrate:

```bash
pnpm install
pnpm --filter @acg/database db:migrate
pnpm --filter @acg/database db:seed
pnpm --filter @acg/database db:ping
pnpm dev
```

See `docs/database/MSSQL.md` for production database guidance.

The starter currently provides the repository foundation, MSSQL persistence layer, module boundaries, workflow contracts, UI tokens and placeholder applications. We will add each production module to this repo in sequence.
