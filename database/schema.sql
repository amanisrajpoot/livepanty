-- Live Streaming Tipping Platform Database Schema
-- PostgreSQL DDL for core tables with proper constraints, indexes, and audit trails

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- CORE USER MANAGEMENT TABLES
-- ============================================================================

-- Users table - core user accounts
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    display_name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'performer', 'admin', 'moderator')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned', 'pending_verification')),
    country VARCHAR(2) NOT NULL, -- ISO 3166-1 alpha-2 country code
    timezone VARCHAR(50) DEFAULT 'UTC',
    date_of_birth DATE, -- Required for age verification
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'non_binary', 'other', 'prefer_not_to_say')),
    profile_image_url TEXT,
    bio TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- User preferences and settings
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_email BOOLEAN DEFAULT TRUE,
    notification_push BOOLEAN DEFAULT TRUE,
    notification_tips BOOLEAN DEFAULT TRUE,
    notification_followers BOOLEAN DEFAULT TRUE,
    language VARCHAR(5) DEFAULT 'en',
    currency VARCHAR(3) DEFAULT 'USD',
    timezone VARCHAR(50) DEFAULT 'UTC',
    privacy_level VARCHAR(20) DEFAULT 'standard' CHECK (privacy_level IN ('strict', 'standard', 'open')),
    allow_private_messages BOOLEAN DEFAULT TRUE,
    allow_followers BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- WALLET AND TOKEN ECONOMY TABLES
-- ============================================================================

-- User wallets for token balances
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_balance INTEGER NOT NULL DEFAULT 0 CHECK (token_balance >= 0),
    reserved_balance INTEGER NOT NULL DEFAULT 0 CHECK (reserved_balance >= 0), -- For pending transactions
    currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
    conversion_rate DECIMAL(10,4) NOT NULL DEFAULT 100.0, -- tokens per 1 unit of currency
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, currency_code)
);

-- Immutable transaction ledger (append-only)
CREATE TABLE ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    counterparty_id UUID REFERENCES users(id) ON DELETE RESTRICT, -- For tips, purchases, etc.
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
        'token_purchase', 'tip_sent', 'tip_received', 'payout_request', 
        'payout_completed', 'refund', 'fee_deduction', 'bonus', 'adjustment'
    )),
    amount_tokens INTEGER NOT NULL, -- Positive for credits, negative for debits
    amount_currency DECIMAL(10,2), -- Real currency amount if applicable
    fee_tokens INTEGER DEFAULT 0, -- Platform fees
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reference_id UUID, -- Links to related tables (streams, tips, payments, etc.)
    reference_type VARCHAR(30), -- 'stream', 'tip', 'payment', 'payout'
    description TEXT,
    metadata JSONB, -- Additional transaction data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL -- For manual adjustments
);

-- Individual tip transactions
CREATE TABLE tips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID NOT NULL, -- Will reference streams table
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    tokens INTEGER NOT NULL CHECK (tokens > 0),
    fee_tokens INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    ledger_tx_id UUID REFERENCES ledger(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_tips_stream (stream_id),
    INDEX idx_tips_from_user (from_user_id),
    INDEX idx_tips_to_user (to_user_id),
    INDEX idx_tips_created_at (created_at)
);

-- ============================================================================
-- STREAMING AND SESSIONS TABLES
-- ============================================================================

-- Stream sessions
CREATE TABLE streams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    tags TEXT[], -- Array of tags
    is_private BOOLEAN DEFAULT FALSE,
    is_age_restricted BOOLEAN DEFAULT TRUE, -- Default to 18+
    tip_enabled BOOLEAN DEFAULT TRUE,
    chat_enabled BOOLEAN DEFAULT TRUE,
    recording_enabled BOOLEAN DEFAULT FALSE,
    sfu_room_id VARCHAR(100) UNIQUE,
    signaling_token VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'created' CHECK (status IN (
        'created', 'starting', 'live', 'ended', 'suspended', 'banned'
    )),
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    viewer_count INTEGER DEFAULT 0,
    peak_viewer_count INTEGER DEFAULT 0,
    total_tips_received INTEGER DEFAULT 0,
    total_tokens_received INTEGER DEFAULT 0,
    recording_url TEXT,
    thumbnail_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_streams_host (host_id),
    INDEX idx_streams_status (status),
    INDEX idx_streams_started_at (started_at),
    INDEX idx_streams_category (category)
);

-- Add foreign key constraint for tips table now that streams exists
ALTER TABLE tips ADD CONSTRAINT fk_tips_stream FOREIGN KEY (stream_id) REFERENCES streams(id) ON DELETE CASCADE;

-- Stream viewers tracking
CREATE TABLE stream_viewers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    total_tips_sent INTEGER DEFAULT 0,
    total_tokens_spent INTEGER DEFAULT 0,
    UNIQUE(stream_id, user_id),
    INDEX idx_stream_viewers_stream (stream_id),
    INDEX idx_stream_viewers_user (user_id)
);

-- ============================================================================
-- KYC AND VERIFICATION TABLES
-- ============================================================================

