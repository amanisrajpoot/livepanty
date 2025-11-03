#!/bin/bash

# AWS Resources Setup Script
# Creates all necessary AWS resources for LivePanty deployment

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 LivePanty AWS Deployment Setup${NC}"
echo "======================================"
echo ""

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Run 'aws configure' first.${NC}"
    exit 1
fi

# Get AWS account ID and region
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}
PROJECT_NAME="livepanty"
ENV=${ENV:-production}

echo -e "${GREEN}✓${NC} AWS Account: ${AWS_ACCOUNT_ID}"
echo -e "${GREEN}✓${NC} AWS Region: ${AWS_REGION}"
echo -e "${GREEN}✓${NC} Project: ${PROJECT_NAME}"
echo -e "${GREEN}✓${NC} Environment: ${ENV}"
echo ""

# Configuration
VPC_CIDR="10.0.0.0/16"
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
TIMESTAMP=$(date +%s)
S3_BUCKET_NAME="${PROJECT_NAME}-documents-${TIMESTAMP}"

echo -e "${YELLOW}⚠️  IMPORTANT: Save these credentials securely!${NC}"
echo "DB Password: ${DB_PASSWORD}"
echo "Redis Password: ${REDIS_PASSWORD}"
echo ""
read -p "Press Enter to continue..."

# Step 1: Create VPC
echo -e "${BLUE}📦 Creating VPC...${NC}"
VPC_ID=$(aws ec2 create-vpc --cidr-block ${VPC_CIDR} --region ${AWS_REGION} \
    --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=${PROJECT_NAME}-vpc},{Key=Project,Value=${PROJECT_NAME}}]" \
    --query 'Vpc.VpcId' --output text)
echo -e "${GREEN}✓${NC} VPC created: ${VPC_ID}"

# Enable DNS
aws ec2 modify-vpc-attribute --vpc-id ${VPC_ID} --enable-dns-hostnames
aws ec2 modify-vpc-attribute --vpc-id ${VPC_ID} --enable-dns-support

# Step 2: Create Internet Gateway
echo -e "${BLUE}📦 Creating Internet Gateway...${NC}"
IGW_ID=$(aws ec2 create-internet-gateway --region ${AWS_REGION} \
    --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=${PROJECT_NAME}-igw}]" \
    --query 'InternetGateway.InternetGatewayId' --output text)
aws ec2 attach-internet-gateway --vpc-id ${VPC_ID} --internet-gateway-id ${IGW_ID} --region ${AWS_REGION}
echo -e "${GREEN}✓${NC} Internet Gateway created: ${IGW_ID}"

# Step 3: Create Subnets
echo -e "${BLUE}📦 Creating Subnets...${NC}"

# Public Subnets
PUBLIC_SUBNET_1=$(aws ec2 create-subnet --vpc-id ${VPC_ID} --cidr-block 10.0.1.0/24 \
    --availability-zone ${AWS_REGION}a --region ${AWS_REGION} \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PROJECT_NAME}-public-1}]" \
    --query 'Subnet.SubnetId' --output text)
PUBLIC_SUBNET_2=$(aws ec2 create-subnet --vpc-id ${VPC_ID} --cidr-block 10.0.2.0/24 \
    --availability-zone ${AWS_REGION}b --region ${AWS_REGION} \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PROJECT_NAME}-public-2}]" \
    --query 'Subnet.SubnetId' --output text)

# Private Subnets
PRIVATE_SUBNET_1=$(aws ec2 create-subnet --vpc-id ${VPC_ID} --cidr-block 10.0.3.0/24 \
    --availability-zone ${AWS_REGION}a --region ${AWS_REGION} \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PROJECT_NAME}-private-1}]" \
    --query 'Subnet.SubnetId' --output text)
PRIVATE_SUBNET_2=$(aws ec2 create-subnet --vpc-id ${VPC_ID} --cidr-block 10.0.4.0/24 \
    --availability-zone ${AWS_REGION}b --region ${AWS_REGION} \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PROJECT_NAME}-private-2}]" \
    --query 'Subnet.SubnetId' --output text)

echo -e "${GREEN}✓${NC} Subnets created"

