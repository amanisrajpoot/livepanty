# AWS Deployment Guide

This guide covers deploying the LivePanty streaming platform on AWS.

## Architecture Overview

### Recommended Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CloudFront CDN                        │
│                   (Static Assets)                       │
└───────────────────────┬─────────────────────────────────┘
                         │
            ┌────────────┴────────────┐
            │                         │
    ┌───────▼──────┐          ┌──────▼──────┐
    │  Application │          │   S3 Bucket │
    │  Load Balancer│          │  (Static)   │
    └───────┬──────┘          └─────────────┘
            │
    ┌───────▼────────────────────────────────┐
    │      ECS Cluster (Fargate)              │
    │  ┌──────────┐      ┌──────────┐        │
    │  │ Frontend │      │ Backend  │        │
    │  │  Service │      │ Service  │        │
    │  └──────────┘      └──────────┘        │
    └───────┬─────────────────────┬───────────┘
            │                     │
    ┌───────▼──────────┐  ┌──────▼──────────┐
    │   RDS PostgreSQL │  │ ElastiCache     │
    │   (Multi-AZ)     │  │ Redis           │
    └──────────────────┘  └─────────────────┘
```

## Prerequisites

1. AWS Account with appropriate permissions
2. AWS CLI installed and configured
3. Docker installed locally
4. Terraform (optional, for infrastructure as code)
5. Domain name (optional, but recommended)

## Deployment Options

### Option 1: ECS Fargate (Recommended)

**Pros:**
- Fully managed containers
- Auto-scaling
- No server management
- Pay only for what you use
- Built-in load balancing

**Cons:**
- Slightly higher cost for small workloads
- Cold start times

### Option 2: EC2 with Docker Compose

**Pros:**
- Full control
- Lower cost for predictable workloads
- Simple setup

**Cons:**
- Manual scaling
- Server management required
- More maintenance overhead

### Option 3: ECS with EC2 Launch Type

**Pros:**
- More control than Fargate
- Lower cost for high-traffic
- Better for Mediasoup workers

**Cons:**
- Server management
- More complex setup

## Step-by-Step Deployment

### Step 1: Create AWS Resources

Run the setup script:
```bash
./aws/setup-aws-resources.sh
```

This creates:
- VPC and networking
- RDS PostgreSQL instance
- ElastiCache Redis cluster
- S3 bucket for uploads
- ECR repositories for Docker images
- Security groups
- IAM roles

### Step 2: Build and Push Docker Images

```bash
./aws/build-and-push-images.sh
```

### Step 3: Deploy to ECS

```bash
./aws/deploy-ecs.sh
```

### Step 4: Configure Load Balancer

```bash
./aws/setup-load-balancer.sh
```

## Manual Deployment Steps

### 1. Create S3 Bucket

```bash
aws s3 mb s3://livepanty-documents-$(date +%s)
aws s3api put-bucket-versioning --bucket BUCKET_NAME --versioning-configuration Status=Enabled
```

### 2. Create RDS PostgreSQL Instance

```bash
aws rds create-db-instance \
  --db-instance-identifier livepanty-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.4 \
  --master-username livepanty \
  --master-user-password YOUR_SECURE_PASSWORD \
  --allocated-storage 100 \
  --storage-type gp3 \
  --vpc-security-group-ids sg-xxxxx \
  --db-subnet-group-name livepanty-db-subnet-group \
  --backup-retention-period 7 \
  --multi-az \
  --publicly-accessible false
```

### 3. Create ElastiCache Redis

```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id livepanty-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --security-group-ids sg-xxxxx \
  --subnet-group-name livepanty-redis-subnet-group
```

### 4. Create ECR Repositories

```bash
aws ecr create-repository --repository-name livepanty-backend
aws ecr create-repository --repository-name livepanty-frontend
```

### 5. Build and Push Images

```bash
# Get ECR login
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build and push backend
cd backend
docker build -f Dockerfile.prod -t livepanty-backend .
docker tag livepanty-backend:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/livepanty-backend:latest
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/livepanty-backend:latest

# Build and push frontend
cd ../frontend
docker build -f Dockerfile.prod -t livepanty-frontend .
docker tag livepanty-frontend:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/livepanty-frontend:latest
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/livepanty-frontend:latest
```

## Environment Variables

Create a `.env.production` file with:

```bash
NODE_ENV=production
PORT=3001

# RDS Database
DATABASE_URL=postgresql://livepanty:PASSWORD@livepanty-db.xxxxx.us-east-1.rds.amazonaws.com:5432/livepanty_prod

# ElastiCache Redis
REDIS_URL=redis://livepanty-redis.xxxxx.cache.amazonaws.com:6379

