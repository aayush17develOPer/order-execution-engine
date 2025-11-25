import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { OrderExecutionService } from '../services/order-execution.service';
import { DexRouterService } from '../services/dex-router.service';
import { DexType } from '../models/order.model';
import { OrderJobData } from '../services/order-queue.service';
import { OrderType, OrderStatus } from '../models/order.model';
import { orderEvents } from '../services/order-events.service';
import { query } from '../config/database';
import { logger } from '../utils/logger';
import { sleep } from '../utils/helper';

export class OrderWorker {
  private worker: Worker<OrderJobData>;
  private executionService: OrderExecutionService;
  private dexRouter: DexRouterService;

  constructor() {
    this.executionService = new OrderExecutionService();
    this.dexRouter = new DexRouterService();

    console.log('🏗️  Initializing OrderWorker...');

    this.worker = new Worker<OrderJobData>(
      'order-execution',
      async (job: Job<OrderJobData>) => {
        const { orderId, orderData } = job.data;

        logger.info({ jobId: job.id, orderId }, '🚀 Worker processing order');

        try {
          if (orderData.orderType === OrderType.MARKET) {
            // Process market order with DEX routing
            await this.processMarketOrderWithRouting(orderId, orderData);

            logger.info({ orderId }, '✅ Worker completed order processing');
            return { success: true, orderId };
          } else {
            throw new Error('Only market orders implemented in mock');
          }
        } catch (error: any) {
          logger.error({ jobId: job.id, orderId, error: error.message }, '❌ Worker job failed');

          // Update order status to failed
          await this.handleOrderFailure(orderId, error);

          throw error;
        }
      },
      {
        connection: redisConnection,
        concurrency: 10,
        limiter: { max: 100, duration: 60000 },
      }
    );

    console.log('✅ OrderWorker initialized and ready');

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

  /**
   * Process market order with full DEX routing flow
   */
  private async processMarketOrderWithRouting(orderId: string, orderData: any) {
    const shortId = orderId.substring(0, 8);

    // PHASE 1: ROUTING
    logger.info({ orderId }, `🔀 [${shortId}] Phase 1: Routing - Comparing DEX prices`);
    orderEvents.emitOrderUpdate(orderId, OrderStatus.ROUTING, {
      message: 'Comparing prices from Raydium and Meteora...',
    });
    await sleep(300);

    // Get best quote from DEX router
    const { bestQuote, allQuotes } = await this.dexRouter.getBestQuote(
      orderData.tokenIn,
      orderData.tokenOut,
      orderData.amountIn
    );

    // Log routing decision
    const raydium = allQuotes.find(q => q.dex === DexType.RAYDIUM);
    const meteora = allQuotes.find(q => q.dex === DexType.METEORA);
    const priceDiff = raydium && meteora ? Math.abs(raydium.amountOut - meteora.amountOut) : 0;

    logger.info({ orderId }, `📊 DEX Comparison:`);
    logger.info(
      { orderId },
      `   Raydium: ${raydium?.amountOut.toFixed(4)} ${orderData.tokenOut} (fee: ${(raydium?.fee || 0) * 100}%)`
    );
    logger.info(
      { orderId },
      `   Meteora: ${meteora?.amountOut.toFixed(4)} ${orderData.tokenOut} (fee: ${(meteora?.fee || 0) * 100}%)`
    );
    logger.info(
      { orderId },
      `   ✅ Winner: ${bestQuote.dex} (better by ${priceDiff.toFixed(4)} ${orderData.tokenOut})`
    );

    // PHASE 2: BUILDING
    logger.info({ orderId }, `🏗️  [${shortId}] Phase 2: Building transaction for ${bestQuote.dex}`);
    orderEvents.emitOrderUpdate(orderId, OrderStatus.BUILDING, {
      message: `Building transaction for ${bestQuote.dex}...`,
      dex: bestQuote.dex,
      expectedOutput: bestQuote.amountOut,
      quotes: {
        raydium: raydium?.amountOut,
        meteora: meteora?.amountOut,
        priceDifference: priceDiff,
      },
    });
    await sleep(800);

    // PHASE 3: SUBMITTED
    logger.info({ orderId }, `📤 [${shortId}] Phase 3: Submitting transaction to Solana network`);
    orderEvents.emitOrderUpdate(orderId, OrderStatus.SUBMITTED, {
      message: `Transaction submitted to Solana network via ${bestQuote.dex}...`,
      dex: bestQuote.dex,
    });

    // Execute swap on selected DEX
    const result = await this.dexRouter.executeSwap(
      bestQuote.dex,
      orderData.tokenIn,
      orderData.tokenOut,
      orderData.amountIn,
      bestQuote.amountOut,
      orderData.slippage || 0.01
    );

    logger.info({ orderId }, `✅ Swap executed successfully: ${result.txHash}`);

    // PHASE 4: CONFIRMED
    logger.info({ orderId }, `✅ [${shortId}] Phase 4: Transaction confirmed!`);

    await query(
      `UPDATE orders 
   SET status = $1, 
       tx_hash = $2, 
       execution_price = $3,  // ← Fixed column name
       selected_dex = $4,     // ← Also check this matches your DB
       amount_out = $5,
       updated_at = NOW() 
   WHERE id = $6`,
      [
        OrderStatus.CONFIRMED,
        result.txHash,
        result.executedPrice,
        bestQuote.dex,
        result.amountOut,
        orderId,
      ]
    );

    // Emit final confirmed event
    orderEvents.emitOrderUpdate(orderId, OrderStatus.CONFIRMED, {
      message: 'Transaction confirmed on Solana!',
      txHash: result.txHash,
      executedPrice: result.executedPrice,
      amountOut: result.amountOut,
      amountIn: orderData.amountIn,
      dex: bestQuote.dex,
      priceImpact:
        (((result.executedPrice - bestQuote.price) / bestQuote.price) * 100).toFixed(2) + '%',
      explorerUrl: `https://explorer.solana.com/tx/${result.txHash}?cluster=devnet`,
    });

    // Also call the original processing method for compatibility
    await this.executionService.processMarketOrder(orderData);
  }

  /**
   * Handle order failure
   */
  private async handleOrderFailure(orderId: string, error: any) {
    const shortId = orderId.substring(0, 8);

    logger.error({ orderId }, `❌ [${shortId}] Order failed: ${error.message}`);

    // Update database
    await query(
      `UPDATE orders 
       SET status = $1, 
           error_message = $2, 
           updated_at = NOW() 
       WHERE id = $3`,
      [OrderStatus.FAILED, error.message, orderId]
    );

    // Emit failed event
    orderEvents.emitOrderUpdate(orderId, OrderStatus.FAILED, {
      message: `Order failed: ${error.message}`,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }

  async close() {
    await this.worker.close();
    logger.info('Worker closed');
  }
}
