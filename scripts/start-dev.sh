#!/bin/bash

# LivePanty Simple Development Start
# For use with cloud databases (Neon DB, etc.) - No Docker needed!

set -e

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

echo -e "${BLUE}🚀 LivePanty Development Start${NC}"
echo "================================"
echo ""

# Check if .env exists
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found!${NC}"
    echo "📝 Running setup..."
    npm run setup
fi

# Check if using cloud database
if grep -q "neon\|supabase\|railway\|DATABASE_URL=.*@" "$PROJECT_ROOT/.env" 2>/dev/null; then
    echo -e "${GREEN}✅ Cloud database detected${NC}"
    echo -e "${BLUE}💡 Using cloud database - Docker not needed!${NC}"
    echo ""
else
    echo -e "${YELLOW}⚠️  Using local database${NC}"
    echo "If using Neon DB, make sure DATABASE_URL is set in .env"
    echo ""
fi

# Check if backend dependencies are installed
if [ ! -d "backend/node_modules" ]; then
    echo -e "${BLUE}📦 Installing backend dependencies...${NC}"
    cd "$PROJECT_ROOT/backend"
    npm install
    cd "$PROJECT_ROOT"
fi

# Check if frontend dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
    cd "$PROJECT_ROOT/frontend"
    npm install
    cd "$PROJECT_ROOT"
fi

echo ""
echo -e "${GREEN}✅ Ready to start servers!${NC}"
echo ""
echo -e "${BLUE}📝 Start servers in separate terminals:${NC}"
echo ""
echo "Terminal 1 - Backend:"
echo -e "   ${YELLOW}cd backend && npm run dev${NC}"
echo ""
echo "Terminal 2 - Frontend:"
echo -e "   ${YELLOW}cd frontend && npm start${NC}"
echo ""
echo -e "${BLUE}🌐 Services will be available at:${NC}"
echo "   Backend:  ${GREEN}http://localhost:3001${NC}"
echo "   Frontend: ${GREEN}http://localhost:3000${NC}"
echo ""
echo -e "${BLUE}💡 Redis: Using mock Redis (no Redis needed)${NC}"
echo -e "${BLUE}💡 Database: Using cloud database from .env${NC}"
echo ""
echo -e "${BLUE}📝 Note: Docker is only needed for production deployment${NC}"
echo -e "${BLUE}📝 Development servers run without Docker${NC}"
echo ""