# JWT Secrets (use AWS Secrets Manager)
JWT_SECRET=YOUR_SUPER_SECURE_SECRET
JWT_REFRESH_SECRET=YOUR_SUPER_SECURE_REFRESH_SECRET

# AWS S3
AWS_ACCESS_KEY_ID=YOUR_KEY
AWS_SECRET_ACCESS_KEY=YOUR_SECRET
AWS_REGION=us-east-1
S3_BUCKET_NAME=livepanty-documents-xxxxx

# Application URLs
CLIENT_URL=https://livepanty.com
API_URL=https://api.livepanty.com
CORS_ORIGIN=https://livepanty.com

# Mediasoup
MEDIASOUP_NUM_WORKERS=4
MEDIASOUP_MIN_PORT=10000
MEDIASOUP_MAX_PORT=20000
ANNOUNCED_IP=YOUR_PUBLIC_IP

# Payment
RAZORPAY_KEY_ID=YOUR_KEY
RAZORPAY_KEY_SECRET=YOUR_SECRET

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@livepanty.com

# Monitoring
SENTRY_DSN=YOUR_SENTRY_DSN
```

## Security Best Practices

1. **Use AWS Secrets Manager** for sensitive data
2. **Enable encryption at rest** for RDS and ElastiCache
3. **Use VPC** with private subnets for databases
4. **Enable WAF** on Application Load Balancer
5. **Use HTTPS** everywhere (ACM certificates)
6. **Rotate secrets** regularly
7. **Enable CloudWatch** logging and monitoring

## Monitoring & Logging

### CloudWatch Logs
- Backend logs: `/aws/ecs/livepanty-backend`
- Frontend logs: `/aws/ecs/livepanty-frontend`

### CloudWatch Metrics
- CPU utilization
- Memory utilization
- Request count
- Error rates
- Database connections

### Alarms
Set up CloudWatch alarms for:
- High CPU (>80%)
- High memory (>80%)
- High error rate (>5%)
- Database connection failures

## Scaling

### Auto Scaling Configuration

```json
{
  "minCapacity": 1,
  "maxCapacity": 10,
  "targetTrackingScalingPolicies": [
    {
      "targetValue": 70.0,
      "predefinedMetricSpecification": {
        "predefinedMetricType": "ECSServiceAverageCPUUtilization"
      }
    },
    {
      "targetValue": 80.0,
      "predefinedMetricSpecification": {
        "predefinedMetricType": "ECSServiceAverageMemoryUtilization"
      }
    }
  ]
}
```

## Cost Estimation

### Small Scale (100-1000 users)
- ECS Fargate: ~$50-100/month
- RDS db.t3.medium: ~$70/month
- ElastiCache cache.t3.micro: ~$15/month
- S3: ~$5/month
- Data Transfer: ~$10/month
- **Total: ~$150-200/month**

### Medium Scale (1000-10000 users)
- ECS Fargate: ~$200-400/month
- RDS db.t3.large: ~$150/month
- ElastiCache cache.t3.small: ~$30/month
- S3: ~$20/month
- Data Transfer: ~$50/month
- **Total: ~$450-650/month**

### Large Scale (10000+ users)
- ECS Fargate: ~$500-1000/month
- RDS db.t3.xlarge: ~$300/month
- ElastiCache cache.m5.large: ~$100/month
- S3: ~$50/month
- Data Transfer: ~$200/month
- **Total: ~$1150-1650/month**

## Troubleshooting

### Common Issues

1. **Database connection fails**
   - Check security groups allow traffic from ECS
   - Verify DATABASE_URL format
   - Check RDS is publicly accessible (if needed) or in same VPC

2. **Redis connection fails**
   - Check ElastiCache security group
   - Verify REDIS_URL format
   - Ensure ElastiCache is in same VPC

3. **High latency**
   - Check CloudWatch metrics
   - Consider enabling CloudFront for static assets
   - Check database connection pool settings
   - Verify Mediasoup worker configuration

4. **Container crashes**
   - Check CloudWatch logs
   - Verify environment variables
   - Check memory limits
   - Review health check configuration

## Backup & Disaster Recovery

### Automated Backups
- RDS: Automated backups enabled (7 days retention)
- S3: Versioning enabled
- Database: Run `scripts/backup.sh` daily via CloudWatch Events

### Disaster Recovery Plan
1. Document recovery procedures
2. Test backups regularly
3. Maintain RDS read replicas in different AZ
4. Keep infrastructure as code (Terraform/CloudFormation)

## Support

For issues or questions:
- Check CloudWatch logs
- Review AWS documentation
- Check application logs in ECS console

