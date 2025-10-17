# LivePanty Platform - Production Deployment Guide

## 🚀 Complete Production Setup

This guide covers deploying the LivePanty platform to production with all critical systems implemented.

## 📋 Prerequisites

- Docker and Docker Compose installed
- Domain name and SSL certificates
- AWS S3 bucket for file storage
- SMTP email service (Gmail, SendGrid, etc.)
- Razorpay account for payments
- Server with minimum 4GB RAM, 2 CPU cores

## 🔧 Environment Configuration

Create a `.env.production` file with the following variables:

```bash
# Database Configuration
POSTGRES_PASSWORD=your_secure_postgres_password_here
DATABASE_URL=postgresql://livepanty:your_secure_postgres_password_here@postgres:5432/livepanty_prod

# Redis Configuration
REDIS_PASSWORD=your_secure_redis_password_here
REDIS_URL=redis://:your_secure_redis_password_here@redis:6379

# JWT Configuration
JWT_SECRET=your_super_secure_jwt_secret_key_here_minimum_32_characters
JWT_REFRESH_SECRET=your_super_secure_jwt_refresh_secret_key_here_minimum_32_characters

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=livepanty-production-documents

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=noreply@livepanty.com

# Payment Gateway Configuration
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Mediasoup Configuration
MEDIASOUP_NUM_WORKERS=4
MEDIASOUP_WORKER_LOG_LEVEL=warn
MEDIASOUP_MIN_PORT=10000
MEDIASOUP_MAX_PORT=20000

# Monitoring Configuration
GRAFANA_PASSWORD=your_secure_grafana_password_here

# Security Configuration
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# Domain Configuration
DOMAIN=yourdomain.com
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com
```

## 🐳 Docker Deployment

### 1. Clone and Setup
```bash
git clone <your-repo-url>
cd livepanty
cp .env.production .env
```

### 2. Deploy with Docker Compose
```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 3. Initialize Database
```bash
# Run database migrations
docker-compose -f docker-compose.prod.yml exec backend node -e "
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function runMigration() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const migrationSQL = fs.readFileSync('./database/update-existing-tables.sql', 'utf8');
    await pool.query(migrationSQL);
    console.log('✅ Database migration completed');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await pool.end();
  }
}
runMigration();
"
```

## 🔒 Security Configuration

### 1. SSL Certificates
```bash
# Create SSL directory
mkdir -p nginx/ssl

# Copy your SSL certificates
cp your-cert.pem nginx/ssl/cert.pem
cp your-key.pem nginx/ssl/key.pem
```

### 2. Firewall Configuration
```bash
# Allow only necessary ports
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw enable
```

### 3. Database Security
- Use strong passwords
- Enable SSL connections
- Restrict access to specific IPs
- Regular backups

## 📊 Monitoring Setup

### 1. Access Monitoring Dashboards
- **Grafana**: http://yourdomain.com:3001
- **Prometheus**: http://yourdomain.com:9090

### 2. Key Metrics to Monitor
- CPU and Memory usage
- Database connection pool
- WebRTC connection count
- Payment transaction success rate
- Error rates and response times

## 🛡️ KYC System Configuration

### 1. Document Storage
- Configure AWS S3 bucket with proper permissions
- Set up CORS for file uploads
- Enable encryption at rest

### 2. Verification Process
- Documents are automatically analyzed
- High-risk documents require manual review
- Admin dashboard for verification management

## 🚨 Content Moderation Setup

### 1. Automated Filtering
- Text content analysis for inappropriate language
- Spam detection patterns
- Risk scoring system

### 2. Manual Review Process
- Admin dashboard for report management
- Escalation workflows
- User warning and suspension system

## 💰 Payment Integration

### 1. Razorpay Setup
- Create Razorpay account
- Generate API keys
- Configure webhook endpoints

### 2. Token Packages
- Predefined token packages with discounts
- UPI integration for Indian users
- Secure payment processing

## 🔄 Backup Strategy

### 1. Database Backups
```bash
# Daily automated backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U livepanty livepanty_prod > backup_$(date +%Y%m%d).sql
```

### 2. File Storage Backups
- S3 versioning enabled
- Cross-region replication
- Regular backup verification

## 📈 Scaling Considerations

### 1. Horizontal Scaling
- Multiple backend instances
- Load balancer configuration
- Database read replicas

### 2. WebRTC Scaling
- Mediasoup worker scaling
- CDN for static content
- Edge server deployment

## 🚀 Go-Live Checklist

- [ ] All environment variables configured
- [ ] SSL certificates installed
- [ ] Database migrations completed
- [ ] Payment gateway tested
- [ ] Email service configured
- [ ] File storage working
- [ ] Monitoring dashboards active
- [ ] Backup procedures tested
- [ ] Security audit completed
- [ ] Performance testing done

## 🔧 Maintenance

### Daily Tasks
- Monitor system health
- Check error logs
- Review security alerts

### Weekly Tasks
- Database maintenance
- Log rotation
- Performance analysis

### Monthly Tasks
- Security updates
- Backup verification
- Capacity planning

## 📞 Support

For technical support or questions:
- Check logs: `docker-compose -f docker-compose.prod.yml logs`
- Monitor health: `docker-compose -f docker-compose.prod.yml ps`
- Restart services: `docker-compose -f docker-compose.prod.yml restart`

## 🎯 Production Features Implemented

✅ **Complete KYC System**
- Document upload and storage
- Automated verification
- Admin review interface
- Status tracking

✅ **Content Moderation**
- Automated content filtering
- User reporting system
- Admin moderation tools
- Appeal process

✅ **Admin Dashboard**
- Platform overview statistics
- User management
- KYC verification management
- Moderation tools
- System health monitoring

✅ **Notification System**
- Email notifications
- Push notifications (ready for FCM/APNs)
- In-app notifications
- Admin alerts

✅ **Production Infrastructure**
- Docker containerization
- Nginx reverse proxy
- SSL termination
- Monitoring with Prometheus/Grafana
- Automated backups
- Security hardening

The platform is now production-ready with all critical systems implemented and properly configured for scalability and security.
