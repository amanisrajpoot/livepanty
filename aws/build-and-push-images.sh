#!/bin/bash

# Build and Push Docker Images to ECR
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🐳 Building and Pushing Docker Images${NC}"
echo "======================================"

# Get AWS account ID and region
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}
PROJECT_NAME="livepanty"

ECR_BACKEND="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-backend"
ECR_FRONTEND="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-frontend"

echo "AWS Account: ${AWS_ACCOUNT_ID}"
echo "Region: ${AWS_REGION}"
echo "Backend ECR: ${ECR_BACKEND}"
echo "Frontend ECR: ${ECR_FRONTEND}"
echo ""

# Login to ECR
echo -e "${BLUE}🔐 Logging in to ECR...${NC}"
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
echo -e "${GREEN}✓${NC} Logged in"

# Build and push backend
echo -e "${BLUE}📦 Building backend image...${NC}"
cd backend
docker build -f Dockerfile.prod -t ${PROJECT_NAME}-backend:latest .
docker tag ${PROJECT_NAME}-backend:latest ${ECR_BACKEND}:latest
docker tag ${PROJECT_NAME}-backend:latest ${ECR_BACKEND}:$(date +%Y%m%d-%H%M%S)
echo -e "${BLUE}📤 Pushing backend image...${NC}"
docker push ${ECR_BACKEND}:latest
docker push ${ECR_BACKEND}:$(date +%Y%m%d-%H%M%S)
echo -e "${GREEN}✓${NC} Backend image pushed"
cd ..

# Build and push frontend
echo -e "${BLUE}📦 Building frontend image...${NC}"
cd frontend
docker build -f Dockerfile.prod -t ${PROJECT_NAME}-frontend:latest .
docker tag ${PROJECT_NAME}-frontend:latest ${ECR_FRONTEND}:latest
docker tag ${PROJECT_NAME}-frontend:latest ${ECR_FRONTEND}:$(date +%Y%m%d-%H%M%S)
echo -e "${BLUE}📤 Pushing frontend image...${NC}"
docker push ${ECR_FRONTEND}:latest
docker push ${ECR_FRONTEND}:$(date +%Y%m%d-%H%M%S)
echo -e "${GREEN}✓${NC} Frontend image pushed"
cd ..

echo ""
echo -e "${GREEN}✅ Images built and pushed successfully!${NC}"
echo ""
echo "Backend Image: ${ECR_BACKEND}:latest"
echo "Frontend Image: ${ECR_FRONTEND}:latest"
echo ""

