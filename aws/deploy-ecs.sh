#!/bin/bash

# Deploy to ECS Fargate
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Deploying to ECS${NC}"
echo "======================"

# Configuration
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}
PROJECT_NAME="livepanty"
CLUSTER_NAME="${PROJECT_NAME}-cluster"

# Get repository URIs
ECR_BACKEND="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-backend:latest"
ECR_FRONTEND="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-frontend:latest"

# Prompt for environment variables
echo ""
echo -e "${YELLOW}Please provide the following (or press Enter to use defaults):${NC}"
read -p "Database URL (from RDS): " DATABASE_URL
read -p "Redis URL (from ElastiCache): " REDIS_URL
read -p "JWT Secret: " JWT_SECRET
read -p "JWT Refresh Secret: " JWT_REFRESH_SECRET
read -p "S3 Bucket Name: " S3_BUCKET_NAME
read -p "Client URL (e.g., https://livepanty.com): " CLIENT_URL
read -p "API URL (e.g., https://api.livepanty.com): " API_URL
read -p "AWS Access Key ID: " AWS_ACCESS_KEY_ID
read -p "AWS Secret Access Key: " AWS_SECRET_ACCESS_KEY
read -p "Razorpay Key ID (optional): " RAZORPAY_KEY_ID
read -p "Razorpay Key Secret (optional): " RAZORPAY_KEY_SECRET

# Create task execution role (one-time)
echo -e "${BLUE}📦 Creating IAM roles...${NC}"
EXECUTION_ROLE_ARN=$(aws iam get-role --role-name ecsTaskExecutionRole --query 'Role.Arn' --output text 2>/dev/null || \
    aws iam create-role --role-name ecsTaskExecutionRole \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "ecs-tasks.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' \
    --query 'Role.Arn' --output text)

aws iam attach-role-policy --role-name ecsTaskExecutionRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Create task role
TASK_ROLE_ARN=$(aws iam get-role --role-name ecsTaskRole --query 'Role.Arn' --output text 2>/dev/null || \
    aws iam create-role --role-name ecsTaskRole \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "ecs-tasks.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' \
    --query 'Role.Arn' --output text)

echo -e "${GREEN}✓${NC} IAM roles configured"

# Create task definition for backend
echo -e "${BLUE}📦 Creating backend task definition...${NC}"
cat > /tmp/backend-task-def.json <<EOF
{
  "family": "${PROJECT_NAME}-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "${EXECUTION_ROLE_ARN}",
  "taskRoleArn": "${TASK_ROLE_ARN}",
  "containerDefinitions": [{
    "name": "backend",
    "image": "${ECR_BACKEND}",
    "essential": true,
    "portMappings": [{
      "containerPort": 3001,
      "protocol": "tcp"
    }],
    "environment": [
      {"name": "NODE_ENV", "value": "production"},
      {"name": "PORT", "value": "3001"},
      {"name": "DATABASE_URL", "value": "${DATABASE_URL}"},
      {"name": "REDIS_URL", "value": "${REDIS_URL}"},
      {"name": "JWT_SECRET", "value": "${JWT_SECRET}"},
      {"name": "JWT_REFRESH_SECRET", "value": "${JWT_REFRESH_SECRET}"},
      {"name": "S3_BUCKET_NAME", "value": "${S3_BUCKET_NAME}"},
      {"name": "CLIENT_URL", "value": "${CLIENT_URL}"},
      {"name": "API_URL", "value": "${API_URL}"},
      {"name": "CORS_ORIGIN", "value": "${CLIENT_URL}"},
      {"name": "AWS_ACCESS_KEY_ID", "value": "${AWS_ACCESS_KEY_ID}"},
      {"name": "AWS_SECRET_ACCESS_KEY", "value": "${AWS_SECRET_ACCESS_KEY}"},
      {"name": "AWS_REGION", "value": "${AWS_REGION}"},
      {"name": "MEDIASOUP_NUM_WORKERS", "value": "4"},
      {"name": "MEDIASOUP_MIN_PORT", "value": "10000"},
      {"name": "MEDIASOUP_MAX_PORT", "value": "20000"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/${PROJECT_NAME}-backend",
        "awslogs-region": "${AWS_REGION}",
        "awslogs-stream-prefix": "ecs"
      }
    },
    "healthCheck": {
      "command": ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))\" || exit 1"],
      "interval": 30,
      "timeout": 5,
      "retries": 3,
      "startPeriod": 60
    }
  }]
}
EOF

if [ ! -z "$RAZORPAY_KEY_ID" ]; then
  # Add Razorpay env vars using jq if available, or sed
  if command -v jq &> /dev/null; then
    cat /tmp/backend-task-def.json | jq ".containerDefinitions[0].environment += [{\"name\": \"RAZORPAY_KEY_ID\", \"value\": \"${RAZORPAY_KEY_ID}\"}, {\"name\": \"RAZORPAY_KEY_SECRET\", \"value\": \"${RAZORPAY_KEY_SECRET}\"}]" > /tmp/backend-task-def-tmp.json
    mv /tmp/backend-task-def-tmp.json /tmp/backend-task-def.json
  fi
fi

# Create CloudWatch log group
aws logs create-log-group --log-group-name "/ecs/${PROJECT_NAME}-backend" --region ${AWS_REGION} || true

# Register task definition
aws ecs register-task-definition --cli-input-json file:///tmp/backend-task-def.json --region ${AWS_REGION}
echo -e "${GREEN}✓${NC} Backend task definition created"

# Create task definition for frontend
echo -e "${BLUE}📦 Creating frontend task definition...${NC}"
cat > /tmp/frontend-task-def.json <<EOF
{
  "family": "${PROJECT_NAME}-frontend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "${EXECUTION_ROLE_ARN}",
  "taskRoleArn": "${TASK_ROLE_ARN}",
  "containerDefinitions": [{
    "name": "frontend",
    "image": "${ECR_FRONTEND}",
    "essential": true,
    "portMappings": [{
      "containerPort": 80,
      "protocol": "tcp"
    }],
    "environment": [
      {"name": "REACT_APP_API_URL", "value": "${API_URL}/api"},
      {"name": "REACT_APP_WS_URL", "value": "${API_URL}"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/${PROJECT_NAME}-frontend",
        "awslogs-region": "${AWS_REGION}",
        "awslogs-stream-prefix": "ecs"
      }
    },
    "healthCheck": {
      "command": ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost/ || exit 1"],
      "interval": 30,
      "timeout": 5,
      "retries": 3
    }
  }]
}
EOF

# Create CloudWatch log group
aws logs create-log-group --log-group-name "/ecs/${PROJECT_NAME}-frontend" --region ${AWS_REGION} || true

# Register task definition
aws ecs register-task-definition --cli-input-json file:///tmp/frontend-task-def.json --region ${AWS_REGION}
echo -e "${GREEN}✓${NC} Frontend task definition created"

echo ""
echo -e "${YELLOW}⚠️  Next step: Create ECS services manually or use AWS Console${NC}"
echo "Or run: ./aws/create-ecs-services.sh"
echo ""

