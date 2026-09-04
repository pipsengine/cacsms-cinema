import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDb, getDb } from './client.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const seedDir = path.resolve(here, '../sql/seeds');

try {
  const db = await getDb();
  const files = (await fs.readdir(seedDir)).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sqlText = await fs.readFile(path.join(seedDir, file), 'utf8');
    for (const batch of sqlText.split(/^\s*GO\s*$/gim).filter(Boolean)) {
      await db.request().batch(batch);
    }
    console.log(`Applied seed: ${file}`);
  }
} finally {
  await closeDb();
}
