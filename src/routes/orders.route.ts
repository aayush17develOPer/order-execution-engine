import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { OrderExecutionService } from '../services/order-execution.service';
import { OrderQueueService } from '../services/order-queue.service';
import { OrderType } from '../models/order.model';

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

  // Create and execute order
  fastify.post('/api/orders/execute', async (request, reply) => {
    try {
      const body = createOrderSchema.parse(request.body);
      const order = await executionService.createOrder(body);
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

  // WebSocket endpoint - Correct syntax for @fastify/websocket v10
  fastify.register(async function (fastify) {
    fastify.get('/api/orders/:orderId/stream', { websocket: true }, (socket, req) => {
      const { orderId } = req.params as { orderId: string };

      // Send connection confirmation
      socket.send(
        JSON.stringify({
          type: 'connected',
          orderId,
          timestamp: new Date().toISOString(),
          message: 'WebSocket connected. Listening for order updates...',
        })
      );

      // Get queue events from BullMQ
      const queueEvents = queueService.getQueueEvents();

      // Handler for job progress
      const progressHandler = async ({ jobId, data }: any) => {
        if (jobId === orderId) {
          fastify.log.info({ jobId, data }, 'Sending progress update via WebSocket');
          socket.send(
            JSON.stringify({
              type: 'status_update',
              orderId: jobId,
              data,
              timestamp: new Date().toISOString(),
            })
          );
        }
      };

      // Handler for job completion
      const completedHandler = async ({ jobId, returnvalue }: any) => {
        if (jobId === orderId) {
          fastify.log.info({ jobId }, 'Sending completion update via WebSocket');
          socket.send(
            JSON.stringify({
              type: 'completed',
              orderId: jobId,
              result: returnvalue,
              timestamp: new Date().toISOString(),
            })
          );
        }
      };

      // Handler for job failure
      const failedHandler = async ({ jobId, failedReason }: any) => {
        if (jobId === orderId) {
          fastify.log.error({ jobId, failedReason }, 'Sending failure update via WebSocket');
          socket.send(
            JSON.stringify({
              type: 'failed',
              orderId: jobId,
              error: failedReason,
              timestamp: new Date().toISOString(),
            })
          );
        }
      };

      // Register event listeners
      queueEvents.on('progress', progressHandler);
      queueEvents.on('completed', completedHandler);
      queueEvents.on('failed', failedHandler);

      // Handle client messages
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

      // Cleanup on disconnect
      socket.on('close', () => {
        fastify.log.info({ orderId }, 'WebSocket connection closed');
        queueEvents.off('progress', progressHandler);
        queueEvents.off('completed', completedHandler);
        queueEvents.off('failed', failedHandler);
      });

      socket.on('error', (error: Error) => {
        fastify.log.error({ orderId, error }, 'WebSocket error');
      });
    });
  });

  // Get order details
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

  // Get queue metrics
  fastify.get('/api/metrics', async () => {
    const metrics = await queueService.getMetrics();
    return {
      success: true,
      metrics,
      timestamp: new Date().toISOString(),
    };
  });

  // Health check
  fastify.get('/health', async () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  }));
}
