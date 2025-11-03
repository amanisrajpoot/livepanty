#!/bin/bash

# Create ECS Services with Load Balancer
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Creating ECS Services${NC}"
echo "========================"

# Configuration
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}
PROJECT_NAME="livepanty"
CLUSTER_NAME="${PROJECT_NAME}-cluster"

# Get VPC and subnet IDs (you need to provide these)
echo "Enter VPC ID: "
read VPC_ID
echo "Enter Public Subnet 1 ID: "
read PUBLIC_SUBNET_1
echo "Enter Public Subnet 2 ID: "
read PUBLIC_SUBNET_2
echo "Enter ECS Security Group ID: "
read ECS_SG

# Create Application Load Balancer
echo -e "${BLUE}📦 Creating Application Load Balancer...${NC}"
ALB_ARN=$(aws elbv2 create-load-balancer \
    --name ${PROJECT_NAME}-alb \
    --subnets ${PUBLIC_SUBNET_1} ${PUBLIC_SUBNET_2} \
    --security-groups $(aws ec2 describe-security-groups --filters "Name=group-name,Values=${PROJECT_NAME}-alb-sg" --query 'SecurityGroups[0].GroupId' --output text) \
    --region ${AWS_REGION} \
    --query 'LoadBalancers[0].LoadBalancerArn' --output text)
echo -e "${GREEN}✓${NC} Load Balancer created: ${ALB_ARN}"

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns ${ALB_ARN} --region ${AWS_REGION} \
    --query 'LoadBalancers[0].DNSName' --output text)
echo "ALB DNS: ${ALB_DNS}"

# Create target groups
echo -e "${BLUE}📦 Creating Target Groups...${NC}"

# Backend target group
BACKEND_TG=$(aws elbv2 create-target-group \
    --name ${PROJECT_NAME}-backend-tg \
    --protocol HTTP \
    --port 3001 \
    --vpc-id ${VPC_ID} \
    --health-check-path /health \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --region ${AWS_REGION} \
    --query 'TargetGroups[0].TargetGroupArn' --output text)

# Frontend target group
FRONTEND_TG=$(aws elbv2 create-target-group \
    --name ${PROJECT_NAME}-frontend-tg \
    --protocol HTTP \
    --port 80 \
    --vpc-id ${VPC_ID} \
    --health-check-path / \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --region ${AWS_REGION} \
    --query 'TargetGroups[0].TargetGroupArn' --output text)

echo -e "${GREEN}✓${NC} Target groups created"

# Create listeners
echo -e "${BLUE}📦 Creating Listeners...${NC}"
aws elbv2 create-listener \
    --load-balancer-arn ${ALB_ARN} \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn=${FRONTEND_TG} \
    --region ${AWS_REGION}

echo -e "${GREEN}✓${NC} Listeners created"

# Create ECS services
echo -e "${BLUE}📦 Creating ECS Services...${NC}"

# Backend service
aws ecs create-service \
    --cluster ${CLUSTER_NAME} \
    --service-name ${PROJECT_NAME}-backend-service \
    --task-definition ${PROJECT_NAME}-backend \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[${PUBLIC_SUBNET_1},${PUBLIC_SUBNET_2}],securityGroups=[${ECS_SG}],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=${BACKEND_TG},containerName=backend,containerPort=3001" \
    --region ${AWS_REGION}

# Frontend service
aws ecs create-service \
    --cluster ${CLUSTER_NAME} \
    --service-name ${PROJECT_NAME}-frontend-service \
    --task-definition ${PROJECT_NAME}-frontend \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[${PUBLIC_SUBNET_1},${PUBLIC_SUBNET_2}],securityGroups=[${ECS_SG}],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=${FRONTEND_TG},containerName=frontend,containerPort=80" \
    --region ${AWS_REGION}

echo -e "${GREEN}✓${NC} ECS services created"

echo ""
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo ""
echo "Load Balancer DNS: ${ALB_DNS}"
echo ""
echo "Update your DNS to point to: ${ALB_DNS}"
echo ""

