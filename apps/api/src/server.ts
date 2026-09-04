import Fastify from 'fastify';
import { closeDb } from '@acg/database';

const app = Fastify({ logger: true });

app.get('/health', async () => ({
  status: 'ok',
  service: 'autonomous-content-generator-api',
  version: '0.1.0'
}));

async function shutdown(signal: string, code: number): Promise<void> {
  app.log.info(`${signal} received, shutting down gracefully...`);
  try {
    await app.close();
  } catch (error) {
    app.log.error(error, 'Error closing Fastify server');
  }
  try {
    await closeDb();
  } catch (error) {
    app.log.error(error, 'Error closing database pool');
  }
  process.exit(code);
}

process.on('SIGINT', () => void shutdown('SIGINT', 0));
process.on('SIGTERM', () => void shutdown('SIGTERM', 0));

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? '0.0.0.0';
app.listen({ port, host }).catch((error) => {
  app.log.error(error, 'Failed to start API server');
  void closeDb().finally(() => process.exit(1));
});
