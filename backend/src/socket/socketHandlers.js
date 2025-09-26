const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { query } = require('../database/connection');

// Store active connections and rooms
const activeConnections = new Map();
const streamRooms = new Map();

// Socket.IO middleware for authentication
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || 
                  socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const userResult = await query(`
      SELECT id, email, display_name, username, role, status, country
      FROM users 
      WHERE id = $1 AND deleted_at IS NULL AND status IN ('active', 'pending_verification')
    `, [decoded.userId]);
    
    if (userResult.rows.length === 0) {
      return next(new Error('User not found or inactive'));
    }

    socket.userId = userResult.rows[0].id;
    socket.user = userResult.rows[0];
    next();
  } catch (error) {
    logger.error('Socket authentication error:', error);
    next(new Error('Invalid authentication token'));
  }
};

// Initialize socket handlers
const setupSocketHandlers = (io) => {
  // Apply authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    logger.info(`User ${socket.userId} connected via socket`);

    // Store connection
    activeConnections.set(socket.userId, socket);

    // Handle user joining a stream room
    socket.on('join_stream', async (data) => {
      try {
        const { streamId, role } = data;
        
        // Validate stream exists
        const streamResult = await query(
          'SELECT id, host_id, status FROM streams WHERE id = $1',
          [streamId]
        );

        if (streamResult.rows.length === 0) {
          socket.emit('error', { message: 'Stream not found' });
          return;
        }

        const stream = streamResult.rows[0];

        // Check permissions
        if (role === 'performer' && stream.host_id !== socket.userId) {
          socket.emit('error', { message: 'Unauthorized to perform in this stream' });
          return;
        }

        // Join the stream room
        socket.join(`stream:${streamId}`);
        
        // Store user's role in this stream
        if (!streamRooms.has(streamId)) {
          streamRooms.set(streamId, {
            performers: new Set(),
            viewers: new Set(),
            createdAt: new Date()
          });
        }
        
        const room = streamRooms.get(streamId);
        if (role === 'performer') {
          room.performers.add(socket.userId);
        } else {
          room.viewers.add(socket.userId);
        }

        // Notify others in the room
        socket.to(`stream:${streamId}`).emit('user_joined', {
          userId: socket.userId,
          displayName: socket.user.display_name,
          role: role,
          timestamp: new Date().toISOString()
        });

        // Send current room state to the joining user
        socket.emit('room_state', {
          streamId: streamId,
          performers: Array.from(room.performers),
          viewers: Array.from(room.viewers),
          timestamp: new Date().toISOString()
        });

        logger.info(`User ${socket.userId} joined stream ${streamId} as ${role}`);
      } catch (error) {
        logger.error('Error joining stream:', error);
        socket.emit('error', { message: 'Failed to join stream' });
      }
    });

    // Handle user leaving a stream room
    socket.on('leave_stream', (data) => {
      const { streamId } = data;
      
      // Remove from room data structure
      const room = streamRooms.get(streamId);
      if (room) {
        room.performers.delete(socket.userId);
        room.viewers.delete(socket.userId);
        
        // Clean up empty rooms
        if (room.performers.size === 0 && room.viewers.size === 0) {
          streamRooms.delete(streamId);
        }
      }

      // Leave the socket room
      socket.leave(`stream:${streamId}`);

      // Notify others in the room
      socket.to(`stream:${streamId}`).emit('user_left', {
        userId: socket.userId,
        displayName: socket.user.display_name,
        timestamp: new Date().toISOString()
      });

      logger.info(`User ${socket.userId} left stream ${streamId}`);
    });

    // Handle tip sending
    socket.on('send_tip', async (data) => {
      try {
        const { streamId, toUserId, tokens, message, isPrivate } = data;
        
        // Validate tip data
        if (!streamId || !toUserId || !tokens || tokens <= 0) {
          socket.emit('tip_error', { message: 'Invalid tip data' });
          return;
        }

        // Check user's token balance
        const walletResult = await query(
          'SELECT token_balance FROM wallets WHERE user_id = $1',
          [socket.userId]
        );

        if (walletResult.rows.length === 0 || walletResult.rows[0].token_balance < tokens) {
          socket.emit('tip_error', { message: 'Insufficient token balance' });
          return;
        }

        // Process tip in transaction
        const tipResult = await query(`
          WITH tip_transaction AS (
            INSERT INTO tips (stream_id, from_user_id, to_user_id, tokens, message, is_private)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, created_at
          ),
          wallet_update AS (
            UPDATE wallets 
            SET token_balance = token_balance - $4,
                reserved_balance = reserved_balance + $4
            WHERE user_id = $2
            RETURNING token_balance
          )
          SELECT t.id, t.created_at, w.token_balance
          FROM tip_transaction t, wallet_update w
        `, [streamId, socket.userId, toUserId, tokens, message, isPrivate || false]);

        if (tipResult.rows.length === 0) {
          socket.emit('tip_error', { message: 'Failed to process tip' });
          return;
        }

        const tip = tipResult.rows[0];

        // Create ledger entry
        await query(`
          INSERT INTO ledger (user_id, counterparty_id, transaction_type, amount_tokens, balance_after, reference_type, reference_id, description)
          VALUES ($1, $2, 'tip_sent', $3, $4, 'tip', $5, 'Tip sent to performer')
        `, [socket.userId, toUserId, -tokens, tip.token_balance, tip.id]);

        // Broadcast tip to stream room
        const tipEvent = {
          id: tip.id,
          fromUserId: socket.userId,
          fromDisplayName: socket.user.display_name,
          toUserId: toUserId,
          tokens: tokens,
          message: message,
          isPrivate: isPrivate || false,
          timestamp: tip.created_at
        };

        // Send to all viewers in the stream (if not private)
        if (!isPrivate) {
          io.to(`stream:${streamId}`).emit('tip_received', tipEvent);
        } else {
          // Send only to recipient for private tips
          socket.to(`user:${toUserId}`).emit('private_tip_received', tipEvent);
        }

        // Send confirmation to sender
        socket.emit('tip_sent', {
          tipId: tip.id,
          tokens: tokens,
          balanceAfter: tip.token_balance,
          timestamp: tip.created_at
        });

        logger.info(`Tip sent: ${tokens} tokens from ${socket.userId} to ${toUserId} in stream ${streamId}`);
      } catch (error) {
        logger.error('Error sending tip:', error);
        socket.emit('tip_error', { message: 'Failed to send tip' });
      }
    });

    // Handle chat messages
    socket.on('send_message', async (data) => {
      try {
        const { streamId, message, type = 'text' } = data;
        
        // Validate message
        if (!streamId || !message || message.trim().length === 0) {
          socket.emit('message_error', { message: 'Invalid message data' });
          return;
        }

        // Check if user is in the stream
        const room = streamRooms.get(streamId);
        if (!room || (!room.performers.has(socket.userId) && !room.viewers.has(socket.userId))) {
          socket.emit('message_error', { message: 'Not in stream' });
          return;
        }

        const chatMessage = {
          id: uuidv4(),
          userId: socket.userId,
          displayName: socket.user.display_name,
          message: message.trim(),
          type: type,
          timestamp: new Date().toISOString()
        };

        // Broadcast to all users in the stream
        io.to(`stream:${streamId}`).emit('chat_message', chatMessage);
        
        logger.info(`Chat message from ${socket.userId} in stream ${streamId}: ${message}`);
      } catch (error) {
        logger.error('Error sending message:', error);
        socket.emit('message_error', { message: 'Failed to send message' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      logger.info(`User ${socket.userId} disconnected: ${reason}`);
      
      // Remove from active connections
      activeConnections.delete(socket.userId);
      
      // Clean up from all stream rooms
      for (const [streamId, room] of streamRooms.entries()) {
        room.performers.delete(socket.userId);
        room.viewers.delete(socket.userId);
        
        // Notify others in the room
        socket.to(`stream:${streamId}`).emit('user_left', {
          userId: socket.userId,
          displayName: socket.user.display_name,
          timestamp: new Date().toISOString()
        });
        
        // Clean up empty rooms
        if (room.performers.size === 0 && room.viewers.size === 0) {
          streamRooms.delete(streamId);
        }
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for user ${socket.userId}:`, error);
    });
  });
};

// Utility functions for external use
const getActiveConnections = () => activeConnections;
const getStreamRooms = () => streamRooms;
const getUserSocket = (userId) => activeConnections.get(userId);

// Broadcast function for external services
const broadcastToStream = (streamId, event, data) => {
  const io = require('../server').io;
  io.to(`stream:${streamId}`).emit(event, data);
};

const broadcastToUser = (userId, event, data) => {
  const socket = activeConnections.get(userId);
  if (socket) {
    socket.emit(event, data);
  }
};

module.exports = {
  setupSocketHandlers,
  getActiveConnections,
  getStreamRooms,
  getUserSocket,
  broadcastToStream,
  broadcastToUser
};
