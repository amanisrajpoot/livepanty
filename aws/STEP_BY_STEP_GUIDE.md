# Step-by-Step Deployment Guide

You've cloned the repo. Follow these steps **exactly in order**:

## ✅ Step 1: Navigate to Project Directory

```bash
cd ~/livepanty
```

Verify you're in the right place:
```bash
ls -la
# You should see: backend, frontend, aws, docker-compose.simple.yml, etc.
```

## ✅ Step 2: Run Setup Script (Installs Docker)

```bash
# Make script executable
chmod +x aws/setup-amazon-linux.sh

# Run setup script
./aws/setup-amazon-linux.sh
```

**Wait for this to complete** (takes 2-3 minutes). You should see:
```
✅ Amazon Linux EC2 Instance Setup Complete!
```

## ✅ Step 3: Activate Docker Group (IMPORTANT!)

After setup script completes, run:

```bash
newgrp docker
```

This starts a new shell with Docker permissions. Verify it worked:

```bash
docker ps
# Should show: CONTAINER ID   IMAGE   COMMAND   CREATED   STATUS   PORTS   NAMES
# (or empty list - that's OK, means Docker works!)
```

If `docker ps` fails with permission error, logout and login again:
```bash
exit  # Logout
# Then SSH back in and run: docker ps
```

## ✅ Step 4: Get Your EC2 Public IP

```bash
curl http://169.254.169.254/latest/meta-data/public-ipv4
```

**Copy this IP address** - you'll need it for the next step!

Example output: `54.123.45.67`

## ✅ Step 5: Configure Environment File

```bash
# Go to backend directory
cd backend

# Copy example file
cp env.example .env

# Edit the file
nano .env
```

### In Nano Editor:

**Press the arrow keys** to navigate to each line and edit:

**Find and update these lines** (replace `YOUR_EC2_IP` with the IP from Step 4):

1. **POSTGRES_PASSWORD**: 
   - First, generate a password (in a new terminal or after saving):
     ```bash
     openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
     ```
   - Copy the output and paste as `POSTGRES_PASSWORD` value

2. **REDIS_PASSWORD**: 
   - Generate another:
     ```bash
     openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
     ```

3. **JWT_SECRET**: 
   - Generate:
     ```bash
     openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
     ```

4. **JWT_REFRESH_SECRET**: 
   - Generate:
     ```bash
     openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
     ```

5. **DATABASE_URL**: 
   - Should be: `postgresql://livepanty:YOUR_POSTGRES_PASSWORD@postgres:5432/livepanty_prod`
   - Replace `YOUR_POSTGRES_PASSWORD` with the password from step 1

6. **REDIS_URL**: 
   - Should be: `redis://:YOUR_REDIS_PASSWORD@redis:6379`
   - Replace `YOUR_REDIS_PASSWORD` with the password from step 2

7. **CLIENT_URL**: 
   - Change to: `http://YOUR_EC2_IP` (use IP from Step 4)

8. **API_URL**: 
   - Change to: `http://YOUR_EC2_IP:3001`

9. **CORS_ORIGIN**: 
   - Change to: `http://YOUR_EC2_IP`

10. **ANNOUNCED_IP**: 
    - Change to: `YOUR_EC2_IP`

**To save in Nano:**
- Press `Ctrl + X` (exit)
- Press `Y` (yes, save)
- Press `Enter` (confirm filename)

### Quick Method (Generate all passwords first):

Open a new terminal/SSH session, run:

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)"
echo "REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)"
echo "JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)"
```

Copy all 4 values, then edit `.env` file and paste them.

## ✅ Step 6: Verify .env File

```bash
# Check your .env file has the values
cat .env | grep -E "(POSTGRES_PASSWORD|REDIS_PASSWORD|JWT_SECRET|CLIENT_URL|ANNOUNCED_IP)"
```

You should see your values (not empty or example values).

## ✅ Step 7: Go Back to Project Root

```bash
cd ~/livepanty
```

## ✅ Step 8: Make Deployment Script Executable

```bash
chmod +x aws/deploy-to-ec2.sh
```

## ✅ Step 9: Run Deployment Script

```bash
./aws/deploy-to-ec2.sh
```

**What happens:**
- Builds Docker images (takes 3-5 minutes first time)
- Starts all services
- Waits for database to be ready
- Runs database migrations
- Asks if you want to seed demo data (type `y` for yes, `n` for no)
- Shows you access URLs

## ✅ Step 10: Wait for Deployment

The script will show progress. Wait for:

```
✅ Deployment Complete!

Application URLs:
  Frontend: http://YOUR_EC2_IP
  Backend API: http://YOUR_EC2_IP:3001
```

## ✅ Step 11: Access Your Application

Open in your browser:
- **Frontend**: `http://YOUR_EC2_IP`
- **Backend Health**: `http://YOUR_EC2_IP:3001/health`

## Quick Command Reference

```bash
# View logs
docker compose -f docker-compose.simple.yml logs -f

# Check status
docker compose -f docker-compose.simple.yml ps

# Restart everything
docker compose -f docker-compose.simple.yml restart

# Stop everything
docker compose -f docker-compose.simple.yml down

# Start everything
docker compose -f docker-compose.simple.yml up -d
```

## Common Issues

### Issue: Permission denied when running scripts
**Fix:**
```bash
chmod +x aws/setup-amazon-linux.sh
chmod +x aws/deploy-to-ec2.sh
```

### Issue: Docker permission denied
**Fix:**
```bash
newgrp docker
# OR logout and login again
```

### Issue: .env file not found
**Fix:**
```bash
cd backend
cp env.example .env
nano .env
```

### Issue: Services won't start
**Check logs:**
```bash
docker compose -f docker-compose.simple.yml logs
```

### Issue: Can't access application
1. Check security group allows ports 80, 443, 3001
2. Check services are running: `docker compose -f docker-compose.simple.yml ps`

## That's It!

Follow these steps in order and your application will be deployed! 🚀

