import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { OrderExecutionService } from '../services/order-execution.service';
import { OrderJobData } from '../services/order-queue.service';
import { OrderType } from '../models/order.model';

export class OrderWorker {
  private worker: Worker<OrderJobData>;
  private executionService: OrderExecutionService;

  constructor() {
    this.executionService = new OrderExecutionService();
    this.worker = new Worker<OrderJobData>(
      'order-execution',
      async (job: Job<OrderJobData>) => {
        const { orderData } = job.data;
        if (orderData.orderType === OrderType.MARKET) {
          return this.executionService.processMarketOrder(orderData);
        }
        throw new Error('Only market orders implemented in mock');
      },
      {
        connection: redisConnection.duplicate(),
        concurrency: 10,
        limiter: { max: 100, duration: 60000 },
      }
    );
  }
  async close() {
    await this.worker.close();
  }
}
