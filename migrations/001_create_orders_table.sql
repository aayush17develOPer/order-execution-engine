CREATE TYPE order_type AS ENUM ('market', 'limit', 'sniper');
CREATE TYPE order_status AS ENUM ('pending', 'routing', 'building', 'submitted', 'confirmed', 'failed');
CREATE TYPE dex_type AS ENUM ('raydium', 'meteora');

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_type order_type NOT NULL,
    status order_status NOT NULL DEFAULT 'pending',
    token_in VARCHAR(64) NOT NULL,
    token_out VARCHAR(64) NOT NULL,
    amount_in DECIMAL(20, 8) NOT NULL,
    amount_out DECIMAL(20, 8),
    slippage DECIMAL(5, 4) DEFAULT 0.01,
    selected_dex dex_type,
    execution_price DECIMAL(20, 8),
    tx_hash VARCHAR(128),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_type ON orders(order_type);
