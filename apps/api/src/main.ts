import { prisma } from '../../../lib/db';
import { JobOrchestrator } from '../../../lib/job-orchestrator';
import { registerAutonomousStageHandlers } from '../../../lib/autonomous-stage-handlers';

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS || 1000);
let isRunning = true;

registerAutonomousStageHandlers();

const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const shutdown = (signal: string) => {
  console.log(`${signal} received; finishing the current worker cycle...`);
  isRunning = false;
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function runWorker() {
  console.log('Starting cacsms-cinema background worker...');
  console.log('Background worker listening for jobs...');

  while (isRunning) {
    await JobOrchestrator.pollAndProcessJobs();
    if (isRunning) await delay(POLL_INTERVAL_MS);
  }
}

runWorker()
  .catch((error) => {
    console.error('Background worker stopped unexpectedly:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('Background worker stopped.');
  });
