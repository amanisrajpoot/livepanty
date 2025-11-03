# 📜 Deployment Scripts Documentation

This directory contains all deployment and development scripts for LivePanty.

---

## 🚀 Available Scripts

### **1. `setup-env.sh` - Environment Setup**
Interactive script to set up your `.env` file with all required configuration.

**Usage:**
```bash
./scripts/setup-env.sh
# or
npm run setup
```

**What it does:**
- Creates `.env` from `env.example`
- Generates JWT secrets automatically
- Prompts for database passwords
- Configures optional services (AWS, Razorpay, etc.)

---

### **2. `dev.sh` - Development Setup**
Sets up the development environment (PostgreSQL, Redis).

**Usage:**
```bash
./scripts/dev.sh
# or
npm run dev:up
```

**What it does:**
- Starts PostgreSQL and Redis containers
- Waits for services to be ready
- Initializes database schema
- Checks if dependencies are installed

**Next steps after running:**
```bash
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend
npm run dev:frontend
```

---

### **3. `deploy.sh` - Production Deployment**
Complete production deployment script.

**Usage:**
```bash
./scripts/deploy.sh
# or
npm run deploy
```

**What it does:**
- Builds and starts all Docker services
- Waits for database to be ready
- Initializes database schema
- Checks health of all services
- Shows service status and URLs

**Prerequisites:**
- `.env` file configured
- Docker and Docker Compose installed

---

### **4. `health-check.sh` - Health Check**
Checks the health of all running services.

**Usage:**
```bash
./scripts/health-check.sh
# or
npm run health
```

**What it checks:**
- Frontend accessibility
- Backend health endpoint
- API documentation
- Docker services status
- Database connection
- Redis connection
- Service logs

---

## 📋 NPM Scripts Reference

All scripts are accessible via npm commands:

| Command | Script | Description |
|---------|--------|-------------|
| `npm run setup` | `setup-env.sh` | Setup environment |
| `npm run dev:up` | `dev.sh` | Start dev services |
| `npm run dev:down` | - | Stop dev services |
| `npm run dev:backend` | - | Start backend dev server |
| `npm run dev:frontend` | - | Start frontend dev server |
| `npm run deploy` | `deploy.sh` | Deploy to production |
| `npm run health` | `health-check.sh` | Check service health |
| `npm run logs` | - | View all service logs |
| `npm run logs:backend` | - | View backend logs |
| `npm run logs:frontend` | - | View frontend logs |
| `npm run logs:db` | - | View database logs |
| `npm run clean` | - | Stop and remove all volumes |
| `npm run clean:dev` | - | Stop and remove dev volumes |
| `npm run restart` | - | Restart all services |
| `npm run status` | - | Show service status |

---

## 🚀 Quick Start Guide

### **First Time Setup:**
```bash
# 1. Setup environment
npm run setup

# 2. Start development services
npm run dev:up

# 3. Start backend (Terminal 1)
npm run dev:backend

# 4. Start frontend (Terminal 2)
npm run dev:frontend
```

### **Production Deployment:**
```bash
# 1. Ensure .env is configured
npm run setup

# 2. Deploy
npm run deploy

# 3. Check health
npm run health
```

---

## 🔧 Troubleshooting

### **Script Permissions:**
If scripts are not executable:
```bash
chmod +x scripts/*.sh
```

### **Docker Issues:**
If Docker services fail to start:
```bash
# Check Docker status
docker ps

# View logs
npm run logs

# Restart services
npm run restart
```

### **Database Issues:**
If database fails to initialize:
```bash
# Clean volumes and retry
npm run clean:dev
npm run dev:up
```

### **Environment Issues:**
If `.env` is missing or incorrect:
```bash
# Re-run setup
npm run setup
```

---

## 📝 Script Details

### **Environment Variables:**
All scripts use environment variables from `.env` file. Key variables:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `JWT_SECRET` - JWT signing key
- `AWS_ACCESS_KEY_ID` - AWS credentials (optional)
- `RAZORPAY_KEY_ID` - Payment gateway (optional)

### **Docker Compose Files:**
- `docker-compose.dev.yml` - Development services
- `docker-compose.prod.yml` - Production services

### **Database Initialization:**
Scripts look for init scripts in this order:
1. `backend/database/init.sql`
2. `database/schema.sql`

---

## 🔒 Security Notes

1. **Never commit `.env` file** - It contains secrets
2. **Generate strong secrets** - Use `setup-env.sh` for JWT secrets
3. **Use production values** - Different `.env` for production
4. **Secure database passwords** - Use strong passwords
5. **Restrict Docker access** - Only authorized users

---

## 📚 Related Documentation

- `FEATURE_COMPLETION_PLAN.md` - Feature completion roadmap
- `FEATURE_GAP_ANALYSIS.md` - Detailed gap analysis
- `STACK_SIMPLIFICATION_GUIDE.md` - Deployment simplification guide
- `DEPLOYMENT_GUIDE.md` - Production deployment guide

---

**For more help, check the main README.md or documentation files.**

