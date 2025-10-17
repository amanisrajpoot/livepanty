const logger = require('../utils/logger');
const scalableStreamingService = require('../services/scalableStreamingService');
const { query } = require('../database/connection');

// Connection rate limiting
const connectionLimits = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_CONNECTIONS_PER_IP = 10;
const MAX_CONNECTIONS_PER_USER = 5;

// Message rate limiting
const messageLimits = new Map();
const MESSAGE_RATE_LIMIT = 30; // 30 messages per minute per user

const setupScalableStreamingHandlers = (io) => {
  // Connection middleware for rate limiting
  io.use((socket, next) => {
    const clientIP = socket.handshake.address;
    const userId = socket.userId;
    
    // Rate limiting by IP
    if (!connectionLimits.has(clientIP)) {
      connectionLimits.set(clientIP, { count: 0, resetTime: Date.now() + RATE_LIMIT_WINDOW });
    }
    
    const ipLimit = connectionLimits.get(clientIP);
    if (Date.now() > ipLimit.resetTime) {
      ipLimit.count = 0;
      ipLimit.resetTime = Date.now() + RATE_LIMIT_WINDOW;
    }
    
    if (ipLimit.count >= MAX_CONNECTIONS_PER_IP) {
      return next(new Error('Too many connections from this IP'));
    }
    
    // Rate limiting by user
    if (userId) {
      if (!connectionLimits.has(`user_${userId}`)) {
        connectionLimits.set(`user_${userId}`, { count: 0, resetTime: Date.now() + RATE_LIMIT_WINDOW });
      }
      
      const userLimit = connectionLimits.get(`user_${userId}`);
      if (Date.now() > userLimit.resetTime) {
        userLimit.count = 0;
        userLimit.resetTime = Date.now() + RATE_LIMIT_WINDOW;
      }
      
      if (userLimit.count >= MAX_CONNECTIONS_PER_USER) {
        return next(new Error('Too many connections for this user'));
      }
    }
    
    next();
  });

  io.on('connection', (socket) => {
    const clientIP = socket.handshake.address;
    const userId = socket.userId;
    
    // Increment connection counters
    connectionLimits.get(clientIP).count++;
    if (userId) {
      connectionLimits.get(`user_${userId}`).count++;
    }

    logger.info(`Scalable streaming client connected: ${socket.id} (IP: ${clientIP}, User: ${userId})`);

    // Message rate limiting helper
    const checkMessageRateLimit = (userId) => {
      if (!userId) return true;
      
      const key = `msg_${userId}`;
      if (!messageLimits.has(key)) {
        messageLimits.set(key, { count: 0, resetTime: Date.now() + RATE_LIMIT_WINDOW });
      }
      
      const limit = messageLimits.get(key);
      if (Date.now() > limit.resetTime) {
        limit.count = 0;
        limit.resetTime = Date.now() + RATE_LIMIT_WINDOW;
      }
      
      if (limit.count >= MESSAGE_RATE_LIMIT) {
        return false;
      }
      
      limit.count++;
      return true;
    };

    // Handle joining a stream room with enhanced validation
    socket.on('join_stream', async (data, callback) => {
      try {
        const { streamId, role = 'viewer' } = data;
        
        if (!streamId) {
          return callback({ error: 'Stream ID is required' });
        }

        // Validate role
        if (!['viewer', 'performer'].includes(role)) {
          return callback({ error: 'Invalid role' });
        }

        // Get stream info with caching
        const streamInfo = await getStreamInfo(streamId);
        if (!streamInfo) {
          return callback({ error: 'Stream not found' });
        }

        // Check if stream is live
        if (streamInfo.status !== 'live') {
          return callback({ error: 'Stream is not live' });
        }

        // Check if user is authorized to join as performer
        if (role === 'performer' && streamInfo.host_id !== userId) {
          return callback({ error: 'Only the stream host can join as performer' });
        }

        // Create or get room
        const roomId = `stream_${streamId}`;
        await scalableStreamingService.createRoom(roomId, streamId);

        // Add participant to room
        await scalableStreamingService.addParticipant(roomId, socket.id, role);

        // Join socket room
        socket.join(roomId);
        socket.currentRoom = roomId;
        socket.currentStream = streamId;
        socket.userRole = role;

        // Get router RTP capabilities
        const rtpCapabilities = await scalableStreamingService.getRouterRtpCapabilities(roomId);
        const existingProducers = await scalableStreamingService.getProducers(roomId);

        // Update stream viewer count in database (with batching)
        await updateStreamViewerCount(streamId, 1);

        // Notify others in the room (with batching for high concurrency)
        const room = await scalableStreamingService.getRoom(roomId);
        if (room && room.participants.size > 1) {
          socket.to(roomId).emit('user_joined', {
            userId: socket.userId,
            displayName: socket.user?.display_name || 'Anonymous',
            role: role,
            timestamp: new Date().toISOString(),
            totalViewers: room.viewerCount
          });
        }

        callback({
          success: true,
          rtpCapabilities,
          existingProducers,
          streamInfo,
          roomStats: {
            totalViewers: room?.viewerCount || 0,
            totalPerformers: room?.performerCount || 0
          }
        });

        logger.info(`User ${socket.userId} joined stream ${streamId} as ${role} (room size: ${room?.participants.size || 0})`);
      } catch (error) {
        logger.error('Error joining stream:', error);
        callback({ error: error.message || 'Failed to join stream' });
      }
    });

    // Handle leaving a stream room
    socket.on('leave_stream', async (data) => {
      try {
        const { streamId } = data;
        
        if (socket.currentRoom) {
          // Remove participant from room
          await scalableStreamingService.removeParticipant(socket.currentRoom, socket.id);
          
          // Update stream viewer count
          if (streamId) {
            await updateStreamViewerCount(streamId, -1);
          }

          // Notify others in the room
          const room = await scalableStreamingService.getRoom(socket.currentRoom);
          if (room && room.participants.size > 0) {
            socket.to(socket.currentRoom).emit('user_left', {
              userId: socket.userId,
              displayName: socket.user?.display_name || 'Anonymous',
              timestamp: new Date().toISOString(),
              totalViewers: room.viewerCount
            });
          }

          // Leave socket room
          socket.leave(socket.currentRoom);
          socket.currentRoom = null;
          socket.currentStream = null;
          socket.userRole = null;

          logger.info(`User ${socket.userId} left stream ${streamId}`);
        }
      } catch (error) {
        logger.error('Error leaving stream:', error);
      }
    });

    // Handle creating WebRTC transport with connection pooling
    socket.on('create_transport', async (data, callback) => {
      try {
        const { direction, streamId } = data;
        
        if (!socket.currentRoom) {
          return callback({ error: 'Not in a stream room' });
        }

        if (!['send', 'recv'].includes(direction)) {
          return callback({ error: 'Invalid transport direction' });
        }

        const transport = await scalableStreamingService.createTransport(
          socket.currentRoom,
          socket.id,
          direction
        );

        callback({
          success: true,
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters
        });

        logger.info(`Created ${direction} transport for user ${socket.userId}`);
      } catch (error) {
        logger.error('Error creating transport:', error);
        callback({ error: error.message || 'Failed to create transport' });
      }
    });

    // Handle connecting transport
    socket.on('connect_transport', async (data, callback) => {
      try {
        const { transportId, dtlsParameters } = data;
        
        if (!socket.currentRoom) {
          return callback({ error: 'Not in a stream room' });
        }

        const room = await scalableStreamingService.getRoom(socket.currentRoom);
        if (!room) {
          return callback({ error: 'Room not found' });
        }

        const participant = room.participants.get(socket.id);
        if (!participant) {
          return callback({ error: 'Participant not found' });
        }

        const transport = participant.transports.get('send') || participant.transports.get('recv');
        if (!transport) {
          return callback({ error: 'Transport not found' });
        }

        await transport.connect({ dtlsParameters });
        callback({ success: true });

        logger.info(`Connected transport ${transportId} for user ${socket.userId}`);
      } catch (error) {
        logger.error('Error connecting transport:', error);
        callback({ error: error.message || 'Failed to connect transport' });
      }
    });

    // Handle creating producer (for performers) with validation
    socket.on('create_producer', async (data, callback) => {
      try {
        const { kind, rtpParameters } = data;
        
        if (!socket.currentRoom) {
          return callback({ error: 'Not in a stream room' });
        }

        if (socket.userRole !== 'performer') {
          return callback({ error: 'Only performers can create producers' });
        }

        if (!['audio', 'video'].includes(kind)) {
          return callback({ error: 'Invalid media kind' });
        }

        const producer = await scalableStreamingService.createProducer(
          socket.currentRoom,
          socket.id,
          kind,
          rtpParameters
        );

        // Notify other users in the room
        socket.to(socket.currentRoom).emit('new_producer', {
          producerId: producer.id,
          userId: socket.userId,
          kind: kind
        });

        callback({
          success: true,
          id: producer.id
        });

        logger.info(`Created ${kind} producer for user ${socket.userId}`);
      } catch (error) {
        logger.error('Error creating producer:', error);
        callback({ error: error.message || 'Failed to create producer' });
      }
    });

    // Handle creating consumer (for viewers) with optimization
    socket.on('create_consumer', async (data, callback) => {
      try {
        const { producerId, rtpCapabilities } = data;
        
        if (!socket.currentRoom) {
          return callback({ error: 'Not in a stream room' });
        }

        const consumer = await scalableStreamingService.createConsumer(
          socket.currentRoom,
          socket.id,
          producerId,
          rtpCapabilities
        );

        callback({
          success: true,
          id: consumer.id,
          producerId: consumer.producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters
        });

        logger.info(`Created consumer for user ${socket.userId}`);
      } catch (error) {
        logger.error('Error creating consumer:', error);
        callback({ error: error.message || 'Failed to create consumer' });
      }
    });

    // Handle sending tips with enhanced validation and batching
    socket.on('send_tip', async (data, callback) => {
      try {
        const { streamId, amount, message } = data;
        
        if (!streamId || !amount || amount <= 0) {
          return callback({ error: 'Invalid tip data' });
        }

        if (amount > 10000) { // Max tip limit
          return callback({ error: 'Tip amount too high' });
        }

        // Check user's token balance
        const walletResult = await query(`
          SELECT token_balance FROM wallets WHERE user_id = $1
        `, [socket.userId]);

        if (walletResult.rows.length === 0) {
          return callback({ error: 'Wallet not found' });
        }

        const currentBalance = walletResult.rows[0].token_balance;
        if (currentBalance < amount) {
          return callback({ error: 'Insufficient token balance' });
        }

        // Get stream host
        const streamResult = await query(`
          SELECT host_id FROM streams WHERE id = $1
        `, [streamId]);

        if (streamResult.rows.length === 0) {
          return callback({ error: 'Stream not found' });
        }

        const hostId = streamResult.rows[0].host_id;

        // Process tip transaction with enhanced error handling
        await query('BEGIN');
        
        try {
          // Deduct from sender's wallet
          await query(`
            UPDATE wallets 
            SET token_balance = token_balance - $1, updated_at = NOW()
            WHERE user_id = $2
          `, [amount, socket.userId]);

          // Add to host's wallet
          await query(`
            UPDATE wallets 
            SET token_balance = token_balance + $1, updated_at = NOW()
            WHERE user_id = $2
          `, [amount, hostId]);

          // Record transaction
          await query(`
            INSERT INTO ledger (from_user_id, to_user_id, amount, transaction_type, description, created_at)
            VALUES ($1, $2, $3, 'tip', $4, NOW())
          `, [socket.userId, hostId, amount, message || 'Tip']);

          await query('COMMIT');

          // Notify all users in the room with optimized broadcasting
          const tipData = {
            fromUserId: socket.userId,
            fromDisplayName: socket.user?.display_name || 'Anonymous',
            amount: amount,
            message: message,
            timestamp: new Date().toISOString()
          };

          // Use room-based broadcasting for efficiency
          socket.to(socket.currentRoom).emit('tip_received', tipData);

          callback({ success: true });
          logger.info(`Tip of ${amount} tokens sent from ${socket.userId} to stream ${streamId}`);
        } catch (error) {
          await query('ROLLBACK');
          throw error;
        }
      } catch (error) {
        logger.error('Error sending tip:', error);
        callback({ error: error.message || 'Failed to send tip' });
      }
    });

    // Handle sending chat messages with rate limiting
    socket.on('send_message', async (data, callback) => {
      try {
        const { streamId, message, type = 'chat' } = data;
        
        if (!streamId || !message) {
          return callback({ error: 'Invalid message data' });
        }

        if (message.length > 500) { // Message length limit
          return callback({ error: 'Message too long' });
        }

        // Check message rate limit
        if (!checkMessageRateLimit(socket.userId)) {
          return callback({ error: 'Message rate limit exceeded' });
        }

        // Broadcast message to all users in the room
        const messageData = {
          fromUserId: socket.userId,
          fromDisplayName: socket.user?.display_name || 'Anonymous',
          message: message,
          type: type,
          timestamp: new Date().toISOString()
        };

        socket.to(socket.currentRoom).emit('message_received', messageData);

        callback({ success: true });
        logger.info(`Message sent by ${socket.userId} in stream ${streamId}`);
      } catch (error) {
        logger.error('Error sending message:', error);
        callback({ error: error.message || 'Failed to send message' });
      }
    });

    // Handle disconnection with cleanup
    socket.on('disconnect', async () => {
      try {
        if (socket.currentRoom && socket.currentStream) {
          // Remove participant from room
          await scalableStreamingService.removeParticipant(socket.currentRoom, socket.id);

          // Update stream viewer count
          await updateStreamViewerCount(socket.currentStream, -1);

          // Notify others in the room
          const room = await scalableStreamingService.getRoom(socket.currentRoom);
          if (room && room.participants.size > 0) {
            socket.to(socket.currentRoom).emit('user_left', {
              userId: socket.userId,
              displayName: socket.user?.display_name || 'Anonymous',
              timestamp: new Date().toISOString(),
              totalViewers: room.viewerCount
            });
          }
        }

        // Decrement connection counters
        connectionLimits.get(clientIP).count--;
        if (userId) {
          connectionLimits.get(`user_${userId}`).count--;
        }

        logger.info(`Scalable streaming client disconnected: ${socket.id}`);
      } catch (error) {
        logger.error('Error handling disconnect:', error);
      }
    });
  });

  // Cleanup rate limiting data periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, limit] of connectionLimits) {
      if (now > limit.resetTime) {
        connectionLimits.delete(key);
      }
    }
    for (const [key, limit] of messageLimits) {
      if (now > limit.resetTime) {
        messageLimits.delete(key);
      }
    }
  }, RATE_LIMIT_WINDOW);
};

// Helper functions
async function getStreamInfo(streamId) {
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
    return null;
  }
}

// Batch viewer count updates to reduce database load
const viewerCountUpdates = new Map();
let viewerCountUpdateInterval;

async function updateStreamViewerCount(streamId, delta) {
  if (!viewerCountUpdates.has(streamId)) {
    viewerCountUpdates.set(streamId, 0);
  }
  
  viewerCountUpdates.set(streamId, viewerCountUpdates.get(streamId) + delta);
  
  // Batch updates every 5 seconds
  if (!viewerCountUpdateInterval) {
    viewerCountUpdateInterval = setInterval(async () => {
      for (const [streamId, delta] of viewerCountUpdates) {
        if (delta !== 0) {
          try {
            await query(`
              UPDATE streams 
              SET viewer_count = GREATEST(viewer_count + $1, 0), updated_at = NOW()
              WHERE id = $2
            `, [delta, streamId]);
          } catch (error) {
            logger.error(`Failed to update viewer count for stream ${streamId}:`, error);
          }
        }
      }
      viewerCountUpdates.clear();
    }, 5000);
  }
}

module.exports = setupScalableStreamingHandlers;
