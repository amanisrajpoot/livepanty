#!/bin/bash

# Live Streaming Tipping Platform - Setup Script
# This script sets up the complete development environment

set -e

echo "🚀 Setting up Live Streaming Tipping Platform POC..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_requirements() {
    print_status "Checking system requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node --version)"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker from https://docker.com/"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose."
        exit 1
    fi
    
    print_success "All requirements satisfied"
}

# Install dependencies for all services
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Signaling server
    print_status "Installing signaling server dependencies..."
    cd signaling-server
    npm install
    cd ..
    
    # SFU server
    print_status "Installing SFU server dependencies..."
    cd sfu-server
    npm install
    cd ..
    
    # Web client
    print_status "Installing web client dependencies..."
    cd web-client
    npm install
    cd ..
    
    print_success "Dependencies installed successfully"
}

# Setup environment files
setup_environment() {
    print_status "Setting up environment files..."
    
    # Create .env files if they don't exist
    if [ ! -f .env ]; then
        cat > .env << EOF
# Environment
NODE_ENV=development

# Database
DATABASE_URL=postgresql://livepanty:livepanty123@localhost:5432/livepanty

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Client URL
CLIENT_URL=http://localhost:3000

# TURN Servers
TURN_SERVERS=turn:livepanty:livepanty123@localhost:3478

# Mediasoup
MEDIASOUP_NUM_WORKERS=1
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=49999
ANNOUNCED_IP=127.0.0.1
EOF
        print_success "Created .env file"
    else
        print_warning ".env file already exists, skipping..."
    fi
    
    # Copy environment files to services
    cp .env signaling-server/.env
    cp .env sfu-server/.env
    cp .env web-client/.env
    
    print_success "Environment files configured"
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    # Start PostgreSQL container
    docker-compose up -d postgres
    
    # Wait for database to be ready
    print_status "Waiting for database to be ready..."
    sleep 10
    
    # Run database migrations
    print_status "Running database migrations..."
    docker-compose exec postgres psql -U livepanty -d livepanty -f /docker-entrypoint-initdb.d/schema.sql
    
    print_success "Database setup complete"
}

# Setup TURN server
setup_turn_server() {
    print_status "Setting up TURN server..."
    
    # Create TURN server configuration
    cat > turnserver.conf << EOF
# TURN server configuration
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
external-ip=127.0.0.1
realm=livepanty.com
server-name=livepanty.com
lt-cred-mech
user=livepanty:livepanty123
no-tlsv1
no-tlsv1_1
no-tlsv1_2
log-file=stdout
verbose
fingerprint
no-multicast-peers
no-cli
no-tlsv1_3
EOF
    
    print_success "TURN server configuration created"
}

# Start infrastructure services
start_infrastructure() {
    print_status "Starting infrastructure services..."
    
    # Start Redis, PostgreSQL, and TURN server
    docker-compose up -d redis postgres coturn
    
    # Wait for services to be ready
    print_status "Waiting for services to start..."
    sleep 15
    
    print_success "Infrastructure services started"
}

# Build and start application services
start_application() {
    print_status "Starting application services..."
    
    # Start signaling server in background
    print_status "Starting signaling server..."
    cd signaling-server
    npm run dev &
    SIGNALING_PID=$!
    cd ..
    
    # Wait a moment for signaling server to start
    sleep 5
    
    # Start SFU server in background
    print_status "Starting SFU server..."
    cd sfu-server
    npm run dev &
    SFU_PID=$!
    cd ..
    
    # Wait a moment for SFU server to start
    sleep 5
    
    # Start web client
    print_status "Starting web client..."
    cd web-client
    npm start &
    CLIENT_PID=$!
    cd ..
    
    # Store PIDs for cleanup
    echo $SIGNALING_PID > .signaling.pid
    echo $SFU_PID > .sfu.pid
    echo $CLIENT_PID > .client.pid
    
    print_success "Application services started"
    print_status "PIDs: Signaling=$SIGNALING_PID, SFU=$SFU_PID, Client=$CLIENT_PID"
}

# Create startup scripts
create_scripts() {
    print_status "Creating startup scripts..."
    
    # Create start script
    cat > start.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Live Streaming Tipping Platform..."

# Start infrastructure
docker-compose up -d redis postgres coturn

# Wait for infrastructure
sleep 10

# Start application services
cd signaling-server && npm run dev &
cd ../sfu-server && npm run dev &
cd ../web-client && npm start &

echo "✅ All services started!"
echo "🌐 Web client: http://localhost:3000"
echo "📡 Signaling server: http://localhost:3001"
echo "🎥 SFU server: http://localhost:3002"
EOF
    chmod +x start.sh
    
    # Create stop script
    cat > stop.sh << 'EOF'
#!/bin/bash
echo "🛑 Stopping Live Streaming Tipping Platform..."

# Stop application services
pkill -f "npm run dev"
pkill -f "npm start"

# Stop infrastructure
docker-compose down

echo "✅ All services stopped!"
EOF
    chmod +x stop.sh
    
    print_success "Startup scripts created"
}

# Main setup function
main() {
    print_status "Starting setup process..."
    
    check_requirements
    install_dependencies
    setup_environment
    setup_turn_server
    start_infrastructure
    setup_database
    create_scripts
    
    print_success "🎉 Setup complete!"
    print_status ""
    print_status "Next steps:"
    print_status "1. Run './start.sh' to start all services"
    print_status "2. Open http://localhost:3000 in your browser"
    print_status "3. Register a new account"
    print_status "4. Create a stream and test with multiple browser tabs"
    print_status ""
    print_status "To stop all services, run './stop.sh'"
    print_status ""
    print_warning "Remember to:"
    print_warning "- Change JWT_SECRET in production"
    print_warning "- Configure proper TURN servers for production"
    print_warning "- Set up SSL certificates for HTTPS"
    print_warning "- Configure firewall rules for RTC ports (40000-49999)"
}

# Run main function
main "$@"
