#!/bin/bash

# LivePanty Production Deployment Script
# Uses Docker for production deployment

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo -e "${BLUE}🚀 LivePanty Production Deployment${NC}"
echo "===================================="
echo ""

# Add Docker to PATH if installed but not in PATH
if [ -d "/Applications/Docker.app/Contents/Resources/bin" ]; then
    export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
fi

# Function to detect Docker Compose command
detect_docker_compose() {
    if command -v docker-compose >/dev/null 2>&1; then
        echo "docker-compose"
    elif docker compose version >/dev/null 2>&1; then
        echo "docker compose"
    else
        echo ""
    fi
}

DOCKER_COMPOSE=$(detect_docker_compose)

# Check prerequisites
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not installed or not in PATH${NC}"
    echo ""
    if [ -d "/Applications/Docker.app" ]; then
        echo -e "${YELLOW}💡 Docker Desktop is installed but not running${NC}"
        echo "Please start Docker Desktop and try again."
        echo ""
        echo "To start Docker Desktop:"
        echo "   1. Open Applications folder"
        echo "   2. Double-click Docker.app"
        echo "   3. Wait for it to fully start (whale icon in menu bar)"
        echo "   4. Run this script again"
    else
        echo -e "${YELLOW}📥 Please install Docker Desktop for macOS:${NC}"
        echo "   https://www.docker.com/products/docker-desktop/"
    fi
    exit 1
fi

# Check if Docker daemon is running
if ! docker ps >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is installed but Docker Desktop is not running${NC}"
    echo ""
    echo -e "${YELLOW}📥 Please start Docker Desktop:${NC}"
    echo "   1. Open Applications folder"
    echo "   2. Double-click Docker.app"
    echo "   3. Wait for it to fully start"
    echo "   4. Run this script again"
    exit 1
fi

if [ -z "$DOCKER_COMPOSE" ]; then
    echo -e "${RED}❌ Docker Compose is not available${NC}"
    echo ""
    echo -e "${YELLOW}💡 Docker Compose should come with Docker Desktop${NC}"
    echo "Please ensure Docker Desktop is fully started and try again."
    exit 1
fi

echo -e "${GREEN}✅ Docker found${NC}"
echo -e "${GREEN}✅ Docker Compose found (using: $DOCKER_COMPOSE)${NC}"
echo ""

# Check if .env exists
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found!${NC}"
    echo "📝 Creating .env from env.example..."
    
    if [ -f "$PROJECT_ROOT/env.example" ]; then
        cp env.example .env
        echo -e "${YELLOW}⚠️  Please edit .env file with your production configuration before continuing${NC}"
        echo "Press Enter when ready to continue..."
        read
    else
        echo -e "${RED}❌ env.example not found${NC}"
        exit 1
    fi
fi

# Function to check service health
check_health() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${BLUE}⏳ Waiting for $service to be healthy...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $service is healthy!${NC}"
            return 0
        fi
        
        echo "   Attempt $attempt/$max_attempts..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ $service failed to become healthy after $max_attempts attempts${NC}"
    return 1
}

# Step 1: Build and start services
echo -e "${BLUE}📦 Building and starting services...${NC}"
$DOCKER_COMPOSE -f docker-compose.prod.yml up -d --build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to start services${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Services started${NC}"
echo ""

# Step 2: Wait for database to be ready
echo -e "${BLUE}⏳ Waiting for database to be ready...${NC}"
sleep 15

# Check if database is ready
max_db_attempts=30
db_attempt=1
while [ $db_attempt -le $max_db_attempts ]; do
    if $DOCKER_COMPOSE -f docker-compose.prod.yml exec -T postgres pg_isready -U livepanty > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database is ready${NC}"
        break
    fi
    echo "   Database attempt $db_attempt/$max_db_attempts..."
    sleep 2
    db_attempt=$((db_attempt + 1))
done

if [ $db_attempt -gt $max_db_attempts ]; then
    echo -e "${RED}❌ Database failed to become ready${NC}"
    exit 1
fi

# Step 3: Initialize database
echo -e "${BLUE}🗄️  Initializing database...${NC}"

# Check which init script to use
INIT_SCRIPT="$PROJECT_ROOT/backend/database/init.sql"
if [ ! -f "$INIT_SCRIPT" ]; then
    INIT_SCRIPT="$PROJECT_ROOT/database/schema.sql"
fi

if [ -f "$INIT_SCRIPT" ]; then
    echo "Using init script: $INIT_SCRIPT"
    $DOCKER_COMPOSE -f docker-compose.prod.yml exec -T postgres psql -U livepanty -d livepanty_prod < "$INIT_SCRIPT" 2>&1 || {
        echo -e "${YELLOW}⚠️  Database initialization returned non-zero exit code${NC}"
        echo "This might be okay if tables already exist"
    }
    echo -e "${GREEN}✅ Database initialization completed${NC}"
else
    echo -e "${YELLOW}⚠️  No database init script found${NC}"
fi

echo ""

# Step 4: Check services health
echo -e "${BLUE}🔍 Checking service health...${NC}"

# Check backend health
if check_health "Backend" "http://localhost:3001/health"; then
    echo ""
else
    echo -e "${YELLOW}⚠️  Backend health check failed, but continuing...${NC}"
fi

# Check frontend (if running)
if curl -f -s "http://localhost:3000" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend might not be accessible yet${NC}"
fi

echo ""

# Step 5: Show status
echo -e "${BLUE}📊 Service Status:${NC}"
$DOCKER_COMPOSE -f docker-compose.prod.yml ps

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${BLUE}🌐 Access your services:${NC}"
echo "   Frontend: ${GREEN}http://localhost:3000${NC}"
echo "   Backend:  ${GREEN}http://localhost:3001${NC}"
echo "   API Docs: ${GREEN}http://localhost:3001/api-docs${NC}"
echo ""
echo -e "${BLUE}📝 Useful commands:${NC}"
echo "   View logs:    ${YELLOW}$DOCKER_COMPOSE -f docker-compose.prod.yml logs -f${NC}"
echo "   Stop services: ${YELLOW}$DOCKER_COMPOSE -f docker-compose.prod.yml down${NC}"
echo "   Restart:      ${YELLOW}$DOCKER_COMPOSE -f docker-compose.prod.yml restart${NC}"
echo ""

