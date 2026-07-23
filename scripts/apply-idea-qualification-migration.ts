import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const file = path.join(
  process.cwd(),
  'prisma/migrations/20260723140000_idea_qualification/migration.sql',
);

async function main() {
  const sql = fs.readFileSync(file, 'utf8');
  await prisma.$executeRawUnsafe(sql);
  const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM sys.tables WHERE name LIKE 'iq_%' ORDER BY name`,
  );
  console.log(
    'idea qualification migration applied:',
    tables.map((row) => row.name).join(', '),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
