# Simple EC2 Deployment Guide

This guide helps you deploy LivePanty on a single EC2 instance using Docker Compose.

## Architecture

```
┌─────────────────────────────────────┐
│      Single EC2 Instance            │
│  ┌──────────────────────────────┐  │
│  │    Docker Compose             │  │
│  │  ┌────────┐  ┌────────┐       │  │
│  │  │Frontend│  │Backend │       │  │
│  │  └────────┘  └────┬──┘       │  │
│  │                   │           │  │
│  │  ┌────────┐  ┌───▼───┐       │  │
│  │  │Postgres│  │ Redis │       │  │
│  │  └────────┘  └───────┘       │  │
│  └──────────────────────────────┘  │
│                                     │
│  Port 80/443 → Nginx Reverse Proxy │
└─────────────────────────────────────┘
```

## Prerequisites

1. AWS Account
2. AWS CLI installed (`aws configure`)
3. SSH key pair created

## Quick Start

### Step 1: Launch EC2 Instance

```bash
./aws/launch-ec2-instance.sh
```

Or manually:
1. Go to EC2 Console → Launch Instance
2. Choose: Ubuntu 22.04 LTS
3. Instance type: `t3.medium` or `t3.large` (min 4GB RAM)
4. Configure security group:
   - Port 22 (SSH) from your IP
   - Port 80 (HTTP) from anywhere
   - Port 443 (HTTPS) from anywhere
   - Port 3001 (Backend API) - optional, for direct access
5. Add storage: 30GB minimum
6. Launch and save your key pair

### Step 2: Connect to Instance

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
```

### Step 3: Run Setup Script on Instance

```bash
# On EC2 instance
curl -fsSL https://raw.githubusercontent.com/your-repo/livepanty/main/aws/setup-ec2-instance.sh | bash
```

Or manually copy and run:
```bash
./aws/setup-ec2-instance.sh
```

### Step 4: Deploy Application

```bash
# On EC2 instance
cd ~/livepanty
./aws/deploy-to-ec2.sh
```

## Manual Setup (if scripts don't work)

### 1. Install Docker and Docker Compose

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin git
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu
newgrp docker
```

### 2. Clone Repository

```bash
git clone https://github.com/your-username/livepanty.git
cd livepanty
```

### 3. Configure Environment

```bash
cd backend
cp env.example .env
nano .env  # Edit with your production values
```

### 4. Start Services

```bash
cd ..
docker compose -f docker-compose.prod.yml up -d
```

### 5. Check Status

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

## Configuration

### Environment Variables

Edit `backend/.env`:

```bash
NODE_ENV=production
PORT=3001

# Database (Docker Compose handles this)
DATABASE_URL=postgresql://livepanty:YOUR_DB_PASSWORD@postgres:5432/livepanty_prod

# Redis (Docker Compose handles this)
REDIS_URL=redis://:YOUR_REDIS_PASSWORD@redis:6379

# JWT Secrets (generate secure random strings)
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

# Application URLs
CLIENT_URL=http://YOUR_EC2_IP
API_URL=http://YOUR_EC2_IP:3001
CORS_ORIGIN=http://YOUR_EC2_IP

# AWS S3 (optional, for file storage)
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket

# Payment (optional)
RAZORPAY_KEY_ID=your-key
RAZORPAY_KEY_SECRET=your-secret

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@livepanty.com

# Mediasoup
MEDIASOUP_NUM_WORKERS=2
MEDIASOUP_MIN_PORT=10000
MEDIASOUP_MAX_PORT=20000
ANNOUNCED_IP=YOUR_EC2_PUBLIC_IP
```

### Update Frontend Environment

```bash
cd frontend
echo "REACT_APP_API_URL=http://YOUR_EC2_IP:3001/api" > .env.production
echo "REACT_APP_WS_URL=http://YOUR_EC2_IP:3001" >> .env.production
```

## Security Best Practices

### 1. Use Strong Passwords

Generate secure passwords:
```bash
openssl rand -base64 32
```

### 2. Configure Firewall (UFW)

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3. Set Up SSL/HTTPS (Optional but Recommended)

Use Let's Encrypt with Certbot:
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 4. Regular Updates

```bash
sudo apt-get update && sudo apt-get upgrade -y
```

## Backup Strategy

### Database Backup

```bash
# Manual backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U livepanty livepanty_prod > backup_$(date +%Y%m%d).sql

# Automated daily backup (add to crontab)
0 2 * * * cd /home/ubuntu/livepanty && docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U livepanty livepanty_prod > /home/ubuntu/backups/db_$(date +\%Y\%m\%d).sql
```

### Backup to S3

```bash
# Install AWS CLI
sudo apt-get install -y awscli

# Configure
aws configure

# Upload backup
aws s3 cp backup_*.sql s3://your-backup-bucket/
```

## Monitoring

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
```

### Check Resource Usage

```bash
# Docker stats
docker stats

# System resources
htop
df -h
```

### Health Checks

```bash
# Backend health
curl http://localhost:3001/health

# Frontend
curl http://localhost:3000
```

## Updating Application

### Pull Latest Code

```bash
cd ~/livepanty
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs

# Check container status
docker compose -f docker-compose.prod.yml ps

# Restart service
docker compose -f docker-compose.prod.yml restart backend
```

### Out of Memory

```bash
# Check memory usage
free -h
docker stats

# Increase swap (if needed)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Database Connection Issues

```bash
# Check if postgres is running
docker compose -f docker-compose.prod.yml ps postgres

# Check database logs
docker compose -f docker-compose.prod.yml logs postgres

# Connect to database
docker compose -f docker-compose.prod.yml exec postgres psql -U livepanty -d livepanty_prod
```

## Cost

- EC2 t3.medium: ~$30/month
- EC2 t3.large: ~$60/month
- Data transfer: ~$10-20/month
- **Total: ~$40-80/month** (much cheaper than ECS!)

## Scaling Considerations

When you need to scale:

1. **Vertical Scaling**: Upgrade EC2 instance type (t3.medium → t3.large → t3.xlarge)
2. **Horizontal Scaling**: Migrate to ECS/ECS Fargate (use provided scripts)
3. **Database**: Migrate to RDS when database becomes bottleneck

This single EC2 setup can handle:
- 100-500 concurrent users
- Moderate traffic streams
- Good performance with proper instance size

