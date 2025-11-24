import Redis from 'ioredis';
import { env } from './env';

export const redisConnection = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

export const redisClient = redisConnection.duplicate();

redisConnection.on('error', err => {
  console.error('Redis connection error:', err);
});

redisConnection.on('connect', () => {
  console.log('Redis connected successfully');
});
