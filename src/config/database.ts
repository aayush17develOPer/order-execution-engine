import { Pool } from 'pg';
import { env } from './env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20, // Max number of clients in pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Timeout for new connection in ms
});

pool.on('error', err => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

/**
 * Convenience method to run queries using the pool
 * @param text SQL query string
 * @param params Query parameters
 * @returns Query result
 */
export const query = (text: string, params?: any[]) => pool.query(text, params);
