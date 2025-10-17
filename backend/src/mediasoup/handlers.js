const mediasoup = require('mediasoup');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { mediasoupConfig } = require('../config/mediasoup');

// Store active rooms and producers/consumers
const rooms = new Map();
const producers = new Map();
const consumers = new Map();

// Get next available worker
const getNextWorker = () => {
  const worker = mediasoupConfig.workers[mediasoupConfig.nextWorkerIndex];
  mediasoupConfig.nextWorkerIndex = (mediasoupConfig.nextWorkerIndex + 1) % mediasoupConfig.workers.length;
  return worker;
};

// Create or get router for a room
const getOrCreateRouter = async (roomId) => {
  if (mediasoupConfig.routers[roomId]) {
    return mediasoupConfig.routers[roomId];
  }

  const worker = getNextWorker();
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

  mediasoupConfig.routers[roomId] = router;
  logger.info(`Created router for room ${roomId} on worker ${worker.pid}`);
  return router;
};

// Setup mediasoup handlers
const setupMediasoupHandlers = (io) => {
  io.on('connection', (socket) => {
    logger.info(`SFU client connected: ${socket.id}`);

    // Handle room creation/joining
    socket.on('create_room', async (data, callback) => {
      try {
        const { roomId } = data;
        
        if (rooms.has(roomId)) {
          return callback({ error: 'Room already exists' });
        }

        const router = await getOrCreateRouter(roomId);
        const room = {
          id: roomId,
          router: router,
          producers: new Map(),
          consumers: new Map(),
          rtpCapabilities: router.rtpCapabilities,
          createdAt: new Date()
        };

        rooms.set(roomId, room);

        logger.info(`Room ${roomId} created`);
        callback({
          roomId: roomId,
          rtpCapabilities: router.rtpCapabilities
        });
      } catch (error) {
        logger.error('Error creating room:', error);
        callback({ error: 'Failed to create room' });
      }
    });

    socket.on('join_room', async (data, callback) => {
      try {
        const { roomId } = data;
        
        let room = rooms.get(roomId);
        if (!room) {
          // Create room if it doesn't exist
          const router = await getOrCreateRouter(roomId);
          room = {
            id: roomId,
            router: router,
            producers: new Map(),
            consumers: new Map(),
            rtpCapabilities: router.rtpCapabilities,
            createdAt: new Date()
          };
          rooms.set(roomId, room);
        }

        // Send room RTP capabilities to client
        callback({
          roomId: roomId,
          rtpCapabilities: room.router.rtpCapabilities,
          existingProducers: Array.from(room.producers.keys())
        });

        // Notify others in the room
        socket.to(roomId).emit('user_joined', {
          userId: socket.userId,
          socketId: socket.id
        });

        logger.info(`User ${socket.userId} joined room ${roomId}`);
      } catch (error) {
        logger.error('Error joining room:', error);
        callback({ error: 'Failed to join room' });
      }
    });

    // Handle transport creation
    socket.on('create_transport', async (data, callback) => {
      try {
        const { roomId, direction } = data; // direction: 'send' or 'recv'
        
        const room = rooms.get(roomId);
        if (!room) {
          return callback({ error: 'Room not found' });
        }

        const transport = await room.router.createWebRtcTransport({
          listenIps: [
            {
              ip: '0.0.0.0',
              announcedIp: process.env.ANNOUNCED_IP || '127.0.0.1'
            }
          ],
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
          initialAvailableOutgoingBitrate: 1000000
        });

        // Store transport info
        socket.transports = socket.transports || {};
        socket.transports[direction] = transport;

        // Handle transport events
        transport.on('dtlsstatechange', (dtlsState) => {
          if (dtlsState === 'closed') {
            transport.close();
          }
        });

        transport.on('@close', () => {
          delete socket.transports[direction];
        });

        callback({
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters
        });

        logger.info(`Created ${direction} transport ${transport.id} for room ${roomId}`);
      } catch (error) {
        logger.error('Error creating transport:', error);
        callback({ error: 'Failed to create transport' });
      }
    });

    // Handle transport connection
    socket.on('connect_transport', async (data, callback) => {
      try {
        const { transportId, dtlsParameters } = data;
        
        const transport = Object.values(socket.transports || {}).find(t => t.id === transportId);
        if (!transport) {
          return callback({ error: 'Transport not found' });
        }

        await transport.connect({ dtlsParameters });
        callback({ success: true });

        logger.info(`Transport ${transportId} connected`);
      } catch (error) {
        logger.error('Error connecting transport:', error);
        callback({ error: 'Failed to connect transport' });
      }
    });

    // Handle producer creation
    socket.on('create_producer', async (data, callback) => {
      try {
        const { roomId, kind, rtpParameters } = data;
        
        const room = rooms.get(roomId);
        if (!room) {
          return callback({ error: 'Room not found' });
        }

        const sendTransport = socket.transports?.send;
        if (!sendTransport) {
          return callback({ error: 'Send transport not found' });
        }

        const producer = await sendTransport.produce({
          kind: kind,
          rtpParameters: rtpParameters,
          appData: {
            userId: socket.userId,
            roomId: roomId
          }
        });

        // Store producer
        room.producers.set(producer.id, producer);
        producers.set(producer.id, producer);

        // Handle producer events
        producer.on('transportclose', () => {
          room.producers.delete(producer.id);
          producers.delete(producer.id);
          socket.to(roomId).emit('producer_closed', { producerId: producer.id });
        });

        // Notify other users in the room
        socket.to(roomId).emit('new_producer', {
          producerId: producer.id,
          userId: socket.userId,
          kind: kind
        });

        callback({ id: producer.id });

        logger.info(`Producer ${producer.id} created for user ${socket.userId} in room ${roomId}`);
      } catch (error) {
        logger.error('Error creating producer:', error);
        callback({ error: 'Failed to create producer' });
      }
    });

    // Handle consumer creation
    socket.on('create_consumer', async (data, callback) => {
      try {
        const { roomId, producerId, rtpCapabilities } = data;
        
        const room = rooms.get(roomId);
        if (!room) {
          return callback({ error: 'Room not found' });
        }

        const recvTransport = socket.transports?.recv;
        if (!recvTransport) {
          return callback({ error: 'Recv transport not found' });
        }

        // Check if router can consume this producer
        if (!room.router.canConsume({ producerId, rtpCapabilities })) {
          return callback({ error: 'Cannot consume this producer' });
        }

        const consumer = await recvTransport.consume({
          producerId: producerId,
          rtpCapabilities: rtpCapabilities,
          paused: false
        });

        // Store consumer
        room.consumers.set(consumer.id, consumer);
        consumers.set(consumer.id, consumer);

        // Handle consumer events
        consumer.on('transportclose', () => {
          room.consumers.delete(consumer.id);
          consumers.delete(consumer.id);
        });

        consumer.on('producerclose', () => {
          room.consumers.delete(consumer.id);
          consumers.delete(consumer.id);
          socket.emit('consumer_closed', { consumerId: consumer.id });
        });

        callback({
          id: consumer.id,
          producerId: producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          type: consumer.type,
          producerPaused: consumer.producerPaused
        });

        logger.info(`Consumer ${consumer.id} created for producer ${producerId}`);
      } catch (error) {
        logger.error('Error creating consumer:', error);
        callback({ error: 'Failed to create consumer' });
      }
    });

    // Handle consumer pause/resume
    socket.on('pause_consumer', async (data, callback) => {
      try {
        const { consumerId } = data;
        
        const consumer = consumers.get(consumerId);
        if (!consumer) {
          return callback({ error: 'Consumer not found' });
        }

        await consumer.pause();
        callback({ success: true });

        logger.info(`Consumer ${consumerId} paused`);
      } catch (error) {
        logger.error('Error pausing consumer:', error);
        callback({ error: 'Failed to pause consumer' });
      }
    });

    socket.on('resume_consumer', async (data, callback) => {
      try {
        const { consumerId } = data;
        
        const consumer = consumers.get(consumerId);
        if (!consumer) {
          return callback({ error: 'Consumer not found' });
        }

        await consumer.resume();
        callback({ success: true });

        logger.info(`Consumer ${consumerId} resumed`);
      } catch (error) {
        logger.error('Error resuming consumer:', error);
        callback({ error: 'Failed to resume consumer' });
      }
    });

    // Handle room leaving
    socket.on('leave_room', (data) => {
      const { roomId } = data;
      
      const room = rooms.get(roomId);
      if (room) {
        // Close all transports for this socket
        Object.values(socket.transports || {}).forEach(transport => {
          transport.close();
        });
        
        // Clean up producers and consumers
        room.producers.forEach((producer, producerId) => {
          if (producer.appData.userId === socket.userId) {
            room.producers.delete(producerId);
            producers.delete(producerId);
            producer.close();
          }
        });

        room.consumers.forEach((consumer, consumerId) => {
          if (room.consumers.has(consumerId)) {
            room.consumers.delete(consumerId);
            consumers.delete(consumerId);
            consumer.close();
          }
        });

        // Notify others in the room
        socket.to(roomId).emit('user_left', {
          userId: socket.userId,
          socketId: socket.id
        });

        // Clean up empty rooms
        if (room.producers.size === 0 && room.consumers.size === 0) {
          rooms.delete(roomId);
          delete mediasoupConfig.routers[roomId];
          logger.info(`Room ${roomId} cleaned up`);
        }
      }

      logger.info(`User ${socket.userId} left room ${roomId}`);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`SFU client disconnected: ${socket.id}`);
      
      // Clean up all rooms this socket was in
      rooms.forEach((room, roomId) => {
        // Close all transports
        Object.values(socket.transports || {}).forEach(transport => {
          transport.close();
        });
        
        // Clean up producers
        room.producers.forEach((producer, producerId) => {
          if (producer.appData.userId === socket.userId) {
            room.producers.delete(producerId);
            producers.delete(producerId);
            producer.close();
            socket.to(roomId).emit('producer_closed', { producerId: producerId });
          }
        });

        // Clean up consumers
        room.consumers.forEach((consumer, consumerId) => {
          if (room.consumers.has(consumerId)) {
            room.consumers.delete(consumerId);
            consumers.delete(consumerId);
            consumer.close();
          }
        });

        // Clean up empty rooms
        if (room.producers.size === 0 && room.consumers.size === 0) {
          rooms.delete(roomId);
          delete mediasoupConfig.routers[roomId];
        }
      });
    });
  });
};

// Utility functions
const getRoomStats = (roomId) => {
  const room = rooms.get(roomId);
  if (!room) return null;

  return {
    id: roomId,
    producers: room.producers.size,
    consumers: room.consumers.size,
    createdAt: room.createdAt
  };
};

const getAllRooms = () => {
  return Array.from(rooms.keys()).map(roomId => getRoomStats(roomId));
};

const closeRoom = (roomId) => {
  const room = rooms.get(roomId);
  if (room) {
    // Close all producers and consumers
    room.producers.forEach(producer => producer.close());
    room.consumers.forEach(consumer => consumer.close());
    
    // Delete room and router
    rooms.delete(roomId);
    delete mediasoupConfig.routers[roomId];
    
    logger.info(`Room ${roomId} closed`);
  }
};

module.exports = {
  setupMediasoupHandlers,
  getRoomStats,
  getAllRooms,
  closeRoom
};