-- KYC verification records
CREATE TABLE kyc_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'in_review', 'approved', 'rejected', 'expired'
    )),
    verification_type VARCHAR(20) NOT NULL DEFAULT 'age_verification' CHECK (verification_type IN (
        'age_verification', 'identity_verification', 'performer_verification'
    )),
    document_type VARCHAR(30) CHECK (document_type IN (
        'drivers_license', 'passport', 'national_id', 'other'
    )),
    document_number VARCHAR(100),
    document_expiry DATE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    date_of_birth DATE,
    country VARCHAR(2),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    document_front_url TEXT,
    document_back_url TEXT,
    selfie_url TEXT,
    verification_score DECIMAL(3,2), -- 0.00 to 1.00
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, verification_type),
    INDEX idx_kyc_user (user_id),
    INDEX idx_kyc_status (status)
);

-- ============================================================================
-- PAYMENT AND PAYOUT TABLES
-- ============================================================================

-- Payment processing records
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    payment_provider VARCHAR(50) NOT NULL, -- 'stripe', 'paypal', 'crypto', etc.
    provider_transaction_id VARCHAR(255) UNIQUE,
    amount_currency DECIMAL(10,2) NOT NULL,
    amount_tokens INTEGER NOT NULL,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'refunded', 'disputed'
    )),
    payment_method VARCHAR(50), -- 'card', 'bank_transfer', 'crypto', 'paypal'
    card_last_four VARCHAR(4),
    card_brand VARCHAR(20),
    failure_reason TEXT,
    webhook_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_payments_user (user_id),
    INDEX idx_payments_status (status),
    INDEX idx_payments_created_at (created_at)
);

-- Payout requests and processing
CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount_tokens INTEGER NOT NULL CHECK (amount_tokens > 0),
    amount_currency DECIMAL(10,2) NOT NULL,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
    payout_method VARCHAR(50) NOT NULL CHECK (payout_method IN (
        'bank_transfer', 'paypal', 'crypto', 'check'
    )),
    payout_details JSONB NOT NULL, -- Encrypted bank details, PayPal email, etc.
    status VARCHAR(20) NOT NULL DEFAULT 'requested' CHECK (status IN (
        'requested', 'pending', 'processing', 'completed', 'failed', 'cancelled'
    )),
    processing_fee DECIMAL(10,2) DEFAULT 0,
    net_amount DECIMAL(10,2),
    provider_transaction_id VARCHAR(255),
    failure_reason TEXT,
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_payouts_user (user_id),
    INDEX idx_payouts_status (status),
    INDEX idx_payouts_created_at (created_at)
);

-- ============================================================================
-- MODERATION AND SAFETY TABLES
-- ============================================================================

-- User reports and moderation cases
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('user', 'stream', 'message', 'tip')),
    target_id UUID NOT NULL, -- References users, streams, etc.
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN (
        'inappropriate_content', 'harassment', 'spam', 'underage', 
        'fraud', 'payment_issue', 'other'
    )),
    reason TEXT NOT NULL,
    evidence_urls TEXT[], -- Screenshots, recordings, etc.
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'in_review', 'resolved', 'dismissed', 'escalated'
    )),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_moderator UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_reports_reporter (reporter_id),
    INDEX idx_reports_target (target_type, target_id),
    INDEX idx_reports_status (status),
    INDEX idx_reports_priority (priority)
);

-- Automated moderation flags
CREATE TABLE moderation_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('stream', 'message', 'image', 'user')),
    target_id UUID NOT NULL,
    flag_type VARCHAR(50) NOT NULL CHECK (flag_type IN (
        'nudity_detection', 'toxicity_detection', 'spam_detection', 
        'fraud_detection', 'underage_detection', 'other'
    )),
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    detection_model VARCHAR(100),
    raw_data JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'reviewed', 'action_taken', 'dismissed'
    )),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    action_taken VARCHAR(100), -- 'stream_paused', 'user_warned', 'content_removed', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_moderation_flags_target (target_type, target_id),
    INDEX idx_moderation_flags_type (flag_type),
    INDEX idx_moderation_flags_status (status),
    INDEX idx_moderation_flags_confidence (confidence_score)
);

-- User bans and suspensions
CREATE TABLE user_sanctions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sanction_type VARCHAR(20) NOT NULL CHECK (sanction_type IN (
        'warning', 'temporary_suspension', 'permanent_ban', 'ip_ban'
    )),
    reason TEXT NOT NULL,
    duration_hours INTEGER, -- NULL for permanent bans
    expires_at TIMESTAMP WITH TIME ZONE,
    issued_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_user_sanctions_user (user_id),
    INDEX idx_user_sanctions_active (is_active),
    INDEX idx_user_sanctions_expires (expires_at)
);

-- ============================================================================
-- AUTHENTICATION AND SESSION TABLES
-- ============================================================================

