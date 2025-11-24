import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { OrderExecutionService } from '../services/order-execution.service';
import { OrderJobData } from '../services/order-queue.service';
import { OrderType } from '../models/order.model';
import { logger } from '../utils/logger';

export class OrderWorker {
  private worker: Worker<OrderJobData>;
  private executionService: OrderExecutionService;

  constructor() {
    this.executionService = new OrderExecutionService();
    this.worker = new Worker<OrderJobData>(
      'order-execution',
      async (job: Job<OrderJobData>) => {
        const { orderId, orderData } = job.data;

        logger.info({ jobId: job.id, orderId }, '🚀 Worker processing order');

        try {
          if (orderData.orderType === OrderType.MARKET) {
            // This will emit events during processing
            await this.executionService.processMarketOrder(orderData);

            logger.info({ orderId }, '✅ Worker completed order processing');
            return { success: true, orderId };
          } else {
            throw new Error('Only market orders implemented in mock');
          }
        } catch (error: any) {
          logger.error({ jobId: job.id, orderId, error: error.message }, '❌ Worker job failed');
          throw error;
        }
      },
      {
        connection: redisConnection.duplicate(),
        concurrency: 10,
        limiter: { max: 100, duration: 60000 },
      }
    );

    this.worker.on('completed', job => {
      logger.info(
        { jobId: job.id, orderId: job.data.orderId },
        'Worker job completed successfully'
      );
    });

    this.worker.on('failed', (job, err) => {
      logger.error(
        {
          jobId: job?.id,
          orderId: job?.data.orderId,
          error: err.message,
        },
        'Worker job failed'
      );
    });
  }

  async close() {
    await this.worker.close();
    logger.info('Worker closed');
  }
}
