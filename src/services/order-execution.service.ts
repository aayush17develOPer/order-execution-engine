import { query } from '../config/database';
import { redisClient } from '../config/redis';
import {
  Order,
  OrderStatus,
  // OrderType,
  CreateOrderRequest,
  StatusUpdate,
} from '../models/order.model';
import { DexRouterService } from './dex-router.service';
import { orderEvents } from './order-events.service';
import { sleep } from '../utils/helper';
import { logger } from '../utils/logger';

export class OrderExecutionService {
  private dexRouter = new DexRouterService();

  async createOrder(request: CreateOrderRequest): Promise<Order> {
    const result = await query(
      `INSERT INTO orders (order_type, status, token_in, token_out, amount_in, slippage, retry_count)
       VALUES ($1, $2, $3, $4, $5, $6, 0)
       RETURNING *`,
      [
        request.orderType,
        OrderStatus.PENDING,
        request.tokenIn,
        request.tokenOut,
        request.amountIn,
        request.slippage || 0.01,
      ]
    );
    const order = this.mapRowToOrder(result.rows[0]);
    await this.cacheOrder(order);
    return order;
  }

  async getOrder(orderId: string): Promise<Order | null> {
    const cached = await redisClient.get(`order:${orderId}`);
    if (cached) return JSON.parse(cached);
    const result = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (!result.rows.length) return null;
    const order = this.mapRowToOrder(result.rows[0]);
    await this.cacheOrder(order);
    return order;
  }

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    data: Partial<Order> = {}
  ): Promise<Order> {
    const updates: string[] = ['status = $2', 'updated_at = NOW()'];
    const values: any[] = [orderId, status];
    let paramIndex = 3;

    if (data.selectedDex) {
      updates.push(`selected_dex = $${paramIndex++}`);
      values.push(data.selectedDex);
    }

    if (data.executionPrice) {
      updates.push(`execution_price = $${paramIndex++}`);
      values.push(data.executionPrice);
    }

    if (data.amountOut) {
      updates.push(`amount_out = $${paramIndex++}`);
      values.push(data.amountOut);
    }

    if (data.txHash) {
      updates.push(`tx_hash = $${paramIndex++}`);
      values.push(data.txHash);
    }

    if (data.errorMessage) {
      updates.push(`error_message = $${paramIndex++}`);
      values.push(data.errorMessage);
    }

    if (data.retryCount !== undefined) {
      updates.push(`retry_count = $${paramIndex++}`);
      values.push(data.retryCount);
    }

    if (status === OrderStatus.CONFIRMED) {
      updates.push('confirmed_at = NOW()');
    }

    const result = await query(
      `UPDATE orders SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    const order = this.mapRowToOrder(result.rows[0]);
    await this.cacheOrder(order);
    return order;
  }

  async processMarketOrder(order: Order): Promise<StatusUpdate[]> {
    const updates: StatusUpdate[] = [];

    try {
      // Stage 1: ROUTING
      logger.info({ orderId: order.id }, 'Stage 1: Starting DEX routing...');
      await this.updateOrderStatus(order.id, OrderStatus.ROUTING);
      orderEvents.emitOrderUpdate(order.id, OrderStatus.ROUTING, {
        message: 'Fetching quotes from Raydium and Meteora...',
      });

      await sleep(800); // 800ms for routing

      const { bestQuote, allQuotes } = await this.dexRouter.getBestQuote(
        order.tokenIn,
        order.tokenOut,
        order.amountIn
      );

      logger.info({ orderId: order.id, selectedDex: bestQuote.dex }, 'Routing complete');

      // Stage 2: BUILDING
      logger.info({ orderId: order.id }, 'Stage 2: Building transaction...');
      await sleep(700); // 700ms for building
      await this.updateOrderStatus(order.id, OrderStatus.BUILDING, {
        selectedDex: bestQuote.dex,
      });
      orderEvents.emitOrderUpdate(order.id, OrderStatus.BUILDING, {
        selectedDex: bestQuote.dex,
        message: `Building transaction on ${bestQuote.dex}...`,
      });

      // Stage 3: SUBMITTED
      logger.info({ orderId: order.id }, 'Stage 3: Submitting to blockchain...');
      await sleep(600); // 600ms for submission
      await this.updateOrderStatus(order.id, OrderStatus.SUBMITTED);
      orderEvents.emitOrderUpdate(order.id, OrderStatus.SUBMITTED, {
        message: 'Transaction submitted to Solana network...',
      });

      // Stage 4: EXECUTION
      logger.info({ orderId: order.id }, 'Stage 4: Executing swap...');
      const execution = await this.dexRouter.executeSwap(
        bestQuote.dex,
        order.tokenIn,
        order.tokenOut,
        order.amountIn,
        bestQuote.amountOut,
        order.slippage
      );

      // Stage 5: CONFIRMED
      await this.updateOrderStatus(order.id, OrderStatus.CONFIRMED, {
        txHash: execution.txHash,
        executionPrice: execution.executedPrice,
        amountOut: execution.amountOut,
      });

      orderEvents.emitOrderUpdate(order.id, OrderStatus.CONFIRMED, {
        txHash: execution.txHash,
        executionPrice: execution.executedPrice,
        amountOut: execution.amountOut,
        message: 'Order executed successfully!',
      });

      logger.info({ orderId: order.id, txHash: execution.txHash }, 'Order confirmed');

      updates.push({
        orderId: order.id,
        status: OrderStatus.CONFIRMED,
        timestamp: new Date(),
        data: {
          txHash: execution.txHash,
          executionPrice: execution.executedPrice,
          amountOut: execution.amountOut,
        },
      });
    } catch (error: any) {
      logger.error({ orderId: order.id, error: error.message }, 'Order execution failed');

      await this.updateOrderStatus(order.id, OrderStatus.FAILED, {
        errorMessage: error.message,
        retryCount: order.retryCount + 1,
      });

      orderEvents.emitOrderUpdate(order.id, OrderStatus.FAILED, {
        error: error.message,
      });

      updates.push({
        orderId: order.id,
        status: OrderStatus.FAILED,
        timestamp: new Date(),
        data: { error: error.message },
      });
    }

    return updates;
  }

  private async cacheOrder(order: Order) {
    await redisClient.setex(`order:${order.id}`, 3600, JSON.stringify(order));
  }

  private mapRowToOrder(row: any): Order {
    return {
      id: row.id,
      orderType: row.order_type,
      status: row.status,
      tokenIn: row.token_in,
      tokenOut: row.token_out,
      amountIn: parseFloat(row.amount_in),
      amountOut: row.amount_out ? parseFloat(row.amount_out) : undefined,
      slippage: parseFloat(row.slippage),
      selectedDex: row.selected_dex,
      executionPrice: row.execution_price ? parseFloat(row.execution_price) : undefined,
      txHash: row.tx_hash,
      errorMessage: row.error_message,
      retryCount: row.retry_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      confirmedAt: row.confirmed_at,
    };
  }
}
