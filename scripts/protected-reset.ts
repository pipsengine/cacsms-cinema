import { createHash } from 'crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import path from 'path';
import { prisma } from '../lib/db';

const EXECUTE = process.argv.includes('--execute');
const CONFIRMATION = process.argv.find((argument) => argument.startsWith('--confirm='))?.split('=')[1];
const REQUIRED_CONFIRMATION = 'RESET_DEVELOPMENT_DATA';
const ALLOW_RESET = process.env.ALLOW_DEVELOPMENT_RESET === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const WORKSPACE = process.cwd();
const BACKUP_ROOT = path.resolve(WORKSPACE, process.env.RESET_BACKUP_ROOT ?? 'backups');
const ASSET_ROOT = path.resolve(WORKSPACE, process.env.ASSET_STORAGE_ROOT ?? 'storage/assets');

interface FileAction {
  source: string;
  destination?: string;
  status: 'planned' | 'preserved' | 'quarantined' | 'external' | 'missing' | 'failed';
  reason: string;
  error?: string;
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const runDirectory = path.join(BACKUP_ROOT, `reset-${timestamp}`);
const snapshotPath = path.join(runDirectory, 'database-snapshot.json');
const manifestPath = path.join(runDirectory, 'manifest.json');
const preservedDirectory = path.join(runDirectory, 'preserved-assets');
const quarantineDirectory = path.join(runDirectory, 'quarantine');

function ensureExecutionGuards() {
  if (IS_PRODUCTION) throw new Error('Protected reset is forbidden in production.');
  if (!ALLOW_RESET) throw new Error('ALLOW_DEVELOPMENT_RESET must be true.');
  if (CONFIRMATION !== REQUIRED_CONFIRMATION) {
    throw new Error(`Execution requires --confirm=${REQUIRED_CONFIRMATION}.`);
  }
}

function databaseName() {
  const match = process.env.DATABASE_URL?.match(/(?:^|;)database=([^;]+)/i);
  return match?.[1] ?? 'unknown';
}

function sha256(filePath: string) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function localAssetPath(assetUrl: string): string | null {
  if (/^https?:\/\//i.test(assetUrl)) return null;
  const withoutQuery = assetUrl.split(/[?#]/, 1)[0];
  const relative = withoutQuery.startsWith('/') ? withoutQuery.slice(1) : withoutQuery;
  const resolved = path.resolve(WORKSPACE, relative);
  return resolved.startsWith(ASSET_ROOT, process.platform === 'win32' ? undefined : 0) ? resolved : null;
}

function uniqueDestination(directory: string, source: string) {
  const relative = path.relative(ASSET_ROOT, source);
  const safeRelative = relative.startsWith('..') ? path.basename(source) : relative;
  return path.join(directory, safeRelative);
}

function copyPreservedFile(source: string, actions: FileAction[]) {
  if (!existsSync(source)) {
    actions.push({ source, status: 'missing', reason: 'Approved asset file was not found.' });
    return;
  }
  const destination = uniqueDestination(preservedDirectory, source);
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  actions.push({ source, destination, status: 'preserved', reason: 'Approved asset and lineage are retained.' });
}

function quarantineFile(source: string, actions: FileAction[]) {
  if (!existsSync(source)) {
    actions.push({ source, status: 'missing', reason: 'Referenced non-approved file was not found.' });
    return;
  }
  const destination = uniqueDestination(quarantineDirectory, source);
  mkdirSync(path.dirname(destination), { recursive: true });
  try {
    renameSync(source, destination);
  } catch {
    try {
      copyFileSync(source, destination);
      unlinkSync(source);
    } catch (error) {
      actions.push({
        source,
        destination,
        status: 'failed',
        reason: 'Could not quarantine non-approved asset.',
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }
  actions.push({ source, destination, status: 'quarantined', reason: 'Non-approved local media was quarantined.' });
}

async function loadSnapshot() {
  const [projects, jobs, attempts, candidates, assets] = await Promise.all([
    prisma.project.findMany(),
    prisma.job.findMany(),
    prisma.generationAttempt.findMany(),
    prisma.candidate.findMany(),
    prisma.asset.findMany(),
  ]);
  return { capturedAt: new Date().toISOString(), database: databaseName(), projects, jobs, attempts, candidates, assets };
}

async function main() {
  console.log('--- CACSMS protected development reset ---');
  console.log(`Mode: ${EXECUTE ? 'EXECUTE' : 'PLAN ONLY'}`);
  console.log(`Database: ${databaseName()}`);
  console.log(`Asset root: ${ASSET_ROOT}`);

  const snapshot = await loadSnapshot();
  const approvedAssets = snapshot.assets.filter((asset) => asset.status === 'APPROVED');
  const approvedCandidateIds = new Set(approvedAssets.map((asset) => asset.candidateId));
  const preservedJobIds = new Set(
    snapshot.candidates.filter((candidate) => approvedCandidateIds.has(candidate.id)).map((candidate) => candidate.jobId)
  );
  const preservedProjectIds = new Set(
    snapshot.jobs.filter((job) => preservedJobIds.has(job.id)).map((job) => job.projectId)
  );
  const removableProjectIds = snapshot.projects
    .filter((project) => !preservedProjectIds.has(project.id))
    .map((project) => project.id);

  console.log(`Records: ${snapshot.projects.length} projects, ${snapshot.jobs.length} jobs, ${snapshot.candidates.length} candidates, ${snapshot.assets.length} assets.`);
  console.log(`Preserved approved lineage: ${approvedAssets.length} assets across ${preservedProjectIds.size} projects.`);
  console.log(`Projects eligible for reset: ${removableProjectIds.length}.`);

  if (!EXECUTE) {
    console.log(`No changes made. Execute only with --execute --confirm=${REQUIRED_CONFIRMATION}.`);
    return;
  }

  ensureExecutionGuards();
  mkdirSync(runDirectory, { recursive: true });
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  const snapshotChecksum = sha256(snapshotPath);
  if (!snapshotChecksum || statSync(snapshotPath).size === 0) throw new Error('Database snapshot verification failed.');

  const fileActions: FileAction[] = [];
  for (const asset of approvedAssets) {
    const source = localAssetPath(asset.assetUrl);
    if (source) copyPreservedFile(source, fileActions);
    else fileActions.push({ source: asset.assetUrl, status: 'external', reason: 'Approved external reference recorded; no local file operation.' });
  }

  const removableJobIds = new Set(
    snapshot.jobs.filter((job) => removableProjectIds.includes(job.projectId)).map((job) => job.id)
  );
  const candidateFiles = snapshot.candidates
    .filter((candidate) => removableJobIds.has(candidate.jobId))
    .map((candidate) => candidate.imageUrl);

  const deletedCounts = await prisma.$transaction(async (transaction) => {
    const before = {
      projects: await transaction.project.count({ where: { id: { in: removableProjectIds } } }),
      jobs: await transaction.job.count({ where: { projectId: { in: removableProjectIds } } }),
    };
    const deleted = removableProjectIds.length
      ? await transaction.project.deleteMany({ where: { id: { in: removableProjectIds } } })
      : { count: 0 };
    return { ...before, projectsDeleted: deleted.count };
  });

  for (const assetUrl of candidateFiles) {
    const source = localAssetPath(assetUrl);
    if (source) quarantineFile(source, fileActions);
    else fileActions.push({ source: assetUrl, status: 'external', reason: 'External non-approved reference recorded; no local file operation.' });
  }

  const manifest = {
    version: 1,
    operation: 'protected-development-reset',
    timestamp,
    database: databaseName(),
    guards: { allowDevelopmentReset: ALLOW_RESET, production: IS_PRODUCTION, confirmation: true },
    backup: { type: 'complete-logical-snapshot', path: snapshotPath, sha256: snapshotChecksum, bytes: statSync(snapshotPath).size },
    inventory: {
      projects: snapshot.projects.length,
      jobs: snapshot.jobs.length,
      attempts: snapshot.attempts.length,
      candidates: snapshot.candidates.length,
      assets: snapshot.assets.length,
    },
    preservation: { approvedAssets: approvedAssets.length, projectIds: [...preservedProjectIds] },
    deletion: { ...deletedCounts, projectIds: removableProjectIds },
    files: fileActions,
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Verified backup: ${snapshotPath}`);
  console.log(`Audit manifest: ${manifestPath}`);
  console.log('Protected reset completed. Approved lineage was preserved.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
