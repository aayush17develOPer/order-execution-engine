import { OrderExecutionService } from '../services/order-execution.service';
import { OrderType, OrderStatus } from '../models/order.model';

describe('OrderExecutionService', () => {
  let service: OrderExecutionService;

  beforeEach(() => {
    service = new OrderExecutionService();
  });

  describe('createOrder', () => {
    it('should create order with pending status', async () => {
      const order = await service.createOrder({
        orderType: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 1,
        slippage: 0.01,
      });

      expect(order.id).toBeDefined();
      expect(order.status).toBe(OrderStatus.PENDING);
      expect(order.orderType).toBe(OrderType.MARKET);
      expect(order.amountIn).toBe(1);
    });
  });

  describe('getOrder', () => {
    it('should retrieve created order', async () => {
      const created = await service.createOrder({
        orderType: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 1,
      });

      const retrieved = await service.getOrder(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent order', async () => {
      const result = await service.getOrder('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });
  });
});
