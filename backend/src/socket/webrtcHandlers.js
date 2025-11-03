const logger = require('../utils/logger');
const scalableStreamingService = require('../services/scalableStreamingService');
const jwt = require('jsonwebtoken');
const { query } = require('../database/connection');

// Store active transports and producers/consumers per socket
const socketData = new Map();

// Simple JWT verification for socket authentication
const verifySocketJWT = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const result = await query(
      'SELECT id, email, display_name, username, role, status FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error('Socket JWT verification error:', error);
    throw new Error('Invalid token');
  }
};

const setupWebRTCHandlers = (io) => {
  // Authentication middleware - allow optional auth for guests
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        // Allow guest connections for viewing
        socket.userId = null;
        socket.user = null;
        socket.isGuest = true;
        return next();
      }

      try {
        const user = await verifySocketJWT(token);
        socket.userId = user.id;
        socket.user = user;
        socket.isGuest = false;
      } catch (error) {
        // Invalid token - treat as guest
        logger.debug('WebRTC authentication failed, allowing guest access:', error.message);
        socket.userId = null;
        socket.user = null;
        socket.isGuest = true;
      }
      
      next();
    } catch (error) {
      logger.error('WebRTC authentication error:', error);
      // Allow guest connections even on error
      socket.userId = null;
      socket.user = null;
      socket.isGuest = true;
      next();
    }
  });

  io.on('connection', (socket) => {
    logger.info(`WebRTC client connected: ${socket.id} (User: ${socket.userId})`);

    // Initialize socket data
    socketData.set(socket.id, {
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
      currentRoom: null
    });

    // Create or join room
    socket.on('join_room', async (roomData, callback) => {
      try {
        const { roomId } = roomData;
        
        if (!roomId) {
          return callback({ error: 'Room ID is required' });
        }

        logger.info(`Creating/joining room: ${roomId}`);
        
        // Create or get room using scalable streaming service
        let mediasoupRoom = await scalableStreamingService.getRoom(roomId);
        if (!mediasoupRoom) {
          await scalableStreamingService.createRoom(roomId, roomId);
          mediasoupRoom = await scalableStreamingService.getRoom(roomId);
        }
        
        // Determine role
        const role = socket.user?.role === 'performer' ? 'performer' : 'viewer';
        
        // Add participant
        await scalableStreamingService.addParticipant(roomId, socket.id, role);
        
        // Store current room
        const userSocketData = socketData.get(socket.id);
        userSocketData.currentRoom = roomId;

        // Join socket room for broadcasting
        socket.join(roomId);

        callback({
          success: true,
          roomId: roomId,
          rtpCapabilities: mediasoupRoom.router.rtpCapabilities,
          existingProducers: Array.from(mediasoupRoom.producers.keys())
        });

        // Notify others in the room
        socket.to(roomId).emit('user_joined', {
          userId: socket.userId,
          socketId: socket.id,
          displayName: socket.user.display_name
        });

        logger.info(`User ${socket.userId} joined room ${roomId}`);
      } catch (error) {
        logger.error('Error joining room:', error);
        callback({ error: 'Failed to join room' });
      }
    });

    // Create WebRTC transport
    socket.on('webrtc_create_transport', async (transportData, callback) => {
      try {
        const { direction } = transportData; // 'send' or 'recv'
        const data = socketData.get(socket.id);
        
        if (!data.currentRoom) {
          return callback({ error: 'Not in a room' });
        }

        // Create transport using scalable streaming service
        const transport = await scalableStreamingService.createTransport(
          data.currentRoom,
          socket.id,
          direction
        );

        // Store transport info
        data.transports.set(direction, {
          id: transport.id,
          direction: direction,
          transport: transport // Store actual transport object
        });

        callback({
          success: true,
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters
        });

        logger.info(`Created ${direction} transport ${transport.id} for user ${socket.userId}`);
      } catch (error) {
        logger.error('Error creating transport:', error);
        callback({ error: 'Failed to create transport' });
      }
    });

    // Connect WebRTC transport
    socket.on('webrtc_connect_transport', async (connectData, callback) => {
      try {
        const { transportId, dtlsParameters } = connectData;
        const data = socketData.get(socket.id);
        
        if (!data.currentRoom) {
          return callback({ error: 'Not in a room' });
        }

        // Get transport from stored data by transportId
        let transportData = null;
        for (const [dir, transportInfo] of data.transports) {
          if (transportInfo.id === transportId) {
            transportData = transportInfo;
            break;
          }
        }
        
        if (!transportData || !transportData.transport) {
          return callback({ error: 'Transport not found' });
        }
        
        // Connect transport
        await transportData.transport.connect({ dtlsParameters });

        callback({ success: true });
        logger.info(`Transport ${transportId} connected for user ${socket.userId}`);
      } catch (error) {
        logger.error('Error connecting transport:', error);
        callback({ error: 'Failed to connect transport' });
      }
    });

    // Create producer (for sending media)
    socket.on('webrtc_create_producer', async (producerData, callback) => {
      try {
        const { kind, rtpParameters } = producerData;
        const data = socketData.get(socket.id);
        
        if (!data.currentRoom) {
          return callback({ error: 'Not in a room' });
        }

        const sendTransport = data.transports.get('send');
        if (!sendTransport) {
          return callback({ error: 'Send transport not found' });
        }

        // Create producer using scalable streaming service
        const producer = await scalableStreamingService.createProducer(
          data.currentRoom,
          socket.id,
          kind,
          rtpParameters
        );

        // Store producer info
        data.producers.set(producer.id, {
          id: producer.id,
          kind: kind,
          userId: socket.userId,
          producer: producer
        });

        // Notify others in the room
        socket.to(data.currentRoom).emit('new_producer', {
          producerId: producer.id,
          userId: socket.userId,
          kind: kind
        });

        callback({
          success: true,
          id: producer.id
        });

        logger.info(`Producer ${producer.id} created for user ${socket.userId}`);
      } catch (error) {
        logger.error('Error creating producer:', error);
        callback({ error: 'Failed to create producer' });
      }
    });

    // Create consumer (for receiving media)
    socket.on('webrtc_create_consumer', async (consumerData, callback) => {
      try {
        const { producerId, rtpCapabilities } = consumerData;
        const data = socketData.get(socket.id);
        
        if (!data.currentRoom) {
          return callback({ error: 'Not in a room' });
        }

        const recvTransport = data.transports.get('recv');
        if (!recvTransport) {
          return callback({ error: 'Receive transport not found' });
        }

        // Create consumer using scalable streaming service
        const consumer = await scalableStreamingService.createConsumer(
          data.currentRoom,
          socket.id,
          producerId,
          rtpCapabilities
        );

        // Store consumer info
        data.consumers.set(consumer.id, {
          id: consumer.id,
          producerId: producerId,
          userId: socket.userId,
          consumer: consumer
        });

        callback({
          success: true,
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

    // Handle room leaving
    socket.on('leave_room', (roomData) => {
      const data = socketData.get(socket.id);
      if (data.currentRoom) {
        socket.leave(data.currentRoom);
        
        // Notify others in the room
        socket.to(data.currentRoom).emit('user_left', {
          userId: socket.userId,
          socketId: socket.id
        });

        logger.info(`User ${socket.userId} left room ${data.currentRoom}`);
        data.currentRoom = null;
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      const data = socketData.get(socket.id);
      if (data && data.currentRoom) {
        // Notify others in the room
        socket.to(data.currentRoom).emit('user_left', {
          userId: socket.userId,
          socketId: socket.id
        });
      }

      // Clean up socket data
      socketData.delete(socket.id);
      logger.info(`WebRTC client disconnected: ${socket.id}`);
    });
  });
};

module.exports = setupWebRTCHandlers;
