# Simple EC2 Deployment Steps

## What You'll Do

1. **Launch an EC2 instance** (via AWS Console or script)
2. **SSH into the EC2 instance**
3. **Clone your repository**
4. **Run the deployment script**

That's it! Everything runs automatically.

## Step-by-Step Instructions

### Step 1: Launch EC2 Instance

**Option A: Manual (AWS Console)**
1. Go to AWS Console → EC2 → Launch Instance
2. Choose: **Ubuntu 22.04 LTS**
3. Instance Type: **t3.medium** (4 vCPU, 4GB RAM) or **t3.large** (8GB RAM)
4. Key Pair: Create or select one (save the `.pem` file!)
5. Network: Create security group with rules:
   - Port **22** (SSH) from your IP
   - Port **80** (HTTP) from anywhere (0.0.0.0/0)
   - Port **443** (HTTPS) from anywhere (0.0.0.0/0)
   - Port **3001** (Backend API) from anywhere (0.0.0.0/0)
6. Storage: **30GB** minimum
7. Launch instance
8. **Note the Public IP address**

**Option B: Using Script (on your local machine)**
```bash
# Make sure you have AWS CLI configured
aws configure

# Run the launch script
./aws/launch-ec2-instance.sh
```

### Step 2: SSH Into EC2

```bash
# On your local machine
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

### Step 3: Clone Repository

Once you're SSH'd into the EC2 instance:

```bash
# Clone your repository
git clone https://github.com/your-username/livepanty.git
cd livepanty
```

### Step 4: Run Setup Script

```bash
# This installs Docker and Docker Compose
./aws/setup-ec2-instance.sh
```

**Note**: You might need to logout and login again after this for Docker group to take effect, or run:
```bash
newgrp docker
```

### Step 5: Configure Environment

```bash
# Go to backend directory
cd backend

# Copy example environment file
cp env.example .env

# Edit the .env file with your values
nano .env
```

**Minimum required in `.env` file:**

```bash
NODE_ENV=production
PORT=3001

# Database (generate secure password)
POSTGRES_PASSWORD=your-secure-password-here
DATABASE_URL=postgresql://livepanty:your-secure-password-here@postgres:5432/livepanty_prod

# Redis (generate secure password)
REDIS_PASSWORD=your-secure-redis-password-here
REDIS_URL=redis://:your-secure-redis-password-here@redis:6379

# JWT Secrets (generate secure random strings)
JWT_SECRET=generate-with-openssl-rand-base64-32
JWT_REFRESH_SECRET=generate-with-openssl-rand-base64-32

# Get your EC2 public IP (run this on EC2)
# curl http://169.254.169.254/latest/meta-data/public-ipv4

# Application URLs (replace YOUR_EC2_IP with actual IP)
CLIENT_URL=http://YOUR_EC2_IP
API_URL=http://YOUR_EC2_IP:3001
CORS_ORIGIN=http://YOUR_EC2_IP

# Mediasoup (replace YOUR_EC2_IP)
ANNOUNCED_IP=YOUR_EC2_IP
MEDIASOUP_NUM_WORKERS=2
MEDIASOUP_MIN_PORT=10000
MEDIASOUP_MAX_PORT=20000
```

**Generate secure passwords:**
```bash
# Generate passwords (on EC2)
openssl rand -base64 32
openssl rand -base64 32
```

**Get your EC2 IP:**
```bash
curl http://169.254.169.254/latest/meta-data/public-ipv4
```

### Step 6: Deploy!

```bash
# Go back to project root
cd ~/livepanty

# Run the deployment script
./aws/deploy-to-ec2.sh
```

This script will:
- ✅ Build Docker images
- ✅ Start all services (Postgres, Redis, Backend, Frontend)
- ✅ Run database migrations
- ✅ Optionally seed demo data
- ✅ Show you the access URLs

### Step 7: Access Your Application

After deployment completes, access:
- **Frontend**: `http://YOUR_EC2_IP`
- **Backend API**: `http://YOUR_EC2_IP:3001`
- **Health Check**: `http://YOUR_EC2_IP:3001/health`

## Quick Summary

```bash
# On your local machine
1. Launch EC2 (AWS Console or ./aws/launch-ec2-instance.sh)
2. Note the Public IP

# On EC2 instance (SSH into it)
3. git clone https://github.com/your-username/livepanty.git
4. cd livepanty
5. ./aws/setup-ec2-instance.sh
6. cd backend && cp env.example .env && nano .env
7. cd .. && ./aws/deploy-to-ec2.sh

# Done! Access at http://YOUR_EC2_IP
```

## Troubleshooting

### If setup-ec2-instance.sh fails
```bash
# Manual Docker installation
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu
newgrp docker
```

### If deploy-to-ec2.sh fails
```bash
# Check if .env file exists and has correct values
cat backend/.env

# Check Docker
docker --version
docker compose version

# Manual deployment
docker compose -f docker-compose.simple.yml up -d
```

### View logs
```bash
docker compose -f docker-compose.simple.yml logs -f
```

### Check service status
```bash
docker compose -f docker-compose.simple.yml ps
```

## That's It!

Simple, portable, single-server deployment. All services run in Docker containers on one EC2 instance.

