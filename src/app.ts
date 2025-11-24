import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { readFileSync } from 'fs';
import { join } from 'path';
import { orderRoutes } from './routes/orders.route';
import { OrderWorker } from './workers/order.worker';
import { runMigrations } from './migrations/setup';

const fastify = Fastify({ logger: true });

// Serve index.html
fastify.get('/', async (request, reply) => {
  const html = readFileSync(join(__dirname, '..', 'public', 'index.html'), 'utf-8');
  reply.type('text/html').send(html);
});

fastify.get('/index.html', async (request, reply) => {
  const html = readFileSync(join(__dirname, '..', 'public', 'index.html'), 'utf-8');
  reply.type('text/html').send(html);
});

fastify.register(websocket);
fastify.register(orderRoutes);

const worker = new OrderWorker();

const start = async () => {
  try {
    // ✅ Run migrations before starting server
    await runMigrations();

    await fastify.listen({ port: parseInt(process.env.PORT || '3000'), host: '0.0.0.0' });
    fastify.log.info('🚀 Server running at http://localhost:3000');
    fastify.log.info('📊 Test dashboard: http://localhost:3000/');
    fastify.log.info('⚙️  Worker started and listening for orders');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

process.on('SIGTERM', async () => {
  await worker.close();
  await fastify.close();
  process.exit();
});

process.on('SIGINT', async () => {
  await worker.close();
  await fastify.close();
  process.exit();
});
