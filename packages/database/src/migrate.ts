import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDb, getDb } from './client.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '../sql/migrations');

async function run() {
  const db = await getDb();
  await db.request().query(`
    IF OBJECT_ID('dbo.__SchemaMigrations', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.__SchemaMigrations (
        MigrationId INT IDENTITY(1,1) PRIMARY KEY,
        FileName NVARCHAR(255) NOT NULL UNIQUE,
        AppliedAt DATETIME2 NOT NULL CONSTRAINT DF_SchemaMigrations_AppliedAt DEFAULT SYSUTCDATETIME()
      );
    END;
  `);

  const files = (await fs.readdir(migrationsDir)).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const exists = await db.request().input('file', file).query(
      'SELECT 1 AS found FROM dbo.__SchemaMigrations WHERE FileName = @file'
    );
    if (exists.recordset.length) continue;

    const sqlText = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    const transaction = db.transaction();
    await transaction.begin();
    try {
      for (const batch of sqlText.split(/^\s*GO\s*$/gim).filter(Boolean)) {
        await transaction.request().batch(batch);
      }
      await transaction.request().input('file', file).query(
        'INSERT INTO dbo.__SchemaMigrations (FileName) VALUES (@file)'
      );
      await transaction.commit();
      console.log(`Applied migration: ${file}`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

try { await run(); } finally { await closeDb(); }
