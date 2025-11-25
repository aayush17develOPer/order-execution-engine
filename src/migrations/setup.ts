import { query } from '../config/database';

export async function runMigrations() {
  console.log('🔄 Starting database migrations...');

  try {
    // Create orders table with all required columns
    console.log('📋 Creating orders table...');
    await query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY,
        order_type VARCHAR(50) NOT NULL,
        token_in VARCHAR(50) NOT NULL,
        token_out VARCHAR(50) NOT NULL,
        amount_in DECIMAL(20, 8) NOT NULL,
        amount_out DECIMAL(20, 8),
        slippage DECIMAL(5, 4),
        limit_price DECIMAL(20, 8),
        status VARCHAR(50) NOT NULL,
        tx_hash TEXT,
        executed_price DECIMAL(20, 8),
        dex VARCHAR(50),
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Orders table created/verified');

    // Add indexes for performance
    console.log('📋 Creating indexes...');
    await query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
    console.log('✅ Index idx_orders_status created');

    await query(`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC)`);
    console.log('✅ Index idx_orders_created_at created');

    await query(`CREATE INDEX IF NOT EXISTS idx_orders_tx_hash ON orders(tx_hash)`);
    console.log('✅ Index idx_orders_tx_hash created');

    console.log('✅ All database migrations completed successfully');
  } catch (error: any) {
    console.error('❌ Migration error:', error);
    throw error;
  }
}
