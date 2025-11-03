#!/bin/bash

# Launch EC2 Instance script (run locally)
# Creates an EC2 instance for LivePanty deployment

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Launching EC2 Instance for LivePanty${NC}"
echo "============================================"
echo ""

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Run 'aws configure' first.${NC}"
    exit 1
fi

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
INSTANCE_TYPE=${INSTANCE_TYPE:-t3.medium}
AMI_ID="ami-0c02fb55956c7d316"  # Ubuntu 22.04 LTS (us-east-1)
KEY_NAME=${KEY_NAME:-livepanty-key}

echo "Region: ${AWS_REGION}"
echo "Instance Type: ${INSTANCE_TYPE}"
echo ""

# Check if key pair exists
if ! aws ec2 describe-key-pairs --key-names ${KEY_NAME} --region ${AWS_REGION} &> /dev/null; then
    echo -e "${YELLOW}⚠️  Key pair '${KEY_NAME}' not found.${NC}"
    read -p "Do you want to create it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}🔑 Creating key pair...${NC}"
        aws ec2 create-key-pair --key-name ${KEY_NAME} --region ${AWS_REGION} \
            --query 'KeyMaterial' --output text > ${KEY_NAME}.pem
        chmod 400 ${KEY_NAME}.pem
        echo -e "${GREEN}✓${NC} Key pair created: ${KEY_NAME}.pem"
        echo -e "${YELLOW}⚠️  Save this key file securely! You'll need it to SSH into the instance.${NC}"
    else
        echo -e "${RED}❌ Key pair required. Exiting.${NC}"
        exit 1
    fi
fi

# Create security group
echo -e "${BLUE}🔥 Creating security group...${NC}"
SG_ID=$(aws ec2 create-security-group \
    --group-name livepanty-sg \
    --description "Security group for LivePanty" \
    --region ${AWS_REGION} \
    --query 'GroupId' --output text 2>/dev/null || \
    aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=livepanty-sg" \
    --query 'SecurityGroups[0].GroupId' --output text)

# Get my IP
MY_IP=$(curl -s https://checkip.amazonaws.com)

# Configure security group rules
echo -e "${BLUE}📋 Configuring security group rules...${NC}"
aws ec2 authorize-security-group-ingress \
    --group-id ${SG_ID} \
    --protocol tcp \
    --port 22 \
    --cidr ${MY_IP}/32 \
    --region ${AWS_REGION} 2>/dev/null || true

aws ec2 authorize-security-group-ingress \
    --group-id ${SG_ID} \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0 \
    --region ${AWS_REGION} 2>/dev/null || true

aws ec2 authorize-security-group-ingress \
    --group-id ${SG_ID} \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0 \
    --region ${AWS_REGION} 2>/dev/null || true

aws ec2 authorize-security-group-ingress \
    --group-id ${SG_ID} \
    --protocol tcp \
    --port 3001 \
    --cidr 0.0.0.0/0 \
    --region ${AWS_REGION} 2>/dev/null || true

echo -e "${GREEN}✓${NC} Security group configured"

# Get AMI ID for the region
if [ "$AWS_REGION" != "us-east-1" ]; then
    AMI_ID=$(aws ec2 describe-images \
        --owners 099720109477 \
        --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
                  "Name=state,Values=available" \
        --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
        --output text \
        --region ${AWS_REGION})
fi

# Create user data script
cat > /tmp/user-data.sh <<'EOF'
#!/bin/bash
apt-get update
apt-get install -y docker.io docker-compose-plugin git
systemctl start docker
systemctl enable docker
usermod -aG docker ubuntu
EOF

# Launch instance
echo -e "${BLUE}🚀 Launching EC2 instance...${NC}"
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id ${AMI_ID} \
    --instance-type ${INSTANCE_TYPE} \
    --key-name ${KEY_NAME} \
    --security-group-ids ${SG_ID} \
    --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=livepanty-server},{Key=Project,Value=livepanty}]" \
    --user-data file:///tmp/user-data.sh \
    --region ${AWS_REGION} \
    --query 'Instances[0].InstanceId' --output text)

echo -e "${GREEN}✓${NC} Instance launched: ${INSTANCE_ID}"

# Wait for instance to be running
echo -e "${BLUE}⏳ Waiting for instance to be running...${NC}"
aws ec2 wait instance-running --instance-ids ${INSTANCE_ID} --region ${AWS_REGION}

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids ${INSTANCE_ID} \
    --region ${AWS_REGION} \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

echo ""
echo -e "${GREEN}✅ EC2 Instance Launched Successfully!${NC}"
echo ""
echo "Instance Details:"
echo "  Instance ID: ${INSTANCE_ID}"
echo "  Public IP: ${PUBLIC_IP}"
echo "  SSH Command: ssh -i ${KEY_NAME}.pem ubuntu@${PUBLIC_IP}"
echo ""
echo "Next steps:"
echo "1. Wait 2-3 minutes for instance to fully initialize"
echo "2. SSH into the instance: ssh -i ${KEY_NAME}.pem ubuntu@${PUBLIC_IP}"
echo "3. Clone your repository: git clone <your-repo-url> ~/livepanty"
echo "4. Run setup: cd ~/livepanty && ./aws/setup-ec2-instance.sh"
echo "5. Deploy: cd ~/livepanty && ./aws/deploy-to-ec2.sh"
echo ""

