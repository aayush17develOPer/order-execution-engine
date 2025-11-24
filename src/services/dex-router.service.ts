import { DexType, DexQuote } from '../models/order.model';
import { sleep, generateMockTxHash } from '../utils/helper';

export class DexRouterService {
  private readonly BASE_PRICE = 100;

  async getRaydiumQuote(tokenIn: string, tokenOut: string, amount: number): Promise<DexQuote> {
    await sleep(200);
    const price = this.BASE_PRICE * (0.98 + Math.random() * 0.04);
    return {
      dex: DexType.RAYDIUM,
      price,
      amountOut: amount * price * 0.997,
      fee: 0.003,
      liquidityDepth: 50000,
      estimatedSlippage: 0.002,
    };
  }

  async getMeteorQuote(tokenIn: string, tokenOut: string, amount: number): Promise<DexQuote> {
    await sleep(200);
    const price = this.BASE_PRICE * (0.97 + Math.random() * 0.05);
    return {
      dex: DexType.METEORA,
      price,
      amountOut: amount * price * 0.998,
      fee: 0.002,
      liquidityDepth: 75000,
      estimatedSlippage: 0.001,
    };
  }

  async getBestQuote(tokenIn: string, tokenOut: string, amount: number) {
    const [raydium, meteora] = await Promise.all([
      this.getRaydiumQuote(tokenIn, tokenOut, amount),
      this.getMeteorQuote(tokenIn, tokenOut, amount),
    ]);
    const allQuotes = [raydium, meteora];
    const bestQuote = allQuotes.reduce((a, b) => (a.amountOut > b.amountOut ? a : b));
    return { bestQuote, allQuotes };
  }

  async executeSwap(
    dex: DexType,
    tokenIn: string,
    tokenOut: string,
    amount: number,
    expectedAmountOut: number,
    slippage: number
  ) {
    await sleep(2000 + Math.random() * 1000);
    const priceImpact = 0.998 + Math.random() * 0.004;
    const amountOut = expectedAmountOut * priceImpact;
    if ((expectedAmountOut - amountOut) / expectedAmountOut > slippage) {
      throw new Error('Slippage tolerance exceeded');
    }
    if (Math.random() < 0.05) throw new Error('Transaction simulation failed');
    return {
      txHash: generateMockTxHash(),
      executedPrice: amountOut / amount,
      amountOut,
    };
  }
}
