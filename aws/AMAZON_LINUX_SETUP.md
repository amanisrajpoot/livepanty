# Amazon Linux EC2 Setup Guide

## Quick Setup (3 Steps)

### Step 1: SSH Into Your EC2 Instance

```bash
# On your local machine
ssh -i your-key.pem ec2-user@YOUR_EC2_PUBLIC_IP
```

**Note**: Amazon Linux uses `ec2-user` as the default user (not `ubuntu`)

### Step 2: Clone Repository

```bash
git clone https://github.com/amanisrajpoot/livepanty.git
cd livepanty
```

### Step 3: Run Setup Script

```bash
chmod +x aws/setup-amazon-linux.sh
./aws/setup-amazon-linux.sh
```

This will install:
- ✅ Docker
- ✅ Docker Compose
- ✅ Git
- ✅ Node.js
- ✅ Essential tools

**Note**: After the script runs, you may need to:
```bash
newgrp docker  # This starts a new shell with docker group
# OR logout and login again
```

### Step 4: Verify Installation

```bash
# Check Docker
docker --version
docker ps

# Check Docker Compose
docker compose version

# Check Git
git --version

# Check Node.js
node --version
npm --version
```

### Step 5: Configure and Deploy

```bash
# Configure environment
cd backend
cp env.example .env
nano .env  # Edit with your values

# Get your EC2 public IP
curl http://169.254.169.254/latest/meta-data/public-ipv4

# Deploy
cd ~/livepanty
./aws/deploy-to-ec2.sh
```

## Manual Installation (if script fails)

### Install Docker

```bash
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user
newgrp docker  # Or logout/login
```

### Install Docker Compose

```bash
# Amazon Linux 2
sudo yum install -y docker-compose-plugin

# OR download manually
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
    -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Install Other Tools

```bash
sudo yum install -y git curl wget nano openssl
sudo yum install -y gcc gcc-c++ make
```

### Install Node.js

```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

## Troubleshooting

### Docker Permission Denied

```bash
sudo usermod -aG docker ec2-user
newgrp docker
# OR
sudo chmod 666 /var/run/docker.sock  # Temporary fix
```

### Docker Compose Not Found

```bash
# Check if installed
which docker-compose
docker compose version

# If not found, install plugin
sudo yum install -y docker-compose-plugin
```

### Ports Not Accessible

Check security group in AWS Console:
- Port 22 (SSH)
- Port 80 (HTTP)
- Port 443 (HTTPS)
- Port 3001 (Backend API)

## Differences from Ubuntu

| Ubuntu | Amazon Linux |
|--------|-------------|
| `apt-get` | `yum` |
| `ubuntu` user | `ec2-user` user |
| `ufw` firewall | `firewalld` or security groups |
| `docker.io` package | `docker` package |

## That's It!

After setup, you can proceed with deployment using `./aws/deploy-to-ec2.sh`

