# Quick EC2 Deployment Guide

Deploy LivePanty on a single EC2 instance in 3 simple steps.

## Step 1: Launch EC2 Instance

```bash
# Option A: Use script (on your local machine)
./aws/launch-ec2-instance.sh

# Option B: Manual launch via AWS Console
# - Go to EC2 Console → Launch Instance
# - Choose: Ubuntu 22.04 LTS
# - Instance: t3.medium (4GB RAM) or t3.large (8GB RAM)
# - Storage: 30GB
# - Security Group: Allow ports 22, 80, 443, 3001
# - Launch!
```

After launch, note:
- **Public IP**: `YOUR_EC2_IP`
- **SSH Key**: `your-key.pem`

## Step 2: SSH and Setup

```bash
# SSH into instance
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# Clone repository
git clone https://github.com/your-username/livepanty.git
cd livepanty

# Run setup script
./aws/setup-ec2-instance.sh
```

## Step 3: Configure and Deploy

```bash
# Configure environment
cd backend
cp env.example .env
nano .env  # Edit minimum required values

# Minimum required in .env:
# POSTGRES_PASSWORD=your-secure-password
# REDIS_PASSWORD=your-secure-password
# JWT_SECRET=$(openssl rand -base64 32)
# JWT_REFRESH_SECRET=$(openssl rand -base64 32)
# CLIENT_URL=http://YOUR_EC2_IP
# API_URL=http://YOUR_EC2_IP:3001
# CORS_ORIGIN=http://YOUR_EC2_IP
# ANNOUNCED_IP=YOUR_EC2_IP

# Deploy
cd ..
./aws/deploy-to-ec2.sh
```

**Done!** Access at: `http://YOUR_EC2_IP`

## What Gets Deployed

- PostgreSQL (database)
- Redis (cache)
- Backend API (Node.js/Express)
- Frontend (React)
- All running via Docker Compose

## Common Commands

```bash
# View logs
docker compose -f docker-compose.simple.yml logs -f

# Restart
docker compose -f docker-compose.simple.yml restart

# Stop
docker compose -f docker-compose.simple.yml down

# Start
docker compose -f docker-compose.simple.yml up -d

# Check status
docker compose -f docker-compose.simple.yml ps
```

## Update Application

```bash
cd ~/livepanty
git pull origin main
docker compose -f docker-compose.simple.yml down
docker compose -f docker-compose.simple.yml build
docker compose -f docker-compose.simple.yml up -d
```

## Cost

- **~$30-60/month** (depending on instance size)
- Much cheaper than ECS setup!

## That's It!

Simple, portable, single-server deployment. Perfect for getting started!