# Step 4: Create Route Table
echo -e "${BLUE}📦 Creating Route Tables...${NC}"
PUBLIC_RT=$(aws ec2 create-route-table --vpc-id ${VPC_ID} --region ${AWS_REGION} \
    --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${PROJECT_NAME}-public-rt}]" \
    --query 'RouteTable.RouteTableId' --output text)
aws ec2 create-route --route-table-id ${PUBLIC_RT} --destination-cidr-block 0.0.0.0/0 \
    --gateway-id ${IGW_ID} --region ${AWS_REGION}
aws ec2 associate-route-table --subnet-id ${PUBLIC_SUBNET_1} --route-table-id ${PUBLIC_RT} --region ${AWS_REGION}
aws ec2 associate-route-table --subnet-id ${PUBLIC_SUBNET_2} --route-table-id ${PUBLIC_RT} --region ${AWS_REGION}
echo -e "${GREEN}✓${NC} Route tables created"

# Step 5: Create Security Groups
echo -e "${BLUE}📦 Creating Security Groups...${NC}"

# ALB Security Group
ALB_SG=$(aws ec2 create-security-group --group-name ${PROJECT_NAME}-alb-sg \
    --description "Security group for Application Load Balancer" \
    --vpc-id ${VPC_ID} --region ${AWS_REGION} \
    --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id ${ALB_SG} --protocol tcp --port 80 --cidr 0.0.0.0/0 --region ${AWS_REGION}
aws ec2 authorize-security-group-ingress --group-id ${ALB_SG} --protocol tcp --port 443 --cidr 0.0.0.0/0 --region ${AWS_REGION}

# ECS Security Group
ECS_SG=$(aws ec2 create-security-group --group-name ${PROJECT_NAME}-ecs-sg \
    --description "Security group for ECS tasks" \
    --vpc-id ${VPC_ID} --region ${AWS_REGION} \
    --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id ${ECS_SG} --protocol tcp --port 3001 --source-group ${ALB_SG} --region ${AWS_REGION}

# RDS Security Group
RDS_SG=$(aws ec2 create-security-group --group-name ${PROJECT_NAME}-rds-sg \
    --description "Security group for RDS" \
    --vpc-id ${VPC_ID} --region ${AWS_REGION} \
    --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id ${RDS_SG} --protocol tcp --port 5432 --source-group ${ECS_SG} --region ${AWS_REGION}

# Redis Security Group
REDIS_SG=$(aws ec2 create-security-group --group-name ${PROJECT_NAME}-redis-sg \
    --description "Security group for ElastiCache Redis" \
    --vpc-id ${VPC_ID} --region ${AWS_REGION} \
    --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id ${REDIS_SG} --protocol tcp --port 6379 --source-group ${ECS_SG} --region ${AWS_REGION}

echo -e "${GREEN}✓${NC} Security groups created"

# Step 6: Create S3 Bucket
echo -e "${BLUE}📦 Creating S3 Bucket...${NC}"
aws s3 mb s3://${S3_BUCKET_NAME} --region ${AWS_REGION} || true
aws s3api put-bucket-versioning --bucket ${S3_BUCKET_NAME} --versioning-configuration Status=Enabled --region ${AWS_REGION}
aws s3api put-bucket-encryption --bucket ${S3_BUCKET_NAME} \
    --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' \
    --region ${AWS_REGION}
echo -e "${GREEN}✓${NC} S3 Bucket created: ${S3_BUCKET_NAME}"

# Step 7: Create DB Subnet Group
echo -e "${BLUE}📦 Creating DB Subnet Group...${NC}"
aws rds create-db-subnet-group \
    --db-subnet-group-name ${PROJECT_NAME}-db-subnet-group \
    --db-subnet-group-description "Subnet group for RDS" \
    --subnet-ids ${PRIVATE_SUBNET_1} ${PRIVATE_SUBNET_2} \
    --region ${AWS_REGION} || true
echo -e "${GREEN}✓${NC} DB Subnet Group created"

# Step 8: Create ElastiCache Subnet Group
echo -e "${BLUE}📦 Creating ElastiCache Subnet Group...${NC}"
aws elasticache create-cache-subnet-group \
    --cache-subnet-group-name ${PROJECT_NAME}-redis-subnet-group \
    --cache-subnet-group-description "Subnet group for ElastiCache" \
    --subnet-ids ${PRIVATE_SUBNET_1} ${PRIVATE_SUBNET_2} \
    --region ${AWS_REGION} || true
echo -e "${GREEN}✓${NC} ElastiCache Subnet Group created"

# Step 9: Create RDS Instance
echo -e "${BLUE}📦 Creating RDS PostgreSQL Instance (this takes 5-10 minutes)...${NC}"
aws rds create-db-instance \
    --db-instance-identifier ${PROJECT_NAME}-db \
    --db-instance-class db.t3.medium \
    --engine postgres \
    --engine-version 15.4 \
    --master-username livepanty \
    --master-user-password ${DB_PASSWORD} \
    --allocated-storage 100 \
    --storage-type gp3 \
    --storage-encrypted \
    --vpc-security-group-ids ${RDS_SG} \
    --db-subnet-group-name ${PROJECT_NAME}-db-subnet-group \
    --backup-retention-period 7 \
    --multi-az \
    --publicly-accessible false \
    --region ${AWS_REGION} || echo -e "${YELLOW}⚠️  RDS instance may already exist${NC}"
echo -e "${GREEN}✓${NC} RDS instance creation initiated"

# Step 10: Create ElastiCache Redis
echo -e "${BLUE}📦 Creating ElastiCache Redis Cluster...${NC}"
aws elasticache create-cache-cluster \
    --cache-cluster-id ${PROJECT_NAME}-redis \
    --cache-node-type cache.t3.micro \
    --engine redis \
    --engine-version 7.0 \
    --num-cache-nodes 1 \
    --security-group-ids ${REDIS_SG} \
    --cache-subnet-group-name ${PROJECT_NAME}-redis-subnet-group \
    --region ${AWS_REGION} || echo -e "${YELLOW}⚠️  Redis cluster may already exist${NC}"
echo -e "${GREEN}✓${NC} ElastiCache Redis creation initiated"

# Step 11: Create ECR Repositories
echo -e "${BLUE}📦 Creating ECR Repositories...${NC}"
aws ecr create-repository --repository-name ${PROJECT_NAME}-backend --region ${AWS_REGION} || true
aws ecr create-repository --repository-name ${PROJECT_NAME}-frontend --region ${AWS_REGION} || true
echo -e "${GREEN}✓${NC} ECR Repositories created"

# Step 12: Create ECS Cluster
echo -e "${BLUE}📦 Creating ECS Cluster...${NC}"
aws ecs create-cluster --cluster-name ${PROJECT_NAME}-cluster \
    --capacity-providers FARGATE FARGATE_SPOT \
    --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
    --region ${AWS_REGION} || true
echo -e "${GREEN}✓${NC} ECS Cluster created"

# Save configuration
echo ""
echo -e "${GREEN}✅ AWS Resources Setup Complete!${NC}"
echo ""
echo "Save this configuration:"
echo "================================"
echo "VPC_ID=${VPC_ID}"
echo "PUBLIC_SUBNET_1=${PUBLIC_SUBNET_1}"
echo "PUBLIC_SUBNET_2=${PUBLIC_SUBNET_2}"
echo "PRIVATE_SUBNET_1=${PRIVATE_SUBNET_1}"
echo "PRIVATE_SUBNET_2=${PRIVATE_SUBNET_2}"
echo "ALB_SG=${ALB_SG}"
echo "ECS_SG=${ECS_SG}"
echo "RDS_SG=${RDS_SG}"
echo "REDIS_SG=${REDIS_SG}"
echo "S3_BUCKET_NAME=${S3_BUCKET_NAME}"
echo "AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID}"
echo "AWS_REGION=${AWS_REGION}"
echo "DB_PASSWORD=${DB_PASSWORD}"
echo "REDIS_PASSWORD=${REDIS_PASSWORD}"
echo "================================"
echo ""
echo -e "${YELLOW}⚠️  Next steps:${NC}"
echo "1. Wait for RDS and Redis to be available (check AWS Console)"
echo "2. Run: ./aws/build-and-push-images.sh"
echo "3. Run: ./aws/deploy-ecs.sh"
echo ""

