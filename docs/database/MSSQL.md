# Microsoft SQL Server Architecture

Cacsms Cinema uses Microsoft SQL Server as its primary relational database.

## Supported deployment targets

- SQL Server 2022 Developer for local development
- SQL Server 2019/2022 Standard or Enterprise for self-hosted production
- Azure SQL Database / Azure SQL Managed Instance with configuration adjustments

## Development database

Copy `.env.example` to `.env`, change the SA password, then start SQL Server:

```bash
docker compose up -d mssql
```

Create the application database once SQL Server is healthy:

```sql
IF DB_ID(N'CacsmsCinema') IS NULL
    CREATE DATABASE CacsmsCinema;
```

Then run:

```bash
pnpm install
pnpm --filter @cacsms/database db:migrate
pnpm --filter @cacsms/database db:seed
pnpm --filter @cacsms/database db:ping
```

## Production rules

- Do not use the `sa` account from the application in production.
- Create a least-privilege application login/user.
- Use TLS encryption in production (`MSSQL_ENCRYPT=true`).
- Store secrets in the deployment platform's secret store, not in Git.
- Use automated full/differential/log backups appropriate to the selected recovery model.
- All schema changes must be delivered through ordered migration files.
- Application queries should be parameterized through the `mssql` driver.

## Naming and schema conventions

- Default application schema: `dbo` for the foundation; domain schemas may be introduced as modules are implemented.
- Primary keys: `UNIQUEIDENTIFIER` with `NEWSEQUENTIALID()` where practical.
- Timestamps: `DATETIME2`, stored in UTC.
- Status fields: constrained `NVARCHAR` values until a domain lookup is justified.
- Multi-workspace records must carry `WorkspaceId` and appropriate indexes.

## Migration system

Migration files live in `packages/database/sql/migrations` and are applied alphabetically. Applied files are recorded in `dbo.__SchemaMigrations`.

Seeds live in `packages/database/sql/seeds` and should be idempotent whenever possible.
