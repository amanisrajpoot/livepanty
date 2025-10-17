-- Update existing tables and add missing ones for KYC and Moderation

-- Add missing columns to kyc_verifications table
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS document_number VARCHAR(100);
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS issuing_country VARCHAR(3);
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS s3_key VARCHAR(500);
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS s3_url VARCHAR(1000);
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS automated_analysis JSONB;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS risk_score DECIMAL(3,2) DEFAULT 0.0;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES users(id);
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update status constraint
ALTER TABLE kyc_verifications DROP CONSTRAINT IF EXISTS kyc_verifications_status_check;
ALTER TABLE kyc_verifications ADD CONSTRAINT kyc_verifications_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected', 'requires_review'));

-- Create content_reports table if it doesn't exist
CREATE TABLE IF NOT EXISTS content_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('message', 'stream', 'profile', 'comment', 'tip')),
    content_id VARCHAR(100),
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    evidence JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'flagged', 'escalated', 'approved', 'rejected', 'resolved')),
    automated_analysis JSONB,
    risk_score DECIMAL(3,2) DEFAULT 0.0,
    moderator_id UUID REFERENCES users(id),
    action_taken VARCHAR(50),
    moderator_notes TEXT,
    escalated_at TIMESTAMP WITH TIME ZONE,
    escalation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Create user_warnings table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_warnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    moderator_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'tip', 'emote', 'system')),
    is_hidden BOOLEAN DEFAULT FALSE,
    moderation_flagged BOOLEAN DEFAULT FALSE,
    moderation_score DECIMAL(3,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS warning_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token VARCHAR(500);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_user_id ON kyc_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_status ON kyc_verifications(status);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_submitted_at ON kyc_verifications(submitted_at);

CREATE INDEX IF NOT EXISTS idx_content_reports_reporter_id ON content_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_reported_user_id ON content_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status);
CREATE INDEX IF NOT EXISTS idx_content_reports_created_at ON content_reports(created_at);

CREATE INDEX IF NOT EXISTS idx_user_warnings_user_id ON user_warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_warnings_created_at ON user_warnings(created_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_chat_messages_stream_id ON chat_messages(stream_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_hidden ON chat_messages(is_hidden);

-- Insert default system settings
INSERT INTO system_settings (key, value, description) VALUES
('moderation_auto_flag_threshold', '0.7', 'Risk score threshold for automatic flagging'),
('moderation_escalation_threshold', '0.8', 'Risk score threshold for escalation'),
('kyc_auto_approve_threshold', '0.9', 'Risk score threshold for automatic KYC approval'),
('max_warnings_before_suspension', '3', 'Maximum warnings before automatic suspension'),
('suspension_duration_days', '7', 'Default suspension duration in days'),
('content_retention_days', '90', 'Content retention period in days')
ON CONFLICT (key) DO NOTHING;
