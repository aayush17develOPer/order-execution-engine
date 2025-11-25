import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { readFileSync } from 'fs';
import { join } from 'path';
import { orderRoutes } from './routes/orders.route';
import { OrderWorker } from './workers/order.worker';
import { runMigrations } from './migrations/setup';
import { query } from './config/database';
import { orderQueueService } from './services/order-queue.service';

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

// Metrics endpoint with real order statistics
fastify.get('/api/metrics', async (request, reply) => {
  try {
    // Get queue metrics from BullMQ
    const queueMetrics = await orderQueueService.getMetrics();

    // Get actual order statistics from database
    const orderStats = await query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM orders
      GROUP BY status
    `);

    // Convert to object with all possible statuses
    const stats: Record<string, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0,
    };

    orderStats.rows.forEach((row: any) => {
      stats[row.status] = parseInt(row.count);
      stats.total += parseInt(row.count);
    });

    return {
      success: true,
      queue: queueMetrics,
      orders: stats,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    fastify.log.error('Metrics error:', error);
    reply.status(500);
    return { success: false, error: error.message };
  }
});

// Order statistics endpoint
fastify.get('/api/orders/stats', async (request, reply) => {
  try {
    const result = await query(`
      SELECT 
        status,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as last_hour
      FROM orders
      GROUP BY status
      ORDER BY status
    `);

    return {
      success: true,
      stats: result.rows,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    fastify.log.error('Stats error:', error);
    reply.status(500);
    return { success: false, error: error.message };
  }
});

fastify.register(websocket);
fastify.register(orderRoutes);

const worker = new OrderWorker();

const start = async () => {
  try {
    // ✅ Run migrations before starting server
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
