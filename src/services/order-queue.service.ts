import { Queue, QueueEvents } from 'bullmq';
import { redisConnection } from '../config/redis';
import { Order, OrderType } from '../models/order.model';

export interface OrderJobData {
  orderId: string;
  orderData: Order;
}

export class OrderQueueService {
  private queue: Queue<OrderJobData>;
  private queueEvents: QueueEvents;

  constructor() {
    this.queue = new Queue<OrderJobData>('order-execution', { connection: redisConnection });
    this.queueEvents = new QueueEvents('order-execution', {
      connection: redisConnection.duplicate(),
    });
  }

  async addOrder(orderId: string, orderData: Order) {
    return this.queue.add(
      'process-order',
      { orderId, orderData },
      {
        jobId: orderId,
        priority: orderData.orderType === OrderType.MARKET ? 1 : 2,
      }
    );
  }

  getQueue() {
    return this.queue;
  }
  getQueueEvents() {
    return this.queueEvents;
  }

  async getMetrics() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }
}
