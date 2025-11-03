# How to Run Deployment Scripts

Complete step-by-step guide for deploying on Amazon Linux EC2.

## Prerequisites

- ✅ EC2 instance is running
- ✅ Security group allows ports: 22, 80, 443, 3001
- ✅ You have SSH access

## Step-by-Step Instructions

### Step 1: SSH Into EC2 Instance

On your local machine:

```bash
# Make key file executable
chmod 400 your-key.pem

# SSH into EC2
ssh -i your-key.pem ec2-user@YOUR_EC2_PUBLIC_IP
```

### Step 2: Clone Repository

On EC2 instance:

```bash
git clone https://github.com/amanisrajpoot/livepanty.git
cd livepanty
```

### Step 3: Run Setup Script

This installs Docker, Docker Compose, and all essential tools:

```bash
# Make script executable
chmod +x aws/setup-amazon-linux.sh

# Run setup script
./aws/setup-amazon-linux.sh
```

**After script completes:**
```bash
# Activate Docker group (IMPORTANT!)
newgrp docker

# Verify Docker works
docker ps
```

### Step 4: Configure Environment

```bash
# Go to backend directory
cd backend

# Copy environment example file
cp env.example .env

# Edit the .env file
nano .env
```

**In nano editor:**
1. Press arrow keys to navigate
2. Edit the values (see minimum config below)
3. Press `Ctrl+X` to exit
4. Press `Y` to save
5. Press `Enter` to confirm

**Minimum Required Configuration in `.env`:**

```bash
NODE_ENV=production
PORT=3001

# Generate secure passwords first:
# openssl rand -base64 32
# openssl rand -base64 32

POSTGRES_PASSWORD=your-secure-password-here
DATABASE_URL=postgresql://livepanty:your-secure-password-here@postgres:5432/livepanty_prod

REDIS_PASSWORD=your-secure-redis-password-here
REDIS_URL=redis://:your-secure-redis-password-here@redis:6379

# Generate JWT secrets:
# openssl rand -base64 32
# openssl rand -base64 32

JWT_SECRET=your-jwt-secret-here
JWT_REFRESH_SECRET=your-jwt-refresh-secret-here

# Get your EC2 IP first:
# curl http://169.254.169.254/latest/meta-data/public-ipv4

CLIENT_URL=http://YOUR_EC2_IP
API_URL=http://YOUR_EC2_IP:3001
CORS_ORIGIN=http://YOUR_EC2_IP

ANNOUNCED_IP=YOUR_EC2_IP
MEDIASOUP_NUM_WORKERS=2
MEDIASOUP_MIN_PORT=10000
MEDIASOUP_MAX_PORT=20000
```

**Quick way to get EC2 IP and generate passwords:**

```bash
# Get EC2 public IP
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo "Your EC2 IP: $EC2_IP"

# Generate passwords
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)"
echo "REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)"
echo "JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)"
```

Copy the generated values into your `.env` file.

### Step 5: Run Deployment Script

```bash
# Go back to project root
cd ~/livepanty

# Make deployment script executable
chmod +x aws/deploy-to-ec2.sh

# Run deployment script
./aws/deploy-to-ec2.sh
```

**What the deployment script does:**
1. ✅ Checks for Docker Compose file
2. ✅ Validates `.env` file exists
3. ✅ Auto-detects EC2 public IP
4. ✅ Updates environment variables with your IP
5. ✅ Builds Docker images
6. ✅ Starts all services (Postgres, Redis, Backend, Frontend)
7. ✅ Waits for database to be ready
8. ✅ Runs database migrations
9. ✅ Optionally seeds demo data
10. ✅ Shows you access URLs

### Step 6: Wait for Deployment

The script will show progress. Wait for:
```
✅ Deployment Complete!
```

This usually takes 2-5 minutes.

### Step 7: Access Your Application

After deployment completes, you'll see:

```
Application URLs:
  Frontend: http://YOUR_EC2_IP
  Backend API: http://YOUR_EC2_IP:3001
```

Open in your browser:
- **Frontend**: `http://YOUR_EC2_IP`
- **Backend Health**: `http://YOUR_EC2_IP:3001/health`

## Common Commands After Deployment

### View Logs

```bash
# All services
docker compose -f docker-compose.simple.yml logs -f

# Specific service
docker compose -f docker-compose.simple.yml logs -f backend
docker compose -f docker-compose.simple.yml logs -f frontend
docker compose -f docker-compose.simple.yml logs -f postgres
```

### Check Service Status

```bash
docker compose -f docker-compose.simple.yml ps
```

### Restart Services

```bash
# Restart all
docker compose -f docker-compose.simple.yml restart

# Restart specific service
docker compose -f docker-compose.simple.yml restart backend
```

### Stop Services

```bash
docker compose -f docker-compose.simple.yml down
```

### Start Services

```bash
docker compose -f docker-compose.simple.yml up -d
```

## Troubleshooting

### Script Permission Denied

```bash
chmod +x aws/setup-amazon-linux.sh
chmod +x aws/deploy-to-ec2.sh
```

### Docker Permission Denied

```bash
sudo usermod -aG docker ec2-user
newgrp docker
# OR logout and login again
```

### .env File Missing

```bash
cd backend
cp env.example .env
nano .env
```

### Services Won't Start

```bash
# Check logs
docker compose -f docker-compose.simple.yml logs

# Check Docker
docker ps -a

# Restart Docker
sudo systemctl restart docker
```

### Can't Access Application

1. Check security group in AWS Console allows ports 80, 443, 3001
2. Check if services are running: `docker compose -f docker-compose.simple.yml ps`
3. Check logs: `docker compose -f docker-compose.simple.yml logs`

### Database Connection Error

```bash
# Check if postgres container is running
docker compose -f docker-compose.simple.yml ps postgres

# Check postgres logs
docker compose -f docker-compose.simple.yml logs postgres

# Verify DATABASE_URL in .env matches the docker-compose settings
```

## Quick Reference

```bash
# Complete deployment flow
git clone https://github.com/amanisrajpoot/livepanty.git
cd livepanty
chmod +x aws/setup-amazon-linux.sh
./aws/setup-amazon-linux.sh
newgrp docker
cd backend && cp env.example .env && nano .env
cd ~/livepanty
chmod +x aws/deploy-to-ec2.sh
./aws/deploy-to-ec2.sh
```

That's it! Your application will be running in a few minutes.

