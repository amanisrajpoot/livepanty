# WebRTC Streaming POC Implementation Guide

## Overview
This guide provides a step-by-step implementation for setting up a WebRTC-based live streaming platform using mediasoup SFU. The POC demonstrates a performer broadcasting to multiple viewers with real-time tipping capabilities.

## Architecture
```
[Performer Browser] ←→ [Signaling Server] ←→ [mediasoup SFU] ←→ [Viewer Browsers]
                              ↓
                    [TURN/STUN Servers]
```

## Prerequisites
- Node.js 18+ and npm
- Docker and Docker Compose
- Basic understanding of WebRTC, Socket.IO, and mediasoup

## Quick Start

### 1. Clone and Setup
```bash
git clone <repository>
cd webrtc-poc
npm install
```

### 2. Start Infrastructure
```bash
docker-compose up -d
```

### 3. Start Services
```bash
# Terminal 1: Start signaling server
npm run dev:signaling

# Terminal 2: Start SFU server
npm run dev:sfu

# Terminal 3: Start web client
npm run dev:client
```

### 4. Access the Application
- Open http://localhost:3000
- Register/login as a performer
- Start streaming and test with multiple viewers

## Project Structure
```
webrtc-poc/
├── signaling-server/          # WebSocket signaling server
├── sfu-server/               # mediasoup SFU server
├── web-client/               # React frontend
├── shared/                   # Shared utilities and types
├── docker-compose.yml        # Infrastructure setup
└── README.md                # This file
```

## Implementation Details

### Signaling Server (WebSocket)
- Handles WebRTC offer/answer exchange
- Manages room creation and user joins
- Integrates with authentication system
- Real-time tip event broadcasting

### SFU Server (mediasoup)
- Media routing and distribution
- Scalable to thousands of viewers
- TURN server integration
- Bandwidth management

### Web Client (React)
- WebRTC peer connection management
- Real-time video streaming
- Tip sending and receiving
- Responsive UI for mobile/desktop

## Testing the POC

### Basic Flow Test
1. **Performer Setup**: Login and create a stream
2. **Viewer Join**: Open multiple browser tabs/windows
3. **Streaming Test**: Verify low latency (<500ms)
4. **Tip Test**: Send tips and verify real-time display
5. **Scalability Test**: Test with 10+ concurrent viewers

### Performance Metrics
- **Latency**: <500ms end-to-end
- **Bandwidth**: Adaptive bitrate (500kbps - 4Mbps)
- **Concurrent Users**: 100+ viewers per stream
- **CPU Usage**: <50% on modern hardware

## Production Considerations
- Use production TURN servers (coturn)
- Implement proper error handling
- Add monitoring and logging
- Scale SFU horizontally
- Use CDN for static assets

## Troubleshooting
See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

## Next Steps
After successful POC testing:
1. Integrate with main API backend
2. Add authentication and authorization
3. Implement recording capabilities
4. Add mobile app support
5. Deploy to production infrastructure
