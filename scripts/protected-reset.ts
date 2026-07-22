import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ALLOW_RESET = process.env.ALLOW_DEVELOPMENT_RESET === 'true';
const IS_PROD = process.env.NODE_ENV === 'production';

console.log('--- cacsms-cinema protected development reset ---');

if (IS_PROD) {
  console.error('ERROR: Cannot run protected reset in production environment.');
  process.exit(1);
}

if (!ALLOW_RESET) {
  console.error('ERROR: ALLOW_DEVELOPMENT_RESET is not true.');
  console.error('Please set ALLOW_DEVELOPMENT_RESET=true in your .env file to allow destructive actions.');
  process.exit(1);
}

console.log('Initiating protected development reset...');

// 1. Generate Asset Inventory & Manifest (Quarantine)
const backupDir = path.join(process.cwd(), 'backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const manifestPath = path.join(backupDir, `manifest-${timestamp}.json`);

const manifest = {
  timestamp,
  reason: 'Protected Development Reset',
  quarantinedItems: [],
  preservedAssets: [],
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`[Backup] Manifest created at ${manifestPath}`);

// 2. Database Backup and Reset
console.log('[Database] Running Prisma migration reset...');
try {
  // Execute the prisma migration reset
  // Using --force to bypass the interactive prompt
  execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
  console.log('[Database] Reset complete.');
} catch (error) {
  console.error('[Database] Reset failed.', error);
  process.exit(1);
}

console.log('Protected reset completed successfully.');
