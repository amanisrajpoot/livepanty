# LivePanty Backend

Backend services for the LivePanty live streaming tipping platform.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker (optional)

### Installation

1. **Clone and setup:**
```bash
cd backend
npm install
```

2. **Environment configuration:**
```bash
cp env.example .env
# Edit .env with your configuration
```

3. **Database setup:**
```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Run database migrations
npm run migrate

# Seed initial data
npm run seed
```

4. **Start development server:**
```bash
npm run dev
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Request handlers
│   ├── database/        # Database connection and migrations
│   ├── middleware/      # Express middleware
│   ├── models/          # Data models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── socket/          # Socket.IO handlers
│   ├── utils/           # Utility functions
│   └── server.js        # Main server file
├── logs/                # Application logs
├── uploads/             # File uploads
├── tests/               # Test files
├── docker-compose.yml   # Development infrastructure
├── Dockerfile          # Production container
└── package.json        # Dependencies and scripts
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users/:id` - Get user profile
- `PATCH /api/users/:id` - Update user profile
- `GET /api/users/:id/preferences` - Get user preferences
- `PATCH /api/users/:id/preferences` - Update preferences

### Wallet
- `GET /api/wallet/balance` - Get token balance
- `POST /api/wallet/buy` - Buy tokens
- `POST /api/wallet/transfer` - Send tip
- `GET /api/wallet/transactions` - Transaction history

### Streams
- `GET /api/streams` - Get live streams
- `POST /api/streams` - Create stream
- `GET /api/streams/:id` - Get stream details
- `PATCH /api/streams/:id` - Update stream
- `POST /api/streams/:id/start` - Start stream
- `DELETE /api/streams/:id` - End stream

### KYC
- `POST /api/kyc/submit` - Submit KYC documents
- `GET /api/kyc/:id/status` - Get verification status
- `GET /api/kyc/verifications` - Get user verifications

### Moderation
- `POST /api/moderation/report` - Report content
- `GET /api/moderation/flags` - Get moderation flags

### Admin
- `GET /api/admin/users` - Get all users
- `POST /api/admin/kyc/:id/approve` - Approve KYC
- `GET /api/admin/analytics` - Platform analytics

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 📊 Database Schema

The application uses PostgreSQL with the following core tables:

- `users` - User accounts and profiles
- `wallets` - Token balances and currency
- `ledger` - Immutable transaction history
- `streams` - Stream sessions and metadata
- `tips` - Individual tip transactions
- `kyc_verifications` - Age verification records
- `payouts` - Payout requests
- `reports` - User reports and moderation
- `audit_logs` - Security and compliance logging

## 🛡️ Security Features

- **JWT Authentication** with refresh tokens
- **Rate limiting** to prevent abuse
- **Input validation** and sanitization
- **SQL injection protection**
- **XSS protection**
- **CORS configuration**
- **Helmet security headers**
- **Audit logging** for compliance

## 🔄 Real-time Features

Socket.IO integration for real-time functionality:

- **WebRTC signaling** for streaming
- **Live chat** in streams
- **Real-time tips** with animations
- **User presence** tracking
- **Stream notifications**

## 💳 Payment Integration

Stripe integration for token purchases:

- **Secure payment processing**
- **Webhook handling**
- **Fraud prevention**
- **Transaction logging**
- **Refund support**

## 🔍 Age Verification

Comprehensive age verification system:

- **Document upload** and validation
- **Liveness detection**
- **Manual review** process
- **Compliance reporting**
- **Audit trail**

## 📝 Logging

Structured logging with Winston:

- **Console output** for development
- **File logging** for production
- **Error tracking** and monitoring
- **Performance metrics**
- **Audit trails**

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 🐳 Docker

### Development
```bash
docker-compose up -d
```

### Production
```bash
docker build -t livepanty-backend .
docker run -p 3001:3001 livepanty-backend
```

## 📈 Monitoring

- **Health checks** at `/health`
- **API documentation** at `/api-docs`
- **Performance metrics**
- **Error tracking**
- **Database monitoring**

## 🔧 Configuration

Key environment variables:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `STRIPE_SECRET_KEY` - Stripe API key
- `AWS_ACCESS_KEY_ID` - AWS credentials for S3

## 📚 API Documentation

Interactive API documentation is available at `/api-docs` when running the server.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

Proprietary - All rights reserved

## 🆘 Support

For support, email api-support@livepanty.com or create an issue in the repository.
