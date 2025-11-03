#!/bin/bash

# Deploy script to run on EC2 instance
# Sets up and starts all services using Docker Compose

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Deploying LivePanty on EC2${NC}"
echo "================================"
echo ""

# Check if running from correct directory
if [ ! -f "docker-compose.simple.yml" ] && [ ! -f "docker-compose.prod.yml" ]; then
    echo -e "${RED}❌ docker-compose file not found. Are you in the project root?${NC}"
    exit 1
fi

# Use simple compose file if available, otherwise use prod
COMPOSE_FILE="docker-compose.simple.yml"
if [ ! -f "$COMPOSE_FILE" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
fi
echo "Using: $COMPOSE_FILE"

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚠️  backend/.env not found. Creating from example...${NC}"
    if [ -f "backend/env.example" ]; then
        cp backend/env.example backend/.env
        echo -e "${YELLOW}⚠️  Please edit backend/.env with your production values!${NC}"
        echo "Press Enter to continue after editing..."
        read
    else
        echo -e "${RED}❌ backend/env.example not found. Please create backend/.env manually.${NC}"
        exit 1
    fi
fi

# Get EC2 public IP
EC2_PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 || echo "localhost")

echo -e "${BLUE}📋 Configuration${NC}"
echo "EC2 Public IP: ${EC2_PUBLIC_IP}"
echo ""

# Update .env with EC2 IP if not set
if ! grep -q "ANNOUNCED_IP=" backend/.env || grep -q "ANNOUNCED_IP=$" backend/.env; then
    echo -e "${BLUE}📝 Updating ANNOUNCED_IP in backend/.env...${NC}"
    sed -i "s|ANNOUNCED_IP=.*|ANNOUNCED_IP=${EC2_PUBLIC_IP}|g" backend/.env || \
    echo "ANNOUNCED_IP=${EC2_PUBLIC_IP}" >> backend/.env
fi

# Update CLIENT_URL and API_URL if not set
if ! grep -q "CLIENT_URL=http" backend/.env; then
    sed -i "s|CLIENT_URL=.*|CLIENT_URL=http://${EC2_PUBLIC_IP}|g" backend/.env || \
    echo "CLIENT_URL=http://${EC2_PUBLIC_IP}" >> backend/.env
fi

if ! grep -q "API_URL=http" backend/.env; then
    sed -i "s|API_URL=.*|API_URL=http://${EC2_PUBLIC_IP}:3001|g" backend/.env || \
    echo "API_URL=http://${EC2_PUBLIC_IP}:3001" >> backend/.env
fi

if ! grep -q "CORS_ORIGIN=http" backend/.env; then
    sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=http://${EC2_PUBLIC_IP}|g" backend/.env || \
    echo "CORS_ORIGIN=http://${EC2_PUBLIC_IP}" >> backend/.env
fi

# Update frontend environment
echo -e "${BLUE}📝 Configuring frontend...${NC}"
mkdir -p frontend
cat > frontend/.env.production <<EOF
REACT_APP_API_URL=http://${EC2_PUBLIC_IP}:3001/api
REACT_APP_WS_URL=http://${EC2_PUBLIC_IP}:3001
EOF

# Generate secrets if not set
if ! grep -q "JWT_SECRET=.*[^=]$" backend/.env || grep -q "JWT_SECRET=$" backend/.env; then
    echo -e "${BLUE}🔑 Generating JWT secrets...${NC}"
    JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    JWT_REFRESH_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|g" backend/.env
    sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}|g" backend/.env
    echo -e "${GREEN}✓${NC} JWT secrets generated"
fi

# Check Docker Compose
if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose not found. Please install it first.${NC}"
    exit 1
fi

# Stop existing containers
echo -e "${BLUE}🛑 Stopping existing containers...${NC}"
docker compose -f $COMPOSE_FILE down || true

# Pull latest images (if using remote registry)
echo -e "${BLUE}📥 Pulling latest images (if applicable)...${NC}"
# docker compose -f $COMPOSE_FILE pull || true

# Build images
echo -e "${BLUE}🏗️  Building Docker images...${NC}"
docker compose -f $COMPOSE_FILE build

# Start services
echo -e "${BLUE}🚀 Starting services...${NC}"
docker compose -f $COMPOSE_FILE up -d

# Wait for services to be healthy
echo -e "${BLUE}⏳ Waiting for services to start...${NC}"
sleep 10

# Check service status
echo -e "${BLUE}📊 Service Status:${NC}"
docker compose -f $COMPOSE_FILE ps

# Wait for database to be ready
echo -e "${BLUE}⏳ Waiting for database to be ready...${NC}"
for i in {1..30}; do
    if docker compose -f $COMPOSE_FILE exec -T postgres pg_isready -U livepanty > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Database is ready"
        break
    fi
    echo "Waiting for database... ($i/30)"
    sleep 2
done

# Run database migrations
echo -e "${BLUE}📦 Running database migrations...${NC}"
if [ -f "database/schema.sql" ]; then
    docker compose -f $COMPOSE_FILE exec -T postgres psql -U livepanty -d livepanty_prod < database/schema.sql || echo -e "${YELLOW}⚠️  Schema may already exist${NC}"
fi

# Seed database (optional)
read -p "Do you want to seed the database with demo data? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🌱 Seeding database...${NC}"
    docker compose -f $COMPOSE_FILE exec -T backend node scripts/seed-comprehensive.js || echo -e "${YELLOW}⚠️  Seeding failed or already done${NC}"
fi

# Show logs
echo ""
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo ""
echo "Application URLs:"
echo "  Frontend: http://${EC2_PUBLIC_IP}"
echo "  Backend API: http://${EC2_PUBLIC_IP}:3001"
echo ""
echo "Useful commands:"
echo "  View logs: docker compose -f $COMPOSE_FILE logs -f"
echo "  Stop services: docker compose -f $COMPOSE_FILE down"
echo "  Restart services: docker compose -f $COMPOSE_FILE restart"
echo "  Check status: docker compose -f $COMPOSE_FILE ps"
echo ""

# Test endpoints
echo -e "${BLUE}🧪 Testing endpoints...${NC}"
sleep 5
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Backend health check passed"
else
    echo -e "${YELLOW}⚠️  Backend health check failed (may need more time)${NC}"
fi

if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Frontend is accessible"
else
    echo -e "${YELLOW}⚠️  Frontend check failed (may need more time)${NC}"
fi

echo ""
echo -e "${GREEN}🎉 All done! Your application should be running now.${NC}"
echo ""

