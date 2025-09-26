const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { getUserById } = require('../services/userService');
const { createStream, updateStreamStatus } = require('../services/streamService');
const { sendTip, getStreamTips } = require('../services/tipService');

// Store active connections
const activeConnections = new Map();
const streamRooms = new Map();

// Socket.IO middleware for authentication
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserById(decoded.userId);
    
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.userId = user.id;
    socket.user = user;
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
        const { streamId, role } = data; // role: 'performer' or 'viewer'
        
        // Validate stream exists and user has permission
        // This would integrate with your stream service
        
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

    // Handle WebRTC signaling
    socket.on('webrtc_offer', (data) => {
      const { streamId, offer, targetUserId } = data;
      
      // Forward offer to target user
      socket.to(`user:${targetUserId}`).emit('webrtc_offer', {
        fromUserId: socket.userId,
        offer: offer,
        streamId: streamId,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('webrtc_answer', (data) => {
      const { streamId, answer, targetUserId } = data;
      
      // Forward answer to target user
      socket.to(`user:${targetUserId}`).emit('webrtc_answer', {
        fromUserId: socket.userId,
        answer: answer,
        streamId: streamId,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('webrtc_ice_candidate', (data) => {
      const { streamId, candidate, targetUserId } = data;
      
      // Forward ICE candidate to target user
      socket.to(`user:${targetUserId}`).emit('webrtc_ice_candidate', {
        fromUserId: socket.userId,
        candidate: candidate,
        streamId: streamId,
        timestamp: new Date().toISOString()
      });
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

        // Process tip through service layer
        const tip = await sendTip({
          streamId,
          fromUserId: socket.userId,
          toUserId,
          tokens,
          message,
          isPrivate
        });

        if (!tip) {
          socket.emit('tip_error', { message: 'Failed to process tip' });
          return;
        }

        // Broadcast tip to stream room
        const tipEvent = {
          id: tip.id,
          fromUserId: socket.userId,
          fromDisplayName: socket.user.display_name,
          toUserId: toUserId,
          tokens: tokens,
          message: message,
          isPrivate: isPrivate,
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
          balanceAfter: tip.balance_after,
          timestamp: tip.created_at
        });

        logger.info(`Tip sent: ${tokens} tokens from ${socket.userId} to ${toUserId} in stream ${streamId}`);
      } catch (error) {
        logger.error('Error sending tip:', error);
        socket.emit('tip_error', { message: 'Failed to send tip' });
      }
    });

    // Handle chat messages
    socket.on('send_message', (data) => {
      const { streamId, message, type = 'text' } = data;
      
      // Validate message
      if (!streamId || !message || message.trim().length === 0) {
        socket.emit('message_error', { message: 'Invalid message data' });
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
    });

    // Handle stream status updates
    socket.on('stream_status_update', async (data) => {
      try {
        const { streamId, status } = data;
        
        // Update stream status in database
        await updateStreamStatus(streamId, status, socket.userId);
        
        // Broadcast status update to all viewers
        io.to(`stream:${streamId}`).emit('stream_status_changed', {
          streamId: streamId,
          status: status,
          updatedBy: socket.userId,
          timestamp: new Date().toISOString()
        });
        
        logger.info(`Stream ${streamId} status updated to ${status} by ${socket.userId}`);
      } catch (error) {
        logger.error('Error updating stream status:', error);
        socket.emit('error', { message: 'Failed to update stream status' });
      }
    });

    // Handle viewer count updates
    socket.on('viewer_count_update', (data) => {
      const { streamId, count } = data;
      
      // Broadcast updated viewer count
      io.to(`stream:${streamId}`).emit('viewer_count_changed', {
        streamId: streamId,
        count: count,
        timestamp: new Date().toISOString()
      });
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
