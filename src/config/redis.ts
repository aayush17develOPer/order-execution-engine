import Redis from 'ioredis';
import { env } from './env';

export const redisClient = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required for BullMQ
  lazyConnect: true,
});

export const redisConnection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

redisClient
  .connect()
  .then(() => {
    console.log('Redis connected successfully');
  })
  .catch(err => {
    console.error('Redis connection error:', err);
  });

redisClient.on('error', err => {
  console.error('Redis error:', err);
});

export const duplicate = () => redisClient.duplicate();
