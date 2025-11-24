import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional().default(''),
  DATABASE_URL: z.string(),
  MAX_CONCURRENT_ORDERS: z.string().transform(Number).default('10'),
  MAX_ORDERS_PER_MINUTE: z.string().transform(Number).default('100'),
  MAX_RETRY_ATTEMPTS: z.string().transform(Number).default('3'),
  SLIPPAGE_TOLERANCE: z.string().transform(Number).default('0.01'),
});

// This will throw an error at startup if any required env var is missing or invalid
export const env = envSchema.parse(process.env);
