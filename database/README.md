# Database Schema Documentation

## Overview
This PostgreSQL schema defines the complete database structure for the live streaming tipping platform. The schema is designed with security, compliance, and scalability in mind.

## Key Design Principles

### 1. **Immutable Ledger**
- The `ledger` table is append-only to maintain transaction integrity
- All token movements are recorded with before/after balances
- Double-entry accounting principles are enforced

### 2. **Security & Compliance**
- Row Level Security (RLS) enabled on sensitive tables
- Comprehensive audit logging for all critical actions
- Encrypted storage for sensitive data (implement at application level)
- Age verification and KYC tracking

### 3. **Performance Optimization**
- Strategic indexes on frequently queried columns
- Composite indexes for common query patterns
- Views for complex joins and aggregations

### 4. **Data Integrity**
- Foreign key constraints with appropriate CASCADE/SET NULL rules
- Check constraints for enum-like fields
- Unique constraints where appropriate

## Core Tables

### User Management
- **`users`**: Core user accounts with authentication and profile data
- **`user_preferences`**: User settings and notification preferences
- **`auth_sessions`**: Active authentication sessions
- **`password_reset_tokens`**: Password reset token management

### Token Economy
- **`wallets`**: User token balances and currency conversion rates
- **`ledger`**: Immutable transaction history (append-only)
- **`tips`**: Individual tip transactions during streams
- **`payments`**: Payment processing records for token purchases
- **`payouts`**: Performer payout requests and processing

### Streaming
- **`streams`**: Live streaming sessions and metadata
- **`stream_viewers`**: Track viewers and their activity per stream

### Verification & Safety
- **`kyc_verifications`**: Age and identity verification records
- **`reports`**: User reports and moderation cases
- **`moderation_flags`**: Automated moderation detection results
- **`user_sanctions`**: User bans and suspensions

### Audit & Compliance
- **`audit_logs`**: Security and compliance audit trail

## Important Notes

### Token Economy
- Tokens are site-issued virtual currency (not blockchain)
- Default conversion rate: 100 tokens = $1 USD
- Platform fees are tracked separately in the ledger
- Reserved balances prevent double-spending during transactions

### Age Verification
- All users must provide date of birth
- KYC verification is required for performers before payouts
- Document storage URLs point to encrypted S3 storage
- Verification scores help with automated processing

### Moderation System
- Automated detection with confidence scores
- Human review queue for flagged content
- Escalation procedures for high-priority cases
- Comprehensive audit trail for all moderation actions

### Security Features
- Row Level Security policies (implement with your auth system)
- Encrypted password storage using bcrypt
- Session management with device tracking
- IP address logging for security monitoring

## Setup Instructions

1. **Create Database**:
   ```sql
   CREATE DATABASE livepanty;
   \c livepanty;
   ```

2. **Run Schema**:
   ```bash
   psql -d livepanty -f schema.sql
   ```

3. **Update Admin Password**:
   ```sql
   UPDATE users SET password_hash = crypt('your_secure_password', gen_salt('bf')) 
   WHERE email = 'admin@example.com';
   ```

4. **Configure RLS**:
   - Implement authentication functions (`current_user_id()`, etc.)
   - Customize RLS policies based on your application needs

## Indexes and Performance

The schema includes strategic indexes for:
- User lookups by email, username, role
- Stream queries by host, status, category
- Transaction history by user and date
- Moderation queue by status and priority
- Real-time queries for active streams

## Views

- **`user_summary`**: User data with wallet balance and KYC status
- **`stream_summary`**: Stream data with statistics and viewer counts

## Compliance Considerations

- **Data Retention**: Implement policies for chat logs, recordings
- **Right to Erasure**: Soft deletes with `deleted_at` timestamps
- **Audit Trail**: Comprehensive logging for all financial transactions
- **Age Verification**: Mandatory for all users, enhanced for performers

## Scaling Considerations

- **Read Replicas**: Use for reporting and analytics queries
- **Partitioning**: Consider partitioning `ledger` by date for large volumes
- **Archiving**: Move old audit logs and completed transactions to cold storage
- **Connection Pooling**: Use pgBouncer or similar for connection management

## Backup Strategy

- **Daily Full Backups**: Include all user data and transactions
- **Point-in-Time Recovery**: Enable WAL archiving
- **Cross-Region Replication**: For disaster recovery
- **Encrypted Backups**: All backups must be encrypted

## Monitoring

Key metrics to monitor:
- Database connection count and duration
- Query performance (slow queries)
- Index usage and efficiency
- Transaction volume and latency
- Disk usage and growth rate
