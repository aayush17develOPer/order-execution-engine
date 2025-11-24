import { Queue, Job, QueueEvents } from 'bullmq';
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
    this.queue = new Queue<OrderJobData>('order-execution', {
      connection: redisConnection, // ← Changed from redisConnection.duplicate()
    });

    this.queueEvents = new QueueEvents('order-execution', {
      connection: redisConnection, // ← Changed from redisConnection.duplicate()
    });
  }

  async addOrder(orderId: string, orderData: Order): Promise<Job<OrderJobData>> {
    const priority = orderData.orderType === OrderType.MARKET ? 1 : 2;

    return this.queue.add(
      'execute-order',
      { orderId, orderData },
      {
        jobId: orderId,
        priority,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: false,
        removeOnFail: false,
        delay: 1000,
      }
    );
  }

  async getMetrics() {
    const counts = await this.queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed'
    );
    return counts;
  }

  getQueue(): Queue<OrderJobData> {
    return this.queue;
  }

  getQueueEvents(): QueueEvents {
    return this.queueEvents;
  }
}
