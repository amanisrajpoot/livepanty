# 🚀 LivePanty Platform - Local Setup Guide

## Prerequisites
- Node.js 18+ installed ✅
- Neon DB account (free tier available)

## Quick Setup Steps

### 1. Get Neon DB Connection String
1. Go to [Neon Console](https://console.neon.tech/)
2. Create a new project or use existing one
3. Copy the connection string (it looks like: `postgresql://username:password@ep-xxx-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require`)

### 2. Update Environment Configuration
Edit `/backend/.env` file and replace the database configuration:

```bash
# Replace these lines in .env file:
DATABASE_URL=postgresql://YOUR_USERNAME:YOUR_PASSWORD@YOUR_ENDPOINT.neon.tech/neondb?sslmode=require
DB_HOST=YOUR_ENDPOINT.neon.tech
DB_PORT=5432
DB_NAME=neondb
DB_USER=YOUR_USERNAME
DB_PASSWORD=YOUR_PASSWORD
```

### 3. Test Database Connection
```bash
cd backend
node scripts/test-connection.js
```

### 4. Initialize Database Schema
```bash
cd backend
node scripts/setup-database.js
```

### 5. Start Backend Server
```bash
cd backend
npm start
```

### 6. Start Frontend Server (in new terminal)
```bash
cd frontend
npm start
```

### 7. Test the Application
- Backend: http://localhost:3001/health
- Frontend: http://localhost:3000
- API Docs: http://localhost:3001/api-docs

## What's Already Set Up

### ✅ Backend (Node.js/Express)
- Complete API with 50+ endpoints
- JWT authentication system
- Socket.IO for real-time features
- Comprehensive error handling
- Swagger API documentation
- Security middleware (Helmet, CORS, rate limiting)

### ✅ Frontend (React/TypeScript)
- Modern React 18 with TypeScript
- Tailwind CSS for styling
- Zustand for state management
- Complete UI with all pages
- Real-time WebSocket integration ready

### ✅ Database Schema
- 15 tables with proper relationships
- Indexes for performance
- Triggers for automatic timestamps
- Admin user pre-created
- Complete audit trail

### ✅ WebRTC POC
- mediasoup SFU implementation
- Signaling server
- Real-time video streaming ready

## Testing Checklist

### Backend API Tests
- [ ] Health check endpoint
- [ ] User registration
- [ ] User login
- [ ] JWT token validation
- [ ] All CRUD operations
- [ ] Error handling

### Frontend Tests
- [ ] Page loading
- [ ] Navigation
- [ ] Authentication flow
- [ ] State management
- [ ] Responsive design

### Database Tests
- [ ] Connection established
- [ ] Tables created
- [ ] Indexes working
- [ ] Triggers functioning
- [ ] Admin user accessible

### Integration Tests
- [ ] Frontend ↔ Backend communication
- [ ] WebSocket connections
- [ ] Real-time features
- [ ] Error propagation

## Common Issues & Solutions

### Database Connection Issues
```bash
# Test connection
node scripts/test-connection.js

# Common error codes:
# ENOTFOUND - Check hostname
# ECONNREFUSED - Check port
# 28P01 - Check credentials
# 3D000 - Check database name
```

### Port Already in Use
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or use different port
PORT=3002 npm start
```

### Frontend Build Issues
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm start
```

## Next Steps After Setup

1. **Test Basic Functionality**
   - Register a new user
   - Login and verify JWT tokens
   - Test API endpoints

2. **Test Real-time Features**
   - WebSocket connections
   - Live streaming (when implemented)
   - Chat functionality

3. **Test Payment Integration**
   - Stripe setup (optional)
   - Token purchase flow
   - Wallet management

4. **Test Admin Features**
   - Admin dashboard
   - User management
   - Content moderation

## Development Commands

```bash
# Backend
npm start          # Start server
npm run dev        # Start with nodemon
npm test           # Run tests

# Frontend
npm start          # Start React app
npm run build      # Build for production
npm test           # Run tests

# Database
node scripts/test-connection.js    # Test DB connection
node scripts/setup-database.js     # Initialize schema
```

## Project Structure
```
livepanty/
├── backend/           # Node.js/Express API
├── frontend/          # React/TypeScript UI
├── webrtc-poc/        # WebRTC streaming POC
├── database/          # Database schema
├── compliance/        # Legal documentation
└── api/              # API documentation
```

## Support
If you encounter any issues:
1. Check the error logs
2. Verify environment configuration
3. Test database connection
4. Check port availability
5. Review the troubleshooting guide

Happy coding! 🎉
