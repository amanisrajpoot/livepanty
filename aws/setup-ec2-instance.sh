#!/bin/bash

# Setup script to run on EC2 instance
# Installs Docker, Docker Compose, and prepares environment

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Setting up EC2 Instance for LivePanty${NC}"
echo "=============================================="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}❌ Please don't run as root. Run as ubuntu user.${NC}"
   exit 1
fi

# Update system
echo -e "${BLUE}📦 Updating system packages...${NC}"
sudo apt-get update
sudo apt-get upgrade -y

# Install required packages
echo -e "${BLUE}📦 Installing required packages...${NC}"
sudo apt-get install -y \
    docker.io \
    docker-compose-plugin \
    git \
    curl \
    wget \
    unzip \
    htop \
    ufw \
    fail2ban

# Start and enable Docker
echo -e "${BLUE}🐳 Configuring Docker...${NC}"
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose V2 (if not already installed)
if ! command -v docker compose &> /dev/null; then
    echo -e "${BLUE}📦 Installing Docker Compose...${NC}"
    sudo apt-get install -y docker-compose-plugin
fi

# Configure firewall
echo -e "${BLUE}🔥 Configuring firewall...${NC}"
sudo ufw --force enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3001/tcp

# Configure fail2ban for SSH protection
echo -e "${BLUE}🔒 Configuring fail2ban...${NC}"
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Create application directory
echo -e "${BLUE}📁 Creating application directory...${NC}"
mkdir -p ~/livepanty
mkdir -p ~/backups
cd ~/livepanty

# Clone repository (or update if exists)
if [ -d ".git" ]; then
    echo -e "${BLUE}📥 Updating repository...${NC}"
    git pull origin main
else
    echo -e "${BLUE}📥 Cloning repository...${NC}"
    echo -e "${YELLOW}⚠️  You'll need to clone your repository:${NC}"
    echo "git clone https://github.com/your-username/livepanty.git ~/livepanty"
fi

echo ""
echo -e "${GREEN}✅ EC2 Instance Setup Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Clone your repository: git clone <your-repo-url> ~/livepanty"
echo "2. Configure environment: cd ~/livepanty/backend && cp env.example .env && nano .env"
echo "3. Deploy: cd ~/livepanty && ./aws/deploy-to-ec2.sh"
echo ""
echo "Note: You may need to logout and login again for Docker group changes to take effect."
echo "Or run: newgrp docker"
echo ""

