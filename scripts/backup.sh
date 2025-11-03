#!/bin/bash

# LivePanty Automated Backup Script
# Backs up database and file storage

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS="${RETENTION_DAYS:-30}"

echo -e "${BLUE}🔄 LivePanty Backup Script${NC}"
echo "================================"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Database Backup
echo -e "${BLUE}📊 Backing up database...${NC}"
if [ -n "$DATABASE_URL" ]; then
  DB_BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql"
  
  # Extract database connection details from URL
  if [[ "$DATABASE_URL" =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
    
    export PGPASSWORD="$DB_PASS"
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$DB_BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
      # Compress backup
      gzip "$DB_BACKUP_FILE"
      echo -e "${GREEN}✅ Database backup created: ${DB_BACKUP_FILE}.gz${NC}"
    else
      echo -e "${RED}❌ Database backup failed${NC}"
      exit 1
    fi
  else
    echo -e "${YELLOW}⚠️  Invalid DATABASE_URL format, skipping database backup${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  DATABASE_URL not set, skipping database backup${NC}"
fi

# S3 Backup (if configured)
echo -e "${BLUE}📦 Backing up S3 files...${NC}"
if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$S3_BUCKET_NAME" ]; then
  S3_BACKUP_FILE="$BACKUP_DIR/s3_backup_$TIMESTAMP.tar.gz"
  
  # List and backup S3 objects (using AWS CLI)
  if command -v aws &> /dev/null; then
    aws s3 sync "s3://$S3_BUCKET_NAME" "$BACKUP_DIR/s3_sync_$TIMESTAMP" || {
      echo -e "${YELLOW}⚠️  S3 backup failed (may require AWS CLI configuration)${NC}"
    }
    
    if [ -d "$BACKUP_DIR/s3_sync_$TIMESTAMP" ]; then
      tar -czf "$S3_BACKUP_FILE" -C "$BACKUP_DIR" "s3_sync_$TIMESTAMP"
      rm -rf "$BACKUP_DIR/s3_sync_$TIMESTAMP"
      echo -e "${GREEN}✅ S3 backup created: ${S3_BACKUP_FILE}${NC}"
    fi
  else
    echo -e "${YELLOW}⚠️  AWS CLI not installed, skipping S3 backup${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  AWS credentials not configured, skipping S3 backup${NC}"
fi

# Cleanup old backups
echo -e "${BLUE}🧹 Cleaning up old backups (older than $RETENTION_DAYS days)...${NC}"
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -type f -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
echo -e "${GREEN}✅ Cleanup complete${NC}"

# Backup summary
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo ""
echo -e "${GREEN}✅ Backup completed successfully!${NC}"
echo "   Backup directory: $BACKUP_DIR"
echo "   Total size: $BACKUP_SIZE"
echo "   Retention: $RETENTION_DAYS days"

