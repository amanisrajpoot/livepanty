#!/bin/bash

# Setup script for Amazon Linux EC2 instance
# Installs Docker, Docker Compose, Git, and other essential tools

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Setting up Amazon Linux EC2 Instance for LivePanty${NC}"
echo "======================================================"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${YELLOW}⚠️  Running as root. Some commands may need sudo.${NC}"
   SUDO=""
else
   SUDO="sudo"
fi

# Detect Amazon Linux version
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    OS_VERSION=$VERSION_ID
else
    OS="amzn"
    OS_VERSION="2"
fi

echo -e "${BLUE}📋 Detected: ${OS} ${OS_VERSION}${NC}"
echo ""

# Update system
echo -e "${BLUE}📦 Updating system packages...${NC}"
$SUDO yum update -y

# Install essential tools
echo -e "${BLUE}📦 Installing essential tools...${NC}"
$SUDO yum install -y \
    git \
    curl \
    wget \
    unzip \
    htop \
    nano \
    openssl \
    gcc \
    gcc-c++ \
    make

# Install Docker
echo -e "${BLUE}🐳 Installing Docker...${NC}"

# Remove old versions if any
$SUDO yum remove -y docker docker-client docker-client-latest docker-common \
    docker-latest docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true

# Install Docker repository
if [ "$OS_VERSION" == "2" ]; then
    # Amazon Linux 2
    $SUDO yum install -y docker
else
    # Amazon Linux 2023
    $SUDO yum install -y docker
fi

# Start and enable Docker
echo -e "${BLUE}🐳 Starting Docker service...${NC}"
$SUDO systemctl start docker
$SUDO systemctl enable docker

# Add user to docker group (if not root)
if [ "$EUID" -ne 0 ]; then
    echo -e "${BLUE}👤 Adding user to docker group...${NC}"
    $SUDO usermod -aG docker $USER
    echo -e "${YELLOW}⚠️  You may need to logout and login again for docker group to take effect.${NC}"
    echo -e "${YELLOW}⚠️  Or run: newgrp docker${NC}"
fi

# Install Docker Compose V2
echo -e "${BLUE}📦 Installing Docker Compose...${NC}"

# Check if docker compose plugin is available
if $SUDO yum list available docker-compose-plugin 2>/dev/null | grep -q docker-compose-plugin; then
    $SUDO yum install -y docker-compose-plugin
else
    # Install Docker Compose standalone (fallback)
    DOCKER_COMPOSE_VERSION="v2.21.0"
    echo -e "${BLUE}📥 Downloading Docker Compose ${DOCKER_COMPOSE_VERSION}...${NC}"
    
    if [ "$(uname -m)" == "x86_64" ]; then
        ARCH="x86_64"
    elif [ "$(uname -m)" == "aarch64" ]; then
        ARCH="aarch64"
    else
        ARCH="x86_64"
    fi
    
    $SUDO curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-linux-${ARCH}" \
        -o /usr/local/bin/docker-compose
    $SUDO chmod +x /usr/local/bin/docker-compose
    
    # Create symlink for docker compose command
    $SUDO ln -sf /usr/local/bin/docker-compose /usr/local/bin/docker compose || true
fi

# Verify Docker installation
echo -e "${BLUE}✅ Verifying Docker installation...${NC}"
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo -e "${GREEN}✓${NC} Docker installed: ${DOCKER_VERSION}"
else
    echo -e "${RED}❌ Docker installation failed${NC}"
    exit 1
fi

# Verify Docker Compose
echo -e "${BLUE}✅ Verifying Docker Compose...${NC}"
if command -v docker compose &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version)
    echo -e "${GREEN}✓${NC} Docker Compose installed: ${COMPOSE_VERSION}"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    echo -e "${GREEN}✓${NC} Docker Compose installed: ${COMPOSE_VERSION}"
else
    echo -e "${RED}❌ Docker Compose installation failed${NC}"
    exit 1
fi

# Configure firewall (if firewalld is installed)
if command -v firewall-cmd &> /dev/null; then
    echo -e "${BLUE}🔥 Configuring firewall...${NC}"
    $SUDO systemctl start firewalld 2>/dev/null || true
    $SUDO systemctl enable firewalld 2>/dev/null || true
    $SUDO firewall-cmd --permanent --add-port=22/tcp 2>/dev/null || true
    $SUDO firewall-cmd --permanent --add-port=80/tcp 2>/dev/null || true
    $SUDO firewall-cmd --permanent --add-port=443/tcp 2>/dev/null || true
    $SUDO firewall-cmd --permanent --add-port=3001/tcp 2>/dev/null || true
    $SUDO firewall-cmd --reload 2>/dev/null || true
fi

# Create application directory
echo -e "${BLUE}📁 Creating application directory...${NC}"
mkdir -p ~/livepanty
mkdir -p ~/backups

# Install Node.js (for running seed scripts, etc.)
echo -e "${BLUE}📦 Installing Node.js (for scripts)...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js already installed: ${NODE_VERSION}"
else
    # Install Node.js 18
    curl -fsSL https://rpm.nodesource.com/setup_18.x | $SUDO bash -
    $SUDO yum install -y nodejs
    echo -e "${GREEN}✓${NC} Node.js installed: $(node --version)"
fi

# Install PostgreSQL client (optional, for database access)
echo -e "${BLUE}📦 Installing PostgreSQL client tools...${NC}"
$SUDO yum install -y postgresql 2>/dev/null || echo -e "${YELLOW}⚠️  PostgreSQL client not available via yum${NC}"

echo ""
echo -e "${GREEN}✅ Amazon Linux EC2 Instance Setup Complete!${NC}"
echo ""
echo "Installed:"
echo "  ✓ Docker"
echo "  ✓ Docker Compose"
echo "  ✓ Git"
echo "  ✓ Node.js"
echo "  ✓ Essential tools"
echo ""
echo "Next steps:"
echo "  1. Clone repository: git clone https://github.com/amanisrajpoot/livepanty.git"
echo "  2. Configure environment: cd livepanty/backend && cp env.example .env && nano .env"
echo "  3. Deploy: cd ~/livepanty && ./aws/deploy-to-ec2.sh"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
if [ "$EUID" -ne 0 ]; then
    echo "  - You may need to logout/login or run 'newgrp docker' for Docker to work"
    echo "  - Test Docker: docker ps"
fi
echo "  - Make sure security group allows ports 22, 80, 443, 3001"
echo ""

