-- Create payments table if it doesn't exist
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    payment_provider VARCHAR(50) NOT NULL, -- 'stripe', 'paypal', 'crypto', 'razorpay', 'demo', etc.
    provider_transaction_id VARCHAR(255) UNIQUE,
    amount_currency DECIMAL(10,2) NOT NULL,
    amount_tokens INTEGER NOT NULL,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'refunded', 'disputed'
    )),
    payment_method VARCHAR(50), -- 'card', 'bank_transfer', 'crypto', 'paypal', 'upi'
    card_last_four VARCHAR(4),
    card_brand VARCHAR(20),
    failure_reason TEXT,
    webhook_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_provider_transaction ON payments(provider_transaction_id);

