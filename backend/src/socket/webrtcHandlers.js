const logger = require('../utils/logger');
const webrtcService = require('../services/webrtcService');
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
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const user = await verifySocketJWT(token);
      socket.userId = user.id;
      socket.user = user;
      next();
    } catch (error) {
      logger.error('WebRTC authentication error:', error);
      next(new Error('Authentication failed'));
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
        
        // Create or get room
        const room = await webrtcService.createRoom(roomId);
        
        // Store current room
        const userSocketData = socketData.get(socket.id);
        userSocketData.currentRoom = roomId;

        // Join socket room for broadcasting
        socket.join(roomId);

        callback({
          success: true,
          roomId: roomId,
          rtpCapabilities: room.router.rtpCapabilities,
          existingProducers: Array.from(room.producers.keys())
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

        const transportInfo = await webrtcService.createWebRtcTransport(
          data.currentRoom, 
          direction
        );

        // Store transport info
        data.transports.set(direction, {
          id: transportInfo.id,
          direction: direction
        });

        callback({
          success: true,
          id: transportInfo.id,
          iceParameters: transportInfo.iceParameters,
          iceCandidates: transportInfo.iceCandidates,
          dtlsParameters: transportInfo.dtlsParameters
        });

        logger.info(`Created ${direction} transport ${transportInfo.id} for user ${socket.userId}`);
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

        await webrtcService.connectWebRtcTransport(
          data.currentRoom,
          transportId,
          dtlsParameters
        );

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

        // For now, we'll simulate producer creation
        // In a real implementation, you'd use the actual mediasoup producer
        const producerId = `producer_${socket.userId}_${Date.now()}`;
        
        data.producers.set(producerId, {
          id: producerId,
          kind: kind,
          userId: socket.userId
        });

        // Notify others in the room
        socket.to(data.currentRoom).emit('new_producer', {
          producerId: producerId,
          userId: socket.userId,
          kind: kind
        });

        callback({
          success: true,
          id: producerId
        });

        logger.info(`Producer ${producerId} created for user ${socket.userId}`);
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

        // For now, we'll simulate consumer creation
        // In a real implementation, you'd use the actual mediasoup consumer
        const consumerId = `consumer_${socket.userId}_${producerId}_${Date.now()}`;
        
        data.consumers.set(consumerId, {
          id: consumerId,
          producerId: producerId,
          userId: socket.userId
        });

        callback({
          success: true,
          id: consumerId,
          producerId: producerId,
          kind: 'video', // Simplified
          rtpParameters: {}, // Simplified
          type: 'simple',
          producerPaused: false
        });

        logger.info(`Consumer ${consumerId} created for producer ${producerId}`);
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
