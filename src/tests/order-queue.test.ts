import { OrderQueueService } from '../services/order-queue.service';
import { Order, OrderType, OrderStatus } from '../models/order.model';

describe('OrderQueueService', () => {
  let queueService: OrderQueueService;

  beforeEach(() => {
    queueService = new OrderQueueService();
  });

  afterEach(async () => {
    // Properly clean up queue
    const queue = queueService.getQueue();
    await queue.drain();
    await queue.clean(0, 1000, 'completed');
    await queue.clean(0, 1000, 'failed');
    await queue.close();
  });

  const createMockOrder = (orderType: OrderType = OrderType.MARKET): Order => ({
    id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    orderType,
    status: OrderStatus.PENDING,
    tokenIn: 'SOL',
    tokenOut: 'USDC',
    amountIn: 1,
    slippage: 0.01,
    retryCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe('addOrder', () => {
    it('should add order to queue and return job', async () => {
      const order = createMockOrder();
      const job = await queueService.addOrder(order.id, order);

      expect(job).toBeDefined();
      expect(job.id).toBe(order.id);
      expect(job.data.orderId).toBe(order.id);
      expect(job.data.orderData).toEqual(order);
    });

    it('should assign priority to orders', async () => {
      const order = createMockOrder(OrderType.MARKET);
      const job = await queueService.addOrder(order.id, order);

      expect(job.opts.priority).toBeDefined();
      expect(job.opts.priority).toBeGreaterThan(0);
    });
  });

  describe('Queue Prioritization', () => {
    it('should prioritize market orders over limit orders', async () => {
      const marketOrder = createMockOrder(OrderType.MARKET);
      const limitOrder = createMockOrder(OrderType.LIMIT);

      const job1 = await queueService.addOrder(marketOrder.id, marketOrder);
      const job2 = await queueService.addOrder(limitOrder.id, limitOrder);

      expect(job1.opts.priority).toBeLessThan(job2.opts.priority!);
    });

    it('should assign priority 1 to market orders', async () => {
      const order = createMockOrder(OrderType.MARKET);
      const job = await queueService.addOrder(order.id, order);

      expect(job.opts.priority).toBe(1);
    });

    it('should assign priority 2 to limit orders', async () => {
      const order = createMockOrder(OrderType.LIMIT);
      const job = await queueService.addOrder(order.id, order);

      expect(job.opts.priority).toBe(2);
    });
  });

  describe('getMetrics', () => {
    it('should return queue metrics with all counts', async () => {
      const metrics = await queueService.getMetrics();

      expect(metrics).toHaveProperty('waiting');
      expect(metrics).toHaveProperty('active');
      expect(metrics).toHaveProperty('completed');
      expect(metrics).toHaveProperty('failed');
      expect(metrics).toHaveProperty('delayed');

      expect(typeof metrics.waiting).toBe('number');
      expect(typeof metrics.active).toBe('number');
    });

    it('should track orders in queue', async () => {
      const order = createMockOrder();
      await queueService.addOrder(order.id, order);

      const metrics = await queueService.getMetrics();
      const totalJobs = metrics.waiting + metrics.active + metrics.completed;
      expect(totalJobs).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Concurrent Processing', () => {
    it('should handle multiple orders simultaneously', async () => {
      const orders = Array.from({ length: 5 }, () => createMockOrder());

      const jobs = await Promise.all(orders.map(order => queueService.addOrder(order.id, order)));

      expect(jobs).toHaveLength(5);
      jobs.forEach(job => {
        expect(job).toBeDefined();
        expect(job.id).toBeDefined();
      });
    });

    it('should handle 10 concurrent orders with unique IDs', async () => {
      const orders = Array.from({ length: 10 }, () => createMockOrder());

      const jobs = await Promise.all(orders.map(order => queueService.addOrder(order.id, order)));

      expect(jobs).toHaveLength(10);

      const ids = jobs.map(j => j.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });
  });

  describe('Queue Management', () => {
    it('should retrieve queue instance', () => {
      const queue = queueService.getQueue();
      expect(queue).toBeDefined();
      expect(queue.name).toBe('order-execution');
    });

    it('should retrieve queue events instance', () => {
      const queueEvents = queueService.getQueueEvents();
      expect(queueEvents).toBeDefined();
    });
  });
});
