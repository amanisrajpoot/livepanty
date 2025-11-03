#!/bin/bash

# LivePanty Environment Setup Script
# Interactive environment configuration

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

echo -e "${BLUE}🔧 LivePanty Environment Setup${NC}"
echo "================================"
echo ""

# Check if .env.example exists
if [ ! -f "$PROJECT_ROOT/env.example" ]; then
    echo -e "${RED}❌ env.example not found${NC}"
    echo "Creating basic .env file..."
    
    # Create basic .env file
    cat > .env << 'EOF'
# Environment Configuration
NODE_ENV=development
PORT=3001

# Database Configuration
DATABASE_URL=postgresql://livepanty:livepanty123@localhost:5432/livepanty
DB_HOST=localhost
DB_PORT=5432
DB_NAME=livepanty
DB_USER=livepanty
DB_PASSWORD=livepanty123

# Redis Configuration
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=
JWT_REFRESH_SECRET=

# Client Configuration
CLIENT_URL=http://localhost:3000
API_URL=http://localhost:3001

# AWS S3 Configuration (optional for KYC)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
S3_BUCKET_NAME=

# Payment Configuration
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=noreply@livepanty.com

# Mediasoup Configuration
MEDIASOUP_NUM_WORKERS=1
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=49999
EOF
    echo -e "${GREEN}✅ Basic .env file created${NC}"
else
    # Copy from example
    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        cp env.example .env
        echo -e "${GREEN}✅ Created .env from env.example${NC}"
    else
        echo -e "${YELLOW}⚠️  .env already exists${NC}"
        read -p "Overwrite existing .env? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cp env.example .env
            echo -e "${GREEN}✅ Overwritten .env${NC}"
        else
            echo "Keeping existing .env"
        fi
    fi
fi

echo ""

# Function to generate random string
generate_secret() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex 32
    elif command -v date >/dev/null 2>&1; then
        date +%s | sha256sum | base64 | head -c 32
    else
        echo "changeme-$(date +%s)"
    fi
}

# Generate JWT secrets if not set
if ! grep -q "JWT_SECRET=" .env || grep -q "JWT_SECRET=$" .env; then
    echo -e "${BLUE}🔐 Generating JWT secrets...${NC}"
    JWT_SECRET=$(generate_secret)
    JWT_REFRESH_SECRET=$(generate_secret)
    
    # Update .env file
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
        sed -i '' "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET|" .env
    else
        # Linux
        sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
        sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET|" .env
    fi
    echo -e "${GREEN}✅ JWT secrets generated${NC}"
fi

echo ""

# Interactive setup
echo -e "${BLUE}📝 Please configure the following (press Enter to use defaults):${NC}"
echo ""

# Database password
read -p "Database password [livepanty123]: " db_pass
db_pass=${db_pass:-livepanty123}
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|DB_PASSWORD=.*|DB_PASSWORD=$db_pass|" .env
    sed -i '' "s|postgresql://livepanty:.*@|postgresql://livepanty:$db_pass@|" .env
else
    sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=$db_pass|" .env
    sed -i "s|postgresql://livepanty:.*@|postgresql://livepanty:$db_pass@|" .env
fi

# Redis password (optional)
read -p "Redis password (optional, press Enter to skip): " redis_pass
if [ -n "$redis_pass" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|REDIS_URL=redis://|REDIS_URL=redis://:$redis_pass@|" .env
    else
        sed -i "s|REDIS_URL=redis://|REDIS_URL=redis://:$redis_pass@|" .env
    fi
fi

# AWS S3 (optional)
read -p "AWS Access Key ID (optional, press Enter to skip): " aws_key
if [ -n "$aws_key" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|AWS_ACCESS_KEY_ID=.*|AWS_ACCESS_KEY_ID=$aws_key|" .env
    else
        sed -i "s|AWS_ACCESS_KEY_ID=.*|AWS_ACCESS_KEY_ID=$aws_key|" .env
    fi
    
    read -p "AWS Secret Access Key: " aws_secret
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|AWS_SECRET_ACCESS_KEY=.*|AWS_SECRET_ACCESS_KEY=$aws_secret|" .env
    else
        sed -i "s|AWS_SECRET_ACCESS_KEY=.*|AWS_SECRET_ACCESS_KEY=$aws_secret|" .env
    fi
    
    read -p "S3 Bucket Name: " s3_bucket
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|S3_BUCKET_NAME=.*|S3_BUCKET_NAME=$s3_bucket|" .env
    else
        sed -i "s|S3_BUCKET_NAME=.*|S3_BUCKET_NAME=$s3_bucket|" .env
    fi
fi

# Payment gateway (optional)
read -p "Razorpay Key ID (optional, press Enter to skip): " razorpay_key
if [ -n "$razorpay_key" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|RAZORPAY_KEY_ID=.*|RAZORPAY_KEY_ID=$razorpay_key|" .env
    else
        sed -i "s|RAZORPAY_KEY_ID=.*|RAZORPAY_KEY_ID=$razorpay_key|" .env
    fi
    
    read -p "Razorpay Key Secret: " razorpay_secret
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|RAZORPAY_KEY_SECRET=.*|RAZORPAY_KEY_SECRET=$razorpay_secret|" .env
    else
        sed -i "s|RAZORPAY_KEY_SECRET=.*|RAZORPAY_KEY_SECRET=$razorpay_secret|" .env
    fi
fi

echo ""
echo -e "${GREEN}✅ Environment setup complete!${NC}"
echo ""
echo -e "${BLUE}📝 Next steps:${NC}"
echo "   1. Review .env file: ${YELLOW}$PROJECT_ROOT/.env${NC}"
echo "   2. Add any additional configuration as needed"
echo "   3. Run: ${YELLOW}npm run dev:up${NC} (for development)"
echo "   4. Or run: ${YELLOW}npm run deploy${NC} (for production)"
echo ""

