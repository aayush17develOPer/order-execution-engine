import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { OrderExecutionService } from '../services/order-execution.service';
import { OrderQueueService } from '../services/order-queue.service';
import { orderEvents } from '../services/order-events.service';
import { OrderType, OrderStatus } from '../models/order.model';

const createOrderSchema = z.object({
  orderType: z.nativeEnum(OrderType),
  tokenIn: z.string().min(1),
  tokenOut: z.string().min(1),
  amountIn: z.number().positive(),
  slippage: z.number().min(0).max(1).optional(),
  limitPrice: z.number().positive().optional(),
});

export async function orderRoutes(fastify: FastifyInstance) {
  const executionService = new OrderExecutionService();
  const queueService = new OrderQueueService();

  fastify.post('/api/orders/execute', async (request, reply) => {
    try {
      const body = createOrderSchema.parse(request.body);
      const order = await executionService.createOrder(body);

      orderEvents.emitOrderUpdate(order.id, OrderStatus.PENDING, {
        message: 'Order received, queued for processing...',
      });

      await queueService.addOrder(order.id, order);

      return {
        success: true,
        orderId: order.id,
        status: order.status,
        message: 'Order created. Connect to WebSocket for live updates.',
        websocketUrl: `/api/orders/${order.id}/stream`,
      };
    } catch (error: any) {
      return reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.register(async function (fastify) {
    fastify.get('/api/orders/:orderId/stream', { websocket: true }, (socket, req) => {
      const { orderId } = req.params as { orderId: string };

      socket.send(
        JSON.stringify({
          type: 'connected',
          orderId,
          timestamp: new Date().toISOString(),
          message: 'WebSocket connected. Listening for order updates...',
        })
      );

      const updateHandler = (update: any) => {
        fastify.log.info({ orderId, update }, 'Sending update via WebSocket');
        socket.send(
          JSON.stringify({
            type: 'status_update',
            ...update,
          })
        );
      };

      orderEvents.on(`order:${orderId}`, updateHandler);

      socket.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'ping') {
            socket.send(
              JSON.stringify({
                type: 'pong',
                timestamp: new Date().toISOString(),
              })
            );
          }
        } catch (error) {
          fastify.log.error({ error }, 'Failed to parse WebSocket message');
        }
      });

      socket.on('close', () => {
        fastify.log.info({ orderId }, 'WebSocket connection closed');
        orderEvents.off(`order:${orderId}`, updateHandler);
      });

      socket.on('error', (error: Error) => {
        fastify.log.error({ orderId, error }, 'WebSocket error');
      });
    });
  });

  fastify.register(async function (fastify) {
    fastify.get('/api/orders/stream/all', { websocket: true }, (socket, req) => {
      fastify.log.info('Client connected to global order stream');
      console.log('🌐 Global WebSocket connection established');

      socket.send(
        JSON.stringify({
          type: 'connected',
          timestamp: new Date().toISOString(),
          message: 'Connected to global order stream. Listening for all order updates...',
        })
      );

      const globalUpdateHandler = (update: any) => {
        console.log(
          '🎯 Global handler received update:',
          update.orderId.substring(0, 8),
          update.status
        );
        fastify.log.info({ update }, 'Broadcasting update to global stream');
        socket.send(
          JSON.stringify({
            type: 'status_update',
            ...update,
          })
        );
      };

      orderEvents.on('orderUpdate', globalUpdateHandler);
      console.log('✅ Subscribed to global "orderUpdate" event');
      console.log('📡 Current global listeners:', orderEvents.listenerCount('orderUpdate'));

      socket.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'ping') {
            socket.send(
              JSON.stringify({
                type: 'pong',
                timestamp: new Date().toISOString(),
              })
            );
          }
        } catch (error) {
          fastify.log.error({ error }, 'Failed to parse WebSocket message');
        }
      });

      socket.on('close', () => {
        console.log('🔌 Global WebSocket disconnected, removing listener');
        fastify.log.info('Global order stream disconnected');
        orderEvents.off('orderUpdate', globalUpdateHandler);
        console.log('📡 Remaining global listeners:', orderEvents.listenerCount('orderUpdate'));
      });

      socket.on('error', (error: Error) => {
        fastify.log.error({ error }, 'Global WebSocket error');
      });
    });
  });

  fastify.get('/api/orders/:orderId', async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const order = await executionService.getOrder(orderId);

    if (!order) {
      return reply.code(404).send({
        success: false,
        error: 'Order not found',
      });
    }

    return { success: true, order };
  });

  fastify.get('/api/metrics', async () => {
    const metrics = await queueService.getMetrics();
    return {
      success: true,
      metrics,
      timestamp: new Date().toISOString(),
    };
  });

  fastify.get('/health', async () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  }));
}
