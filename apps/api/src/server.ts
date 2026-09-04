import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/health', async () => ({
  status: 'ok',
  service: 'autonomous-content-generator-api',
  version: '0.1.0'
}));

const port = Number(process.env.API_PORT ?? 4000);
app.listen({ port, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
