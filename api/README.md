# Live Streaming Tipping Platform API

## Overview
This OpenAPI 3.0 specification defines the complete REST API for the live streaming tipping platform. The API is designed with security, scalability, and compliance in mind.

## Key Features
- **JWT Authentication** with refresh tokens
- **Rate limiting** to prevent abuse
- **Comprehensive error handling** with structured responses
- **Real-time streaming** integration with WebRTC signaling
- **Token economy** with secure payment processing
- **KYC compliance** for age verification
- **Moderation tools** for content safety
- **Admin dashboard** for platform management

## Authentication
All endpoints require JWT authentication except:
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- Public stream listings (read-only)

Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Rate Limiting
The API implements comprehensive rate limiting:

| Endpoint Category | Rate Limit | Description |
|------------------|------------|-------------|
| General API | 1000 requests/hour | Standard API endpoints |
| Streaming | 100 requests/minute | Stream management |
| Payments | 10 requests/minute | Token purchases |
| Tipping | 60 tips/minute | Tip sending |
| Auth | 10 attempts/minute | Login attempts |

## Core Endpoints

### Authentication (`/auth/`)
- **POST** `/auth/register` - Register new user
- **POST** `/auth/login` - User login
- **POST** `/auth/logout` - Invalidate session
- **GET** `/auth/me` - Get current user profile
- **POST** `/auth/refresh` - Refresh JWT token

### User Management (`/users/`)
- **GET** `/users/{userId}` - Get user profile
- **PATCH** `/users/{userId}` - Update user profile
- **GET** `/users/{userId}/preferences` - Get user preferences
- **PATCH** `/users/{userId}/preferences` - Update preferences

### KYC & Verification (`/kyc/`)
- **POST** `/kyc/submit` - Submit KYC documents
- **GET** `/kyc/{kycId}/status` - Get verification status
- **GET** `/kyc/verifications` - Get user's KYC history

### Wallet & Tokens (`/wallet/`)
- **GET** `/wallet/balance` - Get token balance
- **POST** `/wallet/buy` - Initiate token purchase
- **GET** `/wallet/transactions` - Get transaction history
- **POST** `/wallet/transfer` - Send tip to performer

### Streaming (`/streams/`)
- **GET** `/streams` - Get live streams
- **POST** `/streams` - Create new stream
- **GET** `/streams/{streamId}` - Get stream details
- **PATCH** `/streams/{streamId}` - Update stream
- **DELETE** `/streams/{streamId}` - End stream
- **POST** `/streams/{streamId}/start` - Start streaming
- **POST** `/streams/{streamId}/join` - Join as viewer
- **GET** `/streams/{streamId}/viewers` - Get stream viewers
- **GET** `/streams/{streamId}/tips` - Get stream tips

### Payouts (`/payouts/`)
- **POST** `/payouts/request` - Request payout
- **GET** `/payouts/requests` - Get payout history

### Moderation (`/moderation/`)
- **POST** `/moderation/report` - Report content/user
- **GET** `/moderation/flags` - Get moderation flags (Admin)

### Admin (`/admin/`)
- **GET** `/admin/users` - Get all users (Admin)
- **POST** `/admin/kyc/{kycId}/approve` - Approve KYC (Admin)
- **GET** `/admin/analytics/overview` - Platform analytics (Admin)

## Data Models

### Core Entities

#### User
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "display_name": "John Doe",
  "username": "johndoe",
  "role": "performer",
  "status": "active",
  "country": "US",
  "date_of_birth": "1990-01-01",
  "profile_image_url": "https://...",
  "bio": "Performer bio",
  "email_verified": true,
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### Stream
```json
{
  "id": "uuid",
  "host_id": "uuid",
  "host_name": "John Doe",
  "title": "My Amazing Stream",
  "description": "Stream description",
  "category": "entertainment",
  "tags": ["music", "dance"],
  "status": "live",
  "viewer_count": 150,
  "total_tokens_received": 2500,
  "started_at": "2024-01-01T00:00:00Z"
}
```

