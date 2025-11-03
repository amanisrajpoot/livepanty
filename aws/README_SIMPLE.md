# Simple EC2 Deployment Guide

Deploy LivePanty on a single EC2 instance - simple, portable, and cost-effective.

## Quick Start (3 Steps)

### Step 1: Launch EC2 Instance

**Option A: Using the script (locally)**
```bash
./aws/launch-ec2-instance.sh
```

**Option B: Manual Launch**
1. Go to AWS Console → EC2 → Launch Instance
2. Choose: Ubuntu 22.04 LTS
3. Instance: `t3.medium` (4 vCPU, 4GB RAM) or `t3.large` (8GB RAM)
4. Storage: 30GB
5. Security Group: Allow ports 22, 80, 443, 3001
6. Launch!

### Step 2: SSH and Setup

```bash
# SSH into instance
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# On EC2 instance
git clone https://github.com/your-username/livepanty.git
cd livepanty
./aws/setup-ec2-instance.sh
```

### Step 3: Deploy

```bash
# Configure environment
cd backend
cp env.example .env
nano .env  # Edit with your values

# Deploy
cd ..
./aws/deploy-to-ec2.sh
```

**Done!** Access your app at `http://YOUR_EC2_IP`

## What Gets Installed

- Docker & Docker Compose
- Git
- All application services (Postgres, Redis, Backend, Frontend)
- Automatic startup on boot
- Firewall configuration

## Configuration

### Minimum .env Configuration

Edit `backend/.env`:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://livepanty:YOUR_PASSWORD@postgres:5432/livepanty_prod
REDIS_URL=redis://:YOUR_REDIS_PASSWORD@redis:6379
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
CLIENT_URL=http://YOUR_EC2_IP
API_URL=http://YOUR_EC2_IP:3001
CORS_ORIGIN=http://YOUR_EC2_IP
ANNOUNCED_IP=YOUR_EC2_IP
```

Generate passwords:
```bash
openssl rand -base64 32
```

## Common Commands

```bash
# View logs
docker compose -f docker-compose.simple.yml logs -f

# Restart services
docker compose -f docker-compose.simple.yml restart

# Stop services
docker compose -f docker-compose.simple.yml down

# Start services
docker compose -f docker-compose.simple.yml up -d

# Check status
docker compose -f docker-compose.simple.yml ps
```

## Updating

```bash
cd ~/livepanty
git pull origin main
docker compose -f docker-compose.simple.yml down
docker compose -f docker-compose.simple.yml build
docker compose -f docker-compose.simple.yml up -d
```

## Backup

```bash
# Database backup
docker compose -f docker-compose.simple.yml exec postgres pg_dump -U livepanty livepanty_prod > backup_$(date +%Y%m%d).sql

# Copy backup to local machine
scp -i your-key.pem ubuntu@YOUR_EC2_IP:~/backup_*.sql ./
```

## Cost

- **EC2 t3.medium**: ~$30/month
- **EC2 t3.large**: ~$60/month
- **Total: ~$30-60/month** (vs $150-200 with ECS)

## Scaling

When you need more:
- **Upgrade instance**: Stop → Change type → Start
- **Add more instances**: Use load balancer + multiple EC2
- **Move to ECS**: Use the full AWS deployment scripts

## Troubleshooting

### Can't connect
```bash
# Check if services are running
docker compose -f docker-compose.simple.yml ps

# Check logs
docker compose -f docker-compose.simple.yml logs backend
```

### Out of memory
```bash
# Upgrade instance type
# Or add swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Database issues
```bash
# Connect to database
docker compose -f docker-compose.simple.yml exec postgres psql -U livepanty -d livepanty_prod

# Check database logs
docker compose -f docker-compose.simple.yml logs postgres
```

## Security

1. Change default passwords
2. Use strong JWT secrets
3. Enable UFW firewall (already done)
4. Keep system updated: `sudo apt update && sudo apt upgrade`
5. Set up SSL with Let's Encrypt (for production domain)

## That's It!

Simple, portable, single-server deployment. Perfect for:
- Testing
- Small to medium traffic
- Quick deployment
- Cost-effective hosting

