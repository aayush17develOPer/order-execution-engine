export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  SNIPER = 'sniper',
}

export enum OrderStatus {
  PENDING = 'pending',
  ROUTING = 'routing',
  BUILDING = 'building',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

export enum DexType {
  RAYDIUM = 'Raydium',
  METEORA = 'Meteora',
}

export interface Order {
  id: string;
  orderType: OrderType;
  status: OrderStatus;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  amountOut?: number;
  slippage: number;
  selectedDex?: DexType;
  executionPrice?: number;
  txHash?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date;
}

export interface CreateOrderRequest {
  orderType: OrderType;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  slippage?: number;
  limitPrice?: number; // Used only for limit orders
}

export interface DexQuote {
  dex: DexType;
  price: number;
  amountOut: number;
  fee: number;
  liquidityDepth: number;
  estimatedSlippage: number;
}

export interface ExecutionResult {
  txHash: string;
  executedPrice: number;
  amountOut: number;
  dex: DexType;
  timestamp: Date;
}

export interface StatusUpdate {
  orderId: string;
  status: OrderStatus;
  timestamp: Date;
  data?: {
    selectedDex?: DexType;
    quotes?: DexQuote[];
    txHash?: string;
    executionPrice?: number;
    amountOut?: number;
    error?: string;
  };
}