#### Tip
```json
{
  "id": "uuid",
  "stream_id": "uuid",
  "from_user_id": "uuid",
  "to_user_id": "uuid",
  "tokens": 100,
  "message": "Great performance!",
  "is_private": false,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Token Economy

#### Wallet Balance
```json
{
  "token_balance": 1500,
  "reserved_balance": 100,
  "currency_code": "USD",
  "conversion_rate": 100.0
}
```

#### Transaction
```json
{
  "id": "uuid",
  "transaction_type": "tip_sent",
  "amount_tokens": -100,
  "amount_currency": 1.00,
  "fee_tokens": 0,
  "balance_after": 1400,
  "description": "Tip to performer",
  "created_at": "2024-01-01T00:00:00Z"
}
```

## WebRTC Integration

### Stream Creation Flow
1. **POST** `/streams` - Create stream session
2. **GET** SFU configuration (signaling URL, TURN servers)
3. **POST** `/streams/{id}/start` - Mark stream as started
4. **WebRTC** connection established via SFU

### Viewer Join Flow
1. **POST** `/streams/{id}/join` - Join stream
2. **GET** viewer token and SFU configuration
3. **WebRTC** connection established
4. **Real-time** tip events via WebSocket

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request parameters",
  "code": "INVALID_EMAIL_FORMAT",
  "details": {
    "field": "email",
    "value": "invalid-email"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Common Error Codes
- `VALIDATION_ERROR` - Request validation failed
- `AUTHENTICATION_REQUIRED` - JWT token missing/invalid
- `INSUFFICIENT_BALANCE` - Not enough tokens for tip
- `STREAM_NOT_FOUND` - Stream doesn't exist
- `KYC_REQUIRED` - Age verification needed
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `PERMISSION_DENIED` - Insufficient permissions

## Security Features

### JWT Tokens
- **Access tokens**: 1 hour expiration
- **Refresh tokens**: 30 days expiration
- **Secure signing**: RS256 algorithm
- **Token rotation**: Refresh tokens are rotated on use

### Data Protection
- **PII encryption**: Sensitive data encrypted at rest
- **HTTPS only**: All communication encrypted
- **Input validation**: Strict validation on all inputs
- **SQL injection prevention**: Parameterized queries
- **XSS protection**: Content sanitization

### Compliance
- **Age verification**: Mandatory KYC for performers
- **Audit logging**: All actions logged for compliance
- **Data retention**: Configurable retention policies
- **Right to erasure**: User data deletion support

## WebSocket Events

Real-time events for streaming:

### Stream Events
```json
{
  "type": "viewer_joined",
  "stream_id": "uuid",
  "viewer": {
    "user_id": "uuid",
    "display_name": "John"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Tip Events
```json
{
  "type": "tip_received",
  "stream_id": "uuid",
  "tip": {
    "id": "uuid",
    "from_user": "John Doe",
    "tokens": 100,
    "message": "Great show!"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Testing

### Postman Collection
Import the included Postman collection for API testing:
- Authentication flows
- CRUD operations
- Error scenarios
- Rate limiting tests

### Test Environment
- **Base URL**: `https://staging-api.livepanty.com/v1`
- **Test cards**: Use Stripe test card numbers
- **Mock data**: Pre-populated test users and streams

## SDKs and Libraries

### JavaScript/TypeScript
```bash
npm install @livepanty/api-client
```

### Python
```bash
pip install livepanty-api
```

### Go
```bash
go get github.com/livepanty/api-client-go
```

## Support

- **API Documentation**: [docs.livepanty.com](https://docs.livepanty.com)
- **Support Email**: api-support@livepanty.com
- **Status Page**: [status.livepanty.com](https://status.livepanty.com)
- **Discord**: [discord.gg/livepanty](https://discord.gg/livepanty)
