#!/bin/bash

# LivePanty Health Check Script
# Checks the health of all services

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

# Add Docker to PATH if installed but not in PATH
if [ -d "/Applications/Docker.app/Contents/Resources/bin" ]; then
    export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
fi

echo -e "${BLUE}🔍 LivePanty Health Check${NC}"
echo "========================"
echo ""

# Check service health
check_service() {
    local name=$1
    local url=$2
    
    if curl -f -s "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name: OK${NC}"
        return 0
    else
        echo -e "${RED}❌ $name: FAILED${NC}"
        return 1
    fi
}

# Track overall health
HEALTH_OK=true

# Check Frontend
echo -e "${BLUE}Checking Frontend...${NC}"
if check_service "Frontend" "http://localhost:3000"; then
    :
else
    HEALTH_OK=false
fi
echo ""

# Check Backend
echo -e "${BLUE}Checking Backend...${NC}"
if check_service "Backend Health" "http://localhost:3001/health"; then
    # Get health details
    HEALTH_DATA=$(curl -s http://localhost:3001/health 2>/dev/null)
    if [ -n "$HEALTH_DATA" ]; then
        echo "   Status: $(echo $HEALTH_DATA | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo 'unknown')"
    fi
else
    HEALTH_OK=false
fi
echo ""

# Check API Docs
echo -e "${BLUE}Checking API Documentation...${NC}"
if check_service "API Docs" "http://localhost:3001/api-docs"; then
    :
else
    HEALTH_OK=false
fi
echo ""

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

# Check Docker services (for production deployment)
echo -e "${BLUE}🐳 Docker Services (Production):${NC}"
if [ -n "$DOCKER_COMPOSE" ]; then
    if [ -f "docker-compose.prod.yml" ]; then
        if $DOCKER_COMPOSE -f docker-compose.prod.yml ps 2>/dev/null; then
            echo -e "${GREEN}✅ Production services running${NC}"
        else
            echo -e "${YELLOW}⚠️  Production services not running (normal for development)${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  docker-compose.prod.yml not found${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Docker Compose not available (normal for development)${NC}"
fi
echo ""

# Check Database connection (only check production Docker DB, dev uses cloud DB)
echo -e "${BLUE}🗄️  Database Connection:${NC}"
if [ -n "$DOCKER_COMPOSE" ] && [ -f "docker-compose.prod.yml" ]; then
    # Only check if production Docker services are running
    if $DOCKER_COMPOSE -f docker-compose.prod.yml ps postgres 2>/dev/null | grep -q "Up"; then
        if $DOCKER_COMPOSE -f docker-compose.prod.yml exec -T postgres pg_isready -U livepanty > /dev/null 2>&1; then
            echo -e "${GREEN}✅ PostgreSQL (Docker): OK${NC}"
        else
            echo -e "${RED}❌ PostgreSQL (Docker): FAILED${NC}"
            HEALTH_OK=false
        fi
    else
        echo -e "${YELLOW}⚠️  Production Docker database not running (normal for development)${NC}"
        echo -e "${BLUE}💡 Development uses cloud database (Neon DB)${NC}"
    fi
else
    echo -e "${BLUE}💡 Development mode: Using cloud database (Neon DB)${NC}"
    echo -e "${BLUE}💡 No Docker database check needed${NC}"
fi
echo ""

# Check Redis connection (only check production Docker Redis, dev uses mock Redis)
echo -e "${BLUE}📦 Redis Connection:${NC}"
if [ -n "$DOCKER_COMPOSE" ] && [ -f "docker-compose.prod.yml" ]; then
    # Only check if production Docker services are running
    if $DOCKER_COMPOSE -f docker-compose.prod.yml ps redis 2>/dev/null | grep -q "Up"; then
        if $DOCKER_COMPOSE -f docker-compose.prod.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Redis (Docker): OK${NC}"
        else
            echo -e "${RED}❌ Redis (Docker): FAILED${NC}"
            HEALTH_OK=false
        fi
    else
        echo -e "${YELLOW}⚠️  Production Docker Redis not running (normal for development)${NC}"
        echo -e "${BLUE}💡 Development uses mock Redis (no Redis needed)${NC}"
    fi
else
    echo -e "${BLUE}💡 Development mode: Using mock Redis${NC}"
    echo -e "${BLUE}💡 No Docker Redis check needed${NC}"
fi
echo ""

# Service logs (only for production Docker deployment)
echo -e "${BLUE}📊 Recent Logs (Production):${NC}"
if [ -n "$DOCKER_COMPOSE" ] && [ -f "docker-compose.prod.yml" ]; then
    if $DOCKER_COMPOSE -f docker-compose.prod.yml ps backend 2>/dev/null | grep -q "Up"; then
        echo "Backend logs:"
        $DOCKER_COMPOSE -f docker-compose.prod.yml logs --tail=10 backend 2>/dev/null || echo "No logs available"
    else
        echo -e "${YELLOW}⚠️  Production services not running (normal for development)${NC}"
    fi
else
    echo -e "${BLUE}💡 Development mode: Check logs in terminal where servers are running${NC}"
fi
echo ""

# Overall status
echo "========================"
if [ "$HEALTH_OK" = true ]; then
    echo -e "${GREEN}✅ All services are healthy!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some services are not healthy${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    if [ -n "$DOCKER_COMPOSE" ]; then
        echo "   1. Check service logs: ${BLUE}$DOCKER_COMPOSE logs -f${NC}"
        echo "   2. Restart services: ${BLUE}$DOCKER_COMPOSE restart${NC}"
    fi
    echo "   3. Check .env configuration"
    exit 1
fi

