import { query } from '../config/database';
import { logger } from '../utils/logger';

export async function runMigrations() {
  try {
    logger.info('Running database migrations...');

    await query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_type VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        token_in VARCHAR(10) NOT NULL,
        token_out VARCHAR(10) NOT NULL,
        amount_in DECIMAL(20, 8) NOT NULL,
        amount_out DECIMAL(20, 8),
        slippage DECIMAL(5, 4) NOT NULL,
        selected_dex VARCHAR(50),
        execution_price DECIMAL(20, 8),
        tx_hash VARCHAR(255),
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        confirmed_at TIMESTAMP
      );
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);`);

    logger.info('✅ Database migrations completed successfully');
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Database migration failed');
    throw error;
  }
}
