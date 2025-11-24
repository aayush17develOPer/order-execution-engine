import { DexRouterService } from '../services/dex-router.service';
import { DexType } from '../models/order.model';

describe('DexRouterService', () => {
  let dexRouter: DexRouterService;
  beforeEach(() => {
    dexRouter = new DexRouterService();
  });

  describe('getRaydiumQuote', () => {
    it('should return valid quote with correct structure', async () => {
      const quote = await dexRouter.getRaydiumQuote('SOL', 'USDC', 1);
      expect(quote.dex).toBe(DexType.RAYDIUM);
      expect(quote.price).toBeGreaterThan(0);
      expect(quote.amountOut).toBeGreaterThan(0);
      expect(quote.fee).toBe(0.003);
    });

    it('should have realistic price range for SOL/USDC', async () => {
      const quote = await dexRouter.getRaydiumQuote('SOL', 'USDC', 1);
      expect(quote.price).toBeGreaterThan(90);
      expect(quote.price).toBeLessThan(110);
    });

    it('should simulate network delay', async () => {
      const start = Date.now();
      await dexRouter.getRaydiumQuote('SOL', 'USDC', 1);
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(150);
      expect(duration).toBeLessThan(400);
    });
  });

  describe('getMeteorQuote', () => {
    it('should return valid quote with lower fee', async () => {
      const quote = await dexRouter.getMeteorQuote('SOL', 'USDC', 1);
      expect(quote.dex).toBe(DexType.METEORA);
      expect(quote.fee).toBe(0.002);
    });
  });

  describe('getBestQuote', () => {
    it('should fetch quotes from both DEXs in parallel', async () => {
      const start = Date.now();
      const result = await dexRouter.getBestQuote('SOL', 'USDC', 1);
      const duration = Date.now() - start;

      expect(result.allQuotes).toHaveLength(2);
      expect(duration).toBeLessThan(500); // Parallel should be <500ms
    });

    it('should select quote with highest output amount', async () => {
      const result = await dexRouter.getBestQuote('SOL', 'USDC', 1);
      const maxAmount = Math.max(...result.allQuotes.map(q => q.amountOut));
      expect(result.bestQuote.amountOut).toBe(maxAmount);
    });
  });

  describe('executeSwap', () => {
    it('should successfully execute swap', async () => {
      const result = await dexRouter.executeSwap(DexType.RAYDIUM, 'SOL', 'USDC', 1, 98.5, 0.01);
      expect(result.txHash).toHaveLength(88);
      expect(result.executedPrice).toBeGreaterThan(0);
    });

    it('should take 2-3 seconds to execute', async () => {
      const start = Date.now();
      await dexRouter.executeSwap(DexType.RAYDIUM, 'SOL', 'USDC', 1, 98.5, 0.01);
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(2000);
      expect(duration).toBeLessThan(4000);
    });

    // it('should throw error if slippage exceeded', async () => {
    //   // This might fail randomly due to mock, but tests the logic
    //   const attempts = Array(10).fill(0);
    //   let slippageErrors = 0;

    //   for (const _ of attempts) {
    //     try {
    //       await dexRouter.executeSwap(DexType.RAYDIUM, 'SOL', 'USDC', 1, 98.5, 0.0001);
    //     } catch (error: any) {
    //       if (error.message.includes('Slippage')) slippageErrors++;
    //     }
    //   }
    //   expect(slippageErrors).toBeGreaterThan(0);
    // });
  });
});
