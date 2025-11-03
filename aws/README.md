# AWS Deployment Scripts

This directory contains scripts and documentation for deploying LivePanty on AWS.

## Quick Start

### Prerequisites

1. AWS CLI installed and configured:
   ```bash
   aws configure
   ```

2. Docker installed locally

3. Required AWS permissions:
   - EC2 (VPC, Security Groups, Subnets)
   - RDS (Database instances)
   - ElastiCache (Redis)
   - ECS (Container service)
   - ECR (Container registry)
   - S3 (Object storage)
   - IAM (Roles and policies)
   - CloudWatch (Logging)

### Deployment Steps

#### Step 1: Create AWS Infrastructure

```bash
./aws/setup-aws-resources.sh
```

This script creates:
- VPC with public and private subnets
- Security groups
- RDS PostgreSQL database
- ElastiCache Redis cluster
- S3 bucket for file storage
- ECR repositories
- ECS cluster

**Important:** Save the credentials printed at the end!

#### Step 2: Wait for Resources

Wait 5-10 minutes for RDS and Redis to become available. Check AWS Console.

#### Step 3: Get Database and Redis URLs

```bash
# Get RDS endpoint
aws rds describe-db-instances \
  --db-instance-identifier livepanty-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text

# Get Redis endpoint
aws elasticache describe-cache-clusters \
  --cache-cluster-id livepanty-redis \
  --show-cache-node-info \
  --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \
  --output text
```

#### Step 4: Build and Push Docker Images

```bash
./aws/build-and-push-images.sh
```

#### Step 5: Deploy ECS Services

```bash
./aws/deploy-ecs.sh
```

You'll be prompted for:
- Database URL
- Redis URL
- JWT secrets
- S3 bucket name
- Application URLs
- AWS credentials

#### Step 6: Create ECS Services with Load Balancer

```bash
./aws/create-ecs-services.sh
```

You'll need to provide:
- VPC ID
- Subnet IDs
- Security Group IDs

## Manual Steps

### Configure DNS

1. Get your Load Balancer DNS name from AWS Console
2. Create a CNAME record pointing your domain to the ALB DNS
3. Optional: Set up Route 53 for DNS management

### Set Up SSL/HTTPS

1. Request an ACM certificate for your domain
2. Update the load balancer listener to use HTTPS
3. Add HTTP to HTTPS redirect

### Configure Auto Scaling

1. Go to ECS Console → Your Service → Auto Scaling
2. Configure target tracking based on CPU/Memory
3. Set min/max capacity

## Cost Optimization

### Development/Staging

- Use `db.t3.micro` for RDS
- Use `cache.t3.micro` for Redis
- Use Fargate Spot for ECS
- Use single-AZ RDS

### Production

- Use `db.t3.medium` or larger for RDS
- Use Multi-AZ for RDS
- Use `cache.t3.small` or larger for Redis
- Use regular Fargate for ECS
- Enable RDS automated backups
- Enable CloudWatch detailed monitoring

## Monitoring

### CloudWatch Logs

View logs:
```bash
aws logs tail /ecs/livepanty-backend --follow
aws logs tail /ecs/livepanty-frontend --follow
```

### CloudWatch Metrics

Monitor:
- CPU utilization
- Memory utilization
- Request count
- Error rates
- Database connections

### Set Up Alarms

Create CloudWatch alarms for:
- High CPU (>80%)
- High memory (>80%)
- High error rate (>5%)
- Database connection failures

## Troubleshooting

### Service Won't Start

1. Check CloudWatch logs
2. Verify security groups allow traffic
3. Check task definition environment variables
4. Verify ECR images exist

### Can't Connect to Database

1. Verify RDS security group allows traffic from ECS security group
2. Check DATABASE_URL format
3. Verify database is in same VPC
4. Check RDS is not publicly accessible (if using private subnet)

### High Latency

1. Check CloudWatch metrics
2. Verify auto-scaling is configured
3. Check database connection pool settings
4. Review Mediasoup worker configuration

## Cleanup

To remove all AWS resources:

```bash
# Delete ECS services
aws ecs update-service --cluster livepanty-cluster --service livepanty-backend-service --desired-count 0
aws ecs delete-service --cluster livepanty-cluster --service livepanty-backend-service
aws ecs update-service --cluster livepanty-cluster --service livepanty-frontend-service --desired-count 0
aws ecs delete-service --cluster livepanty-cluster --service livepanty-frontend-service

# Delete load balancer
aws elbv2 delete-load-balancer --load-balancer-arn <ALB_ARN>

# Delete RDS
aws rds delete-db-instance --db-instance-identifier livepanty-db --skip-final-snapshot

# Delete Redis
aws elasticache delete-cache-cluster --cache-cluster-id livepanty-redis

# Delete ECR images
aws ecr batch-delete-image --repository-name livepanty-backend --image-ids imageTag=latest
aws ecr batch-delete-image --repository-name livepanty-frontend --image-ids imageTag=latest

# Delete S3 bucket
aws s3 rm s3://<BUCKET_NAME> --recursive
aws s3 rb s3://<BUCKET_NAME>

# Delete VPC (last, after all resources are deleted)
# Remove manually from AWS Console
```

## Security Checklist

- [ ] Use AWS Secrets Manager for sensitive data
- [ ] Enable encryption at rest for RDS
- [ ] Enable encryption at rest for ElastiCache
- [ ] Use private subnets for databases
- [ ] Enable WAF on Application Load Balancer
- [ ] Use HTTPS everywhere (ACM certificates)
- [ ] Rotate secrets regularly
- [ ] Enable CloudWatch logging and monitoring
- [ ] Set up VPC Flow Logs
- [ ] Configure security group rules minimally
- [ ] Use IAM roles instead of access keys where possible

## Next Steps

1. Set up CI/CD pipeline (GitHub Actions/AWS CodePipeline)
2. Configure custom domain with SSL
3. Set up CloudFront for static assets
4. Configure auto-scaling policies
5. Set up monitoring and alerting
6. Configure backup strategy
7. Set up disaster recovery plan

