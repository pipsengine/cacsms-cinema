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
  try {
    const { recoverActiveWorkflowRuns } = await import('../../../lib/visual-workflow/service');
    const recovered = await recoverActiveWorkflowRuns();
    if (recovered > 0) console.log(`Recovered ${recovered} interrupted visual workflow run(s) from checkpoint.`);
  } catch (error) {
    console.error('Visual workflow recovery on startup failed:', error instanceof Error ? error.message : error);
  }
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
