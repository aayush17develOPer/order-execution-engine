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

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
  };
});

fastify.register(websocket);
fastify.register(orderRoutes);

const worker = new OrderWorker();

const start = async () => {
  try {
    await runMigrations();

    const port = parseInt(process.env.PORT || '3000');
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`🚀 Server running on port ${port}`);
    fastify.log.info('📊 Test dashboard available');
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