-- Authentication sessions
CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    device_info JSONB, -- Browser, OS, device type
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_auth_sessions_user (user_id),
    INDEX idx_auth_sessions_token (session_token),
    INDEX idx_auth_sessions_expires (expires_at)
);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_password_reset_user (user_id),
    INDEX idx_password_reset_token (token),
    INDEX idx_password_reset_expires (expires_at)
);

-- ============================================================================
-- AUDIT AND LOGGING TABLES
-- ============================================================================

-- Audit logs for compliance and security
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_audit_logs_user (user_id),
    INDEX idx_audit_logs_action (action),
    INDEX idx_audit_logs_created_at (created_at)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Additional composite indexes for common queries
CREATE INDEX idx_users_role_status ON users(role, status);
CREATE INDEX idx_users_email_verified ON users(email_verified, status);
CREATE INDEX idx_ledger_user_type ON ledger(user_id, transaction_type);
CREATE INDEX idx_ledger_created_at ON ledger(created_at DESC);
CREATE INDEX idx_streams_host_status ON streams(host_id, status);
CREATE INDEX idx_tips_stream_created ON tips(stream_id, created_at DESC);
CREATE INDEX idx_reports_status_priority ON reports(status, priority);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_streams_updated_at BEFORE UPDATE ON streams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kyc_verifications_updated_at BEFORE UPDATE ON kyc_verifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payouts_updated_at BEFORE UPDATE ON payouts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- User summary view with wallet balance
CREATE VIEW user_summary AS
SELECT 
    u.id,
    u.email,
    u.display_name,
    u.username,
    u.role,
    u.status,
    u.country,
    u.last_login_at,
    u.created_at,
    COALESCE(w.token_balance, 0) as token_balance,
    COALESCE(w.reserved_balance, 0) as reserved_balance,
    kyc.status as kyc_status,
    kyc.verification_type as kyc_type
FROM users u
LEFT JOIN wallets w ON u.id = w.user_id
LEFT JOIN kyc_verifications kyc ON u.id = kyc.user_id AND kyc.verification_type = 'age_verification'
WHERE u.deleted_at IS NULL;

-- Stream summary view with statistics
CREATE VIEW stream_summary AS
SELECT 
    s.id,
    s.host_id,
    u.display_name as host_name,
    s.title,
    s.category,
    s.status,
    s.is_private,
    s.started_at,
    s.ended_at,
    s.duration_seconds,
    s.viewer_count,
    s.peak_viewer_count,
    s.total_tokens_received,
    COUNT(t.id) as total_tips,
    COUNT(sv.id) as unique_viewers
FROM streams s
JOIN users u ON s.host_id = u.id
LEFT JOIN tips t ON s.id = t.stream_id
LEFT JOIN stream_viewers sv ON s.id = sv.stream_id
GROUP BY s.id, u.display_name;

-- ============================================================================
-- INITIAL DATA AND CONSTRAINTS
-- ============================================================================

-- Create admin user (password should be changed immediately)
INSERT INTO users (id, email, display_name, username, password_hash, role, country, email_verified)
VALUES (
    uuid_generate_v4(),
    'admin@example.com',
    'System Administrator',
    'admin',
    crypt('admin123', gen_salt('bf')), -- Change this password immediately!
    'admin',
    'US',
    true
);

-- Create initial wallet for admin
INSERT INTO wallets (user_id, token_balance, conversion_rate)
SELECT id, 10000, 100.0 FROM users WHERE email = 'admin@example.com';

-- Add comments for documentation
COMMENT ON TABLE users IS 'Core user accounts with authentication and profile information';
COMMENT ON TABLE wallets IS 'User token balances and currency conversion rates';
COMMENT ON TABLE ledger IS 'Immutable transaction ledger for all token movements';
COMMENT ON TABLE streams IS 'Live streaming sessions and metadata';
COMMENT ON TABLE tips IS 'Individual tip transactions during streams';
COMMENT ON TABLE kyc_verifications IS 'Age and identity verification records';
COMMENT ON TABLE payments IS 'Payment processing records for token purchases';
COMMENT ON TABLE payouts IS 'Performer payout requests and processing';
COMMENT ON TABLE reports IS 'User reports and moderation cases';
COMMENT ON TABLE moderation_flags IS 'Automated moderation detection results';
COMMENT ON TABLE audit_logs IS 'Security and compliance audit trail';

-- ============================================================================
-- SECURITY POLICIES (Row Level Security)
-- ============================================================================

-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (implement based on your authentication system)
-- Users can only see their own data
CREATE POLICY user_own_data ON users FOR ALL TO authenticated_user USING (id = current_user_id());
CREATE POLICY wallet_own_data ON wallets FOR ALL TO authenticated_user USING (user_id = current_user_id());
CREATE POLICY ledger_own_data ON ledger FOR ALL TO authenticated_user USING (user_id = current_user_id());

-- Admins can see everything
CREATE POLICY admin_all_access ON users FOR ALL TO admin_role USING (true);
CREATE POLICY admin_all_wallets ON wallets FOR ALL TO admin_role USING (true);
CREATE POLICY admin_all_ledger ON ledger FOR ALL TO admin_role USING (true);
