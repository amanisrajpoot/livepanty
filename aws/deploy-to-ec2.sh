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

# Check and install buildx if needed
if ! docker buildx version > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Docker Buildx not found. Installing...${NC}"
    if [ -f "aws/fix-buildx.sh" ]; then
        chmod +x aws/fix-buildx.sh
        ./aws/fix-buildx.sh
    else
        # Manual buildx installation
        mkdir -p ~/.docker/cli-plugins
        BUILDX_VERSION="v0.11.2"
        if [ "$(uname -m)" == "x86_64" ]; then
            ARCH="amd64"
        elif [ "$(uname -m)" == "aarch64" ]; then
            ARCH="arm64"
        else
            ARCH="amd64"
        fi
        curl -L "https://github.com/docker/buildx/releases/download/${BUILDX_VERSION}/buildx-${BUILDX_VERSION}.linux-${ARCH}" \
            -o ~/.docker/cli-plugins/docker-buildx
        chmod +x ~/.docker/cli-plugins/docker-buildx
        docker buildx install || true
        docker buildx create --name mybuilder --use || true
    fi
fi

# Stop existing containers
echo -e "${BLUE}🛑 Stopping existing containers...${NC}"
docker compose -f $COMPOSE_FILE down || true

# Pull latest images (if using remote registry)
echo -e "${BLUE}📥 Pulling latest images (if applicable)...${NC}"
# docker compose -f $COMPOSE_FILE pull || true

# Build images
echo -e "${BLUE}🏗️  Building Docker images...${NC}"

# Check if buildx is available, if not use regular build
if docker buildx version > /dev/null 2>&1; then
    echo -e "${BLUE}Using buildx for building...${NC}"
    docker compose -f $COMPOSE_FILE build
else
    echo -e "${YELLOW}⚠️  Buildx not available, using regular build...${NC}"
    # Use regular docker build instead
    echo -e "${BLUE}Building backend...${NC}"
    docker build -f backend/Dockerfile.prod -t livepanty-backend:latest ./backend
    
    echo -e "${BLUE}Building frontend...${NC}"
    # For frontend, we need to pass build args
    docker build \
        --build-arg REACT_APP_API_URL="${REACT_APP_API_URL:-http://localhost:3001/api}" \
        --build-arg REACT_APP_WS_URL="${REACT_APP_WS_URL:-http://localhost:3001}" \
        -f frontend/Dockerfile.prod \
        -t livepanty-frontend:latest \
        ./frontend
    
    echo -e "${BLUE}Updating docker-compose to use pre-built images...${NC}"
    # Create a temporary compose file that uses pre-built images
    cat > /tmp/docker-compose-temp.yml <<EOF
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    container_name: livepanty-postgres
    environment:
      POSTGRES_DB: livepanty_prod
      POSTGRES_USER: livepanty
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
    env_file:
      - ./backend/.env
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - livepanty-network

  redis:
    image: redis:7-alpine
    container_name: livepanty-redis
    command: redis-server --appendonly yes --requirepass \${REDIS_PASSWORD}
    env_file:
      - ./backend/.env
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped
    networks:
      - livepanty-network

  backend:
    image: livepanty-backend:latest
    container_name: livepanty-backend
    environment:
      NODE_ENV: production
      PORT: 3001
    env_file:
      - ./backend/.env
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - livepanty-network

  frontend:
    image: livepanty-frontend:latest
    container_name: livepanty-frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - livepanty-network

volumes:
  postgres_data:
  redis_data:

networks:
  livepanty-network:
    driver: bridge
EOF
    COMPOSE_FILE="/tmp/docker-compose-temp.yml"
fi

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

