import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDb, getDb } from './client.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const seedDir = path.resolve(here, '../sql/seeds');

try {
  const db = await getDb();
  await db.request().query(`
    IF OBJECT_ID('dbo.__SchemaSeeds', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.__SchemaSeeds (
        SeedId INT IDENTITY(1,1) PRIMARY KEY,
        FileName NVARCHAR(255) NOT NULL UNIQUE,
        AppliedAt DATETIME2 NOT NULL CONSTRAINT DF_SchemaSeeds_AppliedAt DEFAULT SYSUTCDATETIME()
      );
    END;
  `);

  const files = (await fs.readdir(seedDir)).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const exists = await db.request().input('file', file).query(
      'SELECT 1 AS found FROM dbo.__SchemaSeeds WHERE FileName = @file'
    );
    if (exists.recordset.length) {
      console.log(`Skipping seed (already applied): ${file}`);
      continue;
    }

    const sqlText = await fs.readFile(path.join(seedDir, file), 'utf8');
    const transaction = db.transaction();
    await transaction.begin();
    try {
      for (const batch of sqlText.split(/^\s*GO\s*$/gim).filter(Boolean)) {
        await transaction.request().batch(batch);
      }
      await transaction.request().input('file', file).query(
        'INSERT INTO dbo.__SchemaSeeds (FileName) VALUES (@file)'
      );
      await transaction.commit();
      console.log(`Applied seed: ${file}`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
} finally {
  await closeDb();
}
