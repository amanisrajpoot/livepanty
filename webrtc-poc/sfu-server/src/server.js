const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mediasoup = require('mediasoup');
const { createServer } = require('http');

const { setupMediasoupHandlers } = require('./mediasoup/handlers');
const { connectRedis } = require('./redis/connection');
const logger = require('./utils/logger');
const { mediasoupConfig } = require('./config/mediasoup');

// Load environment variables
require('dotenv').config();

const app = express();
const server = createServer(app);

// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json());

// Socket.IO setup
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mediasoup: {
      workers: mediasoupConfig.workers?.length || 0,
      routers: Object.keys(mediasoupConfig.routers || {}).length
    }
  });
});

// Mediasoup statistics endpoint
app.get('/stats', (req, res) => {
  const stats = {
    workers: mediasoupConfig.workers?.map(worker => ({
      pid: worker.pid,
      appData: worker.appData,
      closed: worker.closed
    })) || [],
    routers: Object.keys(mediasoupConfig.routers || {}).length,
    timestamp: new Date().toISOString()
  };
  res.json(stats);
});

// Initialize mediasoup
async function initializeMediasoup() {
  try {
    logger.info('Initializing mediasoup...');

    // Create mediasoup workers
    const numWorkers = parseInt(process.env.MEDIASOUP_NUM_WORKERS) || 1;
    mediasoupConfig.workers = [];
    mediasoupConfig.nextWorkerIndex = 0;

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: 'debug',
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
        rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT) || 40000,
        rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT) || 49999,
        appData: { workerId: i }
      });

      worker.on('died', () => {
        logger.error(`Mediasoup worker ${worker.pid} died, exiting in 2 seconds...`);
        setTimeout(() => process.exit(1), 2000);
      });

      mediasoupConfig.workers.push(worker);
      logger.info(`Created mediasoup worker ${worker.pid} (${i + 1}/${numWorkers})`);
    }

    // Initialize routers storage
    mediasoupConfig.routers = {};

    logger.info('Mediasoup initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize mediasoup:', error);
    process.exit(1);
  }
}

// Setup mediasoup handlers
setupMediasoupHandlers(io);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 3002;

async function startServer() {
  try {
    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected successfully');

    // Initialize mediasoup
    await initializeMediasoup();

    // Start HTTP server
    server.listen(PORT, () => {
      logger.info(`SFU server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Mediasoup workers: ${mediasoupConfig.workers.length}`);
      logger.info(`RTC port range: ${process.env.MEDIASOUP_MIN_PORT || 40000}-${process.env.MEDIASOUP_MAX_PORT || 49999}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, server, io };
