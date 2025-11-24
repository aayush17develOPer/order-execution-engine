import { Pool } from 'pg';
import { env } from './env';

// Railway provides DATABASE_URL directly
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

pool.on('connect', () => {
  console.log('PostgreSQL connected successfully');
});

pool.on('error', err => {
  console.error('PostgreSQL connection error:', err);
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
export const getPool = () => pool;
