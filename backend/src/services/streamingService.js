const mediasoup = require('mediasoup');
const logger = require('../utils/logger');
const { query } = require('../database/connection');

class StreamingService {
  constructor() {
    this.workers = [];
    this.routers = new Map();
    this.rooms = new Map();
    this.nextWorkerIndex = 0;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing mediasoup streaming service...');

      // Create mediasoup workers
      const numWorkers = parseInt(process.env.MEDIASOUP_NUM_WORKERS) || 2;
      
      for (let i = 0; i < numWorkers; i++) {
        const worker = await mediasoup.createWorker({
          logLevel: 'warn',
          logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
          rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT) || 40000,
          rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT) || 49999,
          appData: { workerId: i }
        });

        worker.on('died', () => {
          logger.error(`Mediasoup worker ${worker.pid} died, restarting...`);
          this.restartWorker(i);
        });

        this.workers.push(worker);
        logger.info(`Created mediasoup worker ${worker.pid} (${i + 1}/${numWorkers})`);
      }

      this.isInitialized = true;
      logger.info('Mediasoup streaming service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize mediasoup streaming service:', error);
      throw error;
    }
  }

  async restartWorker(workerIndex) {
    try {
      const worker = await mediasoup.createWorker({
        logLevel: 'warn',
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
        rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT) || 40000,
        rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT) || 49999,
        appData: { workerId: workerIndex }
      });

      worker.on('died', () => {
        logger.error(`Mediasoup worker ${worker.pid} died again, restarting...`);
        this.restartWorker(workerIndex);
      });

      this.workers[workerIndex] = worker;
      logger.info(`Restarted mediasoup worker ${worker.pid} at index ${workerIndex}`);
    } catch (error) {
      logger.error(`Failed to restart worker ${workerIndex}:`, error);
    }
  }

  getNextWorker() {
    const worker = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  async createRoom(roomId, streamId) {
    try {
      if (this.routers.has(roomId)) {
        return this.routers.get(roomId);
      }

      const worker = this.getNextWorker();
      const router = await worker.createRouter({
        mediaCodecs: [
          {
            kind: 'audio',
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
            parameters: {
              minptime: 10,
              useinbandfec: 1
            }
          },
          {
            kind: 'video',
            mimeType: 'video/VP8',
            clockRate: 90000,
            parameters: {
              'x-google-start-bitrate': 1000
            }
          },
          {
            kind: 'video',
            mimeType: 'video/VP9',
            clockRate: 90000,
            parameters: {
              'profile-id': 2,
              'x-google-start-bitrate': 1000
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
              'x-google-start-bitrate': 1000
            }
          }
        ]
      });

      this.routers.set(roomId, router);
      
      // Create room data structure
      this.rooms.set(roomId, {
        id: roomId,
        streamId: streamId,
        router: router,
        producers: new Map(),
        consumers: new Map(),
        participants: new Map(),
        createdAt: new Date()
      });

      logger.info(`Created streaming room ${roomId} for stream ${streamId}`);
      return router;
    } catch (error) {
      logger.error(`Failed to create room ${roomId}:`, error);
      throw error;
    }
  }

  async getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  async deleteRoom(roomId) {
    try {
      const room = this.rooms.get(roomId);
      if (room) {
        // Close all producers and consumers
        for (const producer of room.producers.values()) {
          producer.close();
        }
        for (const consumer of room.consumers.values()) {
          consumer.close();
        }

        // Close router
        room.router.close();
        
        this.rooms.delete(roomId);
        this.routers.delete(roomId);
        
        logger.info(`Deleted streaming room ${roomId}`);
      }
    } catch (error) {
      logger.error(`Failed to delete room ${roomId}:`, error);
    }
  }

  async createTransport(roomId, direction, socketId) {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

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
        initialAvailableOutgoingBitrate: 1000000
      });

      // Store transport in room
      if (!room.participants.has(socketId)) {
        room.participants.set(socketId, {
          socketId,
          transports: new Map(),
          producers: new Map(),
          consumers: new Map()
        });
      }

      const participant = room.participants.get(socketId);
      participant.transports.set(direction, transport);

      // Handle transport events
      transport.on('dtlsstatechange', (dtlsState) => {
        if (dtlsState === 'closed') {
          transport.close();
        }
      });

      transport.on('@close', () => {
        participant.transports.delete(direction);
        if (participant.transports.size === 0) {
          room.participants.delete(socketId);
        }
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
          roomId
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

      return consumer;
    } catch (error) {
      logger.error(`Failed to create consumer for room ${roomId}:`, error);
      throw error;
    }
  }

  async getRouterRtpCapabilities(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }
    return room.router.rtpCapabilities;
  }

  async getProducers(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return [];
    }
    return Array.from(room.producers.keys());
  }

  async updateStreamStatus(streamId, status) {
    try {
      await query(`
        UPDATE streams 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
      `, [status, streamId]);
      
      logger.info(`Updated stream ${streamId} status to ${status}`);
    } catch (error) {
      logger.error(`Failed to update stream status:`, error);
      throw error;
    }
  }

  async getStreamInfo(streamId) {
    try {
      const result = await query(`
        SELECT s.*, u.display_name as host_name, u.profile_image_url as host_avatar
        FROM streams s
        JOIN users u ON s.host_id = u.id
        WHERE s.id = $1
      `, [streamId]);

      return result.rows[0];
    } catch (error) {
      logger.error(`Failed to get stream info:`, error);
      throw error;
    }
  }

  async incrementViewerCount(streamId) {
    try {
      await query(`
        UPDATE streams 
        SET viewer_count = viewer_count + 1, updated_at = NOW()
        WHERE id = $1
      `, [streamId]);
    } catch (error) {
      logger.error(`Failed to increment viewer count:`, error);
    }
  }

  async decrementViewerCount(streamId) {
    try {
      await query(`
        UPDATE streams 
        SET viewer_count = GREATEST(viewer_count - 1, 0), updated_at = NOW()
        WHERE id = $1
      `, [streamId]);
    } catch (error) {
      logger.error(`Failed to decrement viewer count:`, error);
    }
  }

  async cleanup() {
    try {
      // Close all rooms
      for (const [roomId, room] of this.rooms) {
        await this.deleteRoom(roomId);
      }

      // Close all workers
      for (const worker of this.workers) {
        worker.close();
      }

      this.workers = [];
      this.routers.clear();
      this.rooms.clear();
      this.isInitialized = false;

      logger.info('Streaming service cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup streaming service:', error);
    }
  }
}

module.exports = new StreamingService();
