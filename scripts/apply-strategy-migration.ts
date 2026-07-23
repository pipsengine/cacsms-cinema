import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const file = path.join(
  process.cwd(),
  'prisma/migrations/20260723120000_strategy_command_centre/migration.sql',
);

async function main() {
  const sql = fs.readFileSync(file, 'utf8');
  await prisma.$executeRawUnsafe(sql);
  const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM sys.tables WHERE name IN ('content_strategies','content_strategy_versions','strategy_records') ORDER BY name`,
  );
  console.log('strategy migration applied:', tables.map((row) => row.name).join(', '));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
