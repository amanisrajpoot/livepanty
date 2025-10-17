const mediasoup = require('mediasoup');
const logger = require('../utils/logger');
const { query } = require('../database/connection');
const EventEmitter = require('events');

class ScalableStreamingService extends EventEmitter {
  constructor() {
    super();
    this.workers = [];
    this.routers = new Map();
    this.rooms = new Map();
    this.nextWorkerIndex = 0;
    this.isInitialized = false;
    
    // Performance tracking
    this.stats = {
      totalConnections: 0,
      activeStreams: 0,
      totalRooms: 0,
      workerLoad: []
    };

    // Connection limits per room
    this.maxConnectionsPerRoom = parseInt(process.env.MAX_CONNECTIONS_PER_ROOM) || 1000;
    this.maxWorkers = parseInt(process.env.MAX_WORKERS) || 4;
    
    // Auto-scaling configuration
    this.autoScale = process.env.AUTO_SCALE_WORKERS === 'true';
    this.scaleThreshold = 0.8; // Scale when worker load > 80%
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing scalable mediasoup streaming service...');

      // Create initial workers
      const numWorkers = Math.min(2, this.maxWorkers);
      
      for (let i = 0; i < numWorkers; i++) {
        await this.createWorker(i);
      }

      // Start performance monitoring
      this.startPerformanceMonitoring();

      this.isInitialized = true;
      logger.info(`Scalable streaming service initialized with ${this.workers.length} workers`);
    } catch (error) {
      logger.error('Failed to initialize scalable streaming service:', error);
      throw error;
    }
  }

  async createWorker(workerId) {
    try {
      const worker = await mediasoup.createWorker({
        logLevel: 'warn',
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
        rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT) || 40000 + (workerId * 1000),
        rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT) || 49999 - (workerId * 1000),
        appData: { workerId }
      });

      worker.on('died', () => {
        logger.error(`Worker ${worker.pid} died, restarting...`);
        this.restartWorker(workerId);
      });

      this.workers[workerId] = worker;
      this.stats.workerLoad[workerId] = 0;
      
      logger.info(`Created worker ${worker.pid} (ID: ${workerId})`);
      return worker;
    } catch (error) {
      logger.error(`Failed to create worker ${workerId}:`, error);
      throw error;
    }
  }

  async restartWorker(workerId) {
    try {
      if (this.workers[workerId]) {
        this.workers[workerId].close();
      }
      
      await this.createWorker(workerId);
      logger.info(`Restarted worker ${workerId}`);
    } catch (error) {
      logger.error(`Failed to restart worker ${workerId}:`, error);
    }
  }

  getOptimalWorker() {
    // Find worker with lowest load
    let minLoad = Infinity;
    let optimalWorker = null;
    let optimalIndex = 0;

    for (let i = 0; i < this.workers.length; i++) {
      if (this.workers[i] && this.stats.workerLoad[i] < minLoad) {
        minLoad = this.stats.workerLoad[i];
        optimalWorker = this.workers[i];
        optimalIndex = i;
      }
    }

    return { worker: optimalWorker, index: optimalIndex };
  }

  async scaleWorkers() {
    if (!this.autoScale || this.workers.length >= this.maxWorkers) {
      return;
    }

    const avgLoad = this.stats.workerLoad.reduce((sum, load) => sum + load, 0) / this.workers.length;
    
    if (avgLoad > this.scaleThreshold) {
      const newWorkerId = this.workers.length;
      try {
        await this.createWorker(newWorkerId);
        logger.info(`Auto-scaled: Added worker ${newWorkerId} (total: ${this.workers.length})`);
      } catch (error) {
        logger.error(`Failed to auto-scale worker:`, error);
      }
    }
  }

  async createRoom(roomId, streamId) {
    try {
      if (this.rooms.has(roomId)) {
        return this.rooms.get(roomId);
      }

      // Check if we need to scale workers
      await this.scaleWorkers();

      const { worker, index } = this.getOptimalWorker();
      if (!worker) {
        throw new Error('No available workers');
      }

      const router = await worker.createRouter({
        mediaCodecs: this.getOptimizedMediaCodecs()
      });

      // Create room with enhanced data structure
      const room = {
        id: roomId,
        streamId: streamId,
        router: router,
        workerIndex: index,
        producers: new Map(),
        consumers: new Map(),
        participants: new Map(),
        viewerCount: 0,
        performerCount: 0,
        createdAt: new Date(),
        lastActivity: new Date(),
        // Performance tracking
        stats: {
          totalConnections: 0,
          peakConnections: 0,
          totalDataTransferred: 0,
          averageLatency: 0
        }
      };

      this.routers.set(roomId, router);
      this.rooms.set(roomId, room);
      this.stats.workerLoad[index]++;
      this.stats.totalRooms++;
      this.stats.activeStreams++;

      logger.info(`Created scalable room ${roomId} on worker ${index} for stream ${streamId}`);
      return router;
    } catch (error) {
      logger.error(`Failed to create room ${roomId}:`, error);
      throw error;
    }
  }

  getOptimizedMediaCodecs() {
    return [
      // Optimized audio codec for high concurrency
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {
          minptime: 10,
          useinbandfec: 1,
          // Optimize for low latency
          'sprop-stereo': 1
        }
      },
      // Multiple video codecs for better compatibility
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 500, // Lower start bitrate for scalability
          'x-google-max-bitrate': 2000,
          'x-google-min-bitrate': 100
        }
      },
      {
        kind: 'video',
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: {
          'profile-id': 2,
          'x-google-start-bitrate': 500,
          'x-google-max-bitrate': 2000
        }
      },
      {
        kind: 'video',
        mimeType: 'video/h264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '4d0032',
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 500,
          'x-google-max-bitrate': 2000
        }
      }
    ];
  }

  async getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  async addParticipant(roomId, socketId, role = 'viewer') {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      // Check connection limits
      if (room.participants.size >= this.maxConnectionsPerRoom) {
        throw new Error('Room is at maximum capacity');
      }

      const participant = {
        socketId,
        role,
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
        joinedAt: new Date(),
        lastActivity: new Date()
      };

      room.participants.set(socketId, participant);
      room.stats.totalConnections++;
      room.stats.peakConnections = Math.max(room.stats.peakConnections, room.participants.size);
      
      if (role === 'performer') {
        room.performerCount++;
      } else {
        room.viewerCount++;
      }

      room.lastActivity = new Date();
      this.stats.totalConnections++;

      logger.info(`Added ${role} participant to room ${roomId} (total: ${room.participants.size})`);
      return participant;
    } catch (error) {
      logger.error(`Failed to add participant to room ${roomId}:`, error);
      throw error;
    }
  }

  async removeParticipant(roomId, socketId) {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        return;
      }

      const participant = room.participants.get(socketId);
      if (!participant) {
        return;
      }

      // Close all transports
      for (const transport of participant.transports.values()) {
        transport.close();
      }

      // Close all producers
      for (const producer of participant.producers.values()) {
        producer.close();
        room.producers.delete(producer.id);
      }

      // Close all consumers
      for (const consumer of participant.consumers.values()) {
        consumer.close();
        room.consumers.delete(consumer.id);
      }

      // Update room stats
      room.participants.delete(socketId);
      room.stats.totalConnections--;
      
      if (participant.role === 'performer') {
        room.performerCount--;
      } else {
        room.viewerCount--;
      }

      this.stats.totalConnections--;

      // Clean up empty room
      if (room.participants.size === 0) {
        await this.deleteRoom(roomId);
      }

      logger.info(`Removed participant from room ${roomId} (remaining: ${room.participants.size})`);
    } catch (error) {
      logger.error(`Failed to remove participant from room ${roomId}:`, error);
    }
  }

  async createTransport(roomId, socketId, direction) {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      const participant = room.participants.get(socketId);
      if (!participant) {
        throw new Error('Participant not found');
      }

      // Optimized transport configuration for high concurrency
      const transport = await room.router.createWebRtcTransport({
        listenIps: [
          {
            ip: '0.0.0.0',
            announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1'
          }
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        // Optimized for high concurrency
        initialAvailableOutgoingBitrate: 500000, // Reduced for scalability
        minimumAvailableOutgoingBitrate: 100000,
        maxSctpMessageSize: 262144,
        // ICE configuration for better connectivity
        iceConsentTimeout: 30,
        iceGatheringTimeout: 15
      });

      participant.transports.set(direction, transport);

      // Handle transport events
      transport.on('dtlsstatechange', (dtlsState) => {
        if (dtlsState === 'closed') {
          transport.close();
        }
      });

      transport.on('@close', () => {
        participant.transports.delete(direction);
      });

      return transport;
    } catch (error) {
      logger.error(`Failed to create transport for room ${roomId}:`, error);
      throw error;
    }
  }

  async createProducer(roomId, socketId, kind, rtpParameters) {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      const participant = room.participants.get(socketId);
      if (!participant) {
        throw new Error('Participant not found');
      }

      const sendTransport = participant.transports.get('send');
      if (!sendTransport) {
        throw new Error('Send transport not found');
      }

      const producer = await sendTransport.produce({
        kind,
        rtpParameters,
        appData: {
          socketId,
          roomId,
          participantRole: participant.role
        }
      });

      // Store producer
      room.producers.set(producer.id, producer);
      participant.producers.set(producer.id, producer);

      // Handle producer events
      producer.on('transportclose', () => {
        room.producers.delete(producer.id);
        participant.producers.delete(producer.id);
      });

      producer.on('@close', () => {
        room.producers.delete(producer.id);
        participant.producers.delete(producer.id);
      });

      return producer;
    } catch (error) {
      logger.error(`Failed to create producer for room ${roomId}:`, error);
      throw error;
    }
  }

  async createConsumer(roomId, socketId, producerId, rtpCapabilities) {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      const participant = room.participants.get(socketId);
      if (!participant) {
        throw new Error('Participant not found');
      }

      const recvTransport = participant.transports.get('recv');
      if (!recvTransport) {
        throw new Error('Receive transport not found');
      }

      const producer = room.producers.get(producerId);
      if (!producer) {
        throw new Error('Producer not found');
      }

      if (!room.router.canConsume({ producerId, rtpCapabilities })) {
        throw new Error('Cannot consume this producer');
      }

      const consumer = await recvTransport.consume({
        producerId,
        rtpCapabilities,
        paused: false
      });

      // Store consumer
      room.consumers.set(consumer.id, consumer);
      participant.consumers.set(consumer.id, consumer);

      // Handle consumer events
      consumer.on('transportclose', () => {
        room.consumers.delete(consumer.id);
        participant.consumers.delete(consumer.id);
      });

      consumer.on('@close', () => {
        room.consumers.delete(consumer.id);
        participant.consumers.delete(consumer.id);
      });

      return consumer;
    } catch (error) {
      logger.error(`Failed to create consumer for room ${roomId}:`, error);
      throw error;
    }
  }

  async deleteRoom(roomId) {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        return;
      }

      // Close all producers and consumers
      for (const producer of room.producers.values()) {
        producer.close();
      }
      for (const consumer of room.consumers.values()) {
        consumer.close();
      }

      // Close router
      room.router.close();
      
      // Update worker load
      this.stats.workerLoad[room.workerIndex]--;
      
      this.rooms.delete(roomId);
      this.routers.delete(roomId);
      this.stats.totalRooms--;
      this.stats.activeStreams--;
      
      logger.info(`Deleted room ${roomId}`);
    } catch (error) {
      logger.error(`Failed to delete room ${roomId}:`, error);
    }
  }

  startPerformanceMonitoring() {
    setInterval(() => {
      this.updateStats();
      this.emit('stats', this.stats);
    }, 10000); // Update every 10 seconds

    // Cleanup inactive rooms every 5 minutes
    setInterval(() => {
      this.cleanupInactiveRooms();
    }, 300000);
  }

  updateStats() {
    this.stats.totalConnections = 0;
    this.stats.activeStreams = this.rooms.size;
    this.stats.totalRooms = this.rooms.size;

    for (const room of this.rooms.values()) {
      this.stats.totalConnections += room.participants.size;
    }

    // Update worker load
    for (let i = 0; i < this.workers.length; i++) {
      if (this.workers[i]) {
        this.stats.workerLoad[i] = this.rooms.size / this.workers.length;
      }
    }
  }

  async cleanupInactiveRooms() {
    const now = new Date();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

    for (const [roomId, room] of this.rooms) {
      if (now - room.lastActivity > inactiveThreshold && room.participants.size === 0) {
        await this.deleteRoom(roomId);
        logger.info(`Cleaned up inactive room ${roomId}`);
      }
    }
  }

  getStats() {
    return {
      ...this.stats,
      rooms: Array.from(this.rooms.values()).map(room => ({
        id: room.id,
        streamId: room.streamId,
        participants: room.participants.size,
        performers: room.performerCount,
        viewers: room.viewerCount,
        createdAt: room.createdAt,
        lastActivity: room.lastActivity
      }))
    };
  }

  async cleanup() {
    try {
      // Close all rooms
      for (const [roomId, room] of this.rooms) {
        await this.deleteRoom(roomId);
      }

      // Close all workers
      for (const worker of this.workers) {
        if (worker) {
          worker.close();
        }
      }

      this.workers = [];
      this.routers.clear();
      this.rooms.clear();
      this.isInitialized = false;

      logger.info('Scalable streaming service cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup scalable streaming service:', error);
    }
  }
}

module.exports = new ScalableStreamingService();
