const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { getUserById } = require('../services/userService');
const { createStream, updateStreamStatus } = require('../services/streamService');
const { sendTip, getStreamTips } = require('../services/tipService');
const scalableStreamingService = require('../services/scalableStreamingService');

// Store active connections
const activeConnections = new Map();
const streamRooms = new Map();

// Socket.IO middleware for authentication (optional for guest access)
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      // Guest connection - allow read-only access
      socket.userId = null;
      socket.user = null;
      socket.isGuest = true;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserById(decoded.userId);
    
    if (!user) {
      // Invalid user - treat as guest
      socket.userId = null;
      socket.user = null;
      socket.isGuest = true;
      return next();
    }

    socket.userId = user.id;
    socket.user = user;
    socket.isGuest = false;
    next();
  } catch (error) {
    // Invalid token - treat as guest
    logger.debug('Socket authentication failed, allowing guest access:', error.message);
    socket.userId = null;
    socket.user = null;
    socket.isGuest = true;
    next();
  }
};

// Initialize socket handlers
const setupSocketHandlers = (io) => {
  // Apply authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    if (socket.isGuest) {
      logger.info(`Guest user connected via socket (${socket.id})`);
      // Guests can only view - don't store in activeConnections
    } else {
      logger.info(`User ${socket.userId} connected via socket`);

      // Store connection
      activeConnections.set(socket.userId, socket);

      // Join user's personal room for targeted messaging
      socket.join(`user:${socket.userId}`);
      logger.info(`User ${socket.userId} joined personal room: user:${socket.userId}`);

      // Join admin room if user is admin
      if (socket.user.role === 'admin') {
        socket.join('admin');
        logger.info(`Admin ${socket.userId} joined admin room`);
      }
    }

    // Handle user joining a stream room (Mediasoup style - supports both authenticated and guest)
    socket.on('join_room', async (data, callback) => {
      try {
        const { roomId } = data;
        
        if (!roomId) {
          if (callback) callback({ error: 'Room ID required' });
          return;
        }

        // Join the stream room (guests can join too)
        socket.join(`stream:${roomId}`);
        
        if (socket.isGuest) {
          // Guest user - minimal access
          logger.info(`Guest user joined stream room ${roomId}`);
          
          // Get or create Mediasoup room for WebRTC capabilities (guests can view)
          try {
            let mediasoupRoom = await scalableStreamingService.getRoom(roomId);
            if (!mediasoupRoom) {
              // Create room in scalable streaming service
              await scalableStreamingService.createRoom(roomId, roomId);
              mediasoupRoom = await scalableStreamingService.getRoom(roomId);
            }
            
            // Add participant as viewer
            await scalableStreamingService.addParticipant(roomId, socket.id, 'viewer');
            
            // Get existing producers
            const existingProducers = mediasoupRoom?.producers ? 
              Array.from(mediasoupRoom.producers.keys()) : [];
            
            if (callback) {
              callback({
                success: true,
                isGuest: true,
                rtpCapabilities: mediasoupRoom.router.rtpCapabilities,
                existingProducers: existingProducers,
                message: 'Joined as guest viewer. Sign in to chat and tip.'
              });
            }
          } catch (error) {
            logger.error('Error setting up guest WebRTC:', error);
            // Return basic response even if WebRTC setup fails
            if (callback) {
              callback({
                success: true,
                isGuest: true,
                rtpCapabilities: null,
                existingProducers: [],
                message: 'Joined as guest viewer. Sign in to chat and tip.',
                warning: 'WebRTC setup failed, video may not be available'
              });
            }
          }
        } else {
          // Authenticated user
          // Store user's role in this stream
          if (!streamRooms.has(roomId)) {
            streamRooms.set(roomId, {
              performers: new Set(),
              viewers: new Set(),
              createdAt: new Date()
            });
          }
          
          const room = streamRooms.get(roomId);
          const role = socket.user.role === 'performer' ? 'performer' : 'viewer';
          
          if (role === 'performer') {
            room.performers.add(socket.userId);
          } else {
            room.viewers.add(socket.userId);
          }

          // Notify others in the room
          socket.to(`stream:${roomId}`).emit('user_joined', {
            userId: socket.userId,
            displayName: socket.user.display_name,
            role: role,
            timestamp: new Date().toISOString()
          });

          // Get or create Mediasoup room for WebRTC capabilities
          try {
            let mediasoupRoom = await scalableStreamingService.getRoom(roomId);
            if (!mediasoupRoom) {
              // Create room in scalable streaming service
              // Use streamId from database query if available, otherwise use roomId
              const streamIdForRoom = roomId; // Can be enhanced to get from stream lookup
              await scalableStreamingService.createRoom(roomId, streamIdForRoom);
              mediasoupRoom = await scalableStreamingService.getRoom(roomId);
            }
            
            // Add participant to Mediasoup room
            await scalableStreamingService.addParticipant(roomId, socket.id, role);
            
            // Get existing producers
            const existingProducers = mediasoupRoom?.producers ? 
              Array.from(mediasoupRoom.producers.keys()) : [];
            
            // Get RTP capabilities from router
            const rtpCapabilities = mediasoupRoom?.router?.rtpCapabilities || null;
            
            // Send current room state to the joining user
            if (callback) {
              callback({
                success: true,
                roomId: roomId,
                existingProducers: existingProducers,
                rtpCapabilities: rtpCapabilities,
                role: role
              });
            }
          } catch (mediasoupError) {
            logger.error('Error setting up Mediasoup room:', mediasoupError);
            // Fallback: still allow connection without WebRTC
            if (callback) {
              callback({
                success: true,
                roomId: roomId,
                existingProducers: [],
                rtpCapabilities: null,
                role: role,
                warning: 'WebRTC capabilities unavailable'
              });
            }
          }

          logger.info(`User ${socket.userId} joined stream ${roomId} as ${role}`);
        }
      } catch (error) {
        logger.error('Error joining room:', error);
        if (callback) callback({ error: 'Failed to join room' });
      }
    });

    // Handle user joining a stream room (legacy)
    socket.on('join_stream', async (data) => {
      try {
        if (socket.isGuest) {
          socket.emit('error', { message: 'Authentication required to join stream' });
          return;
        }

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
      // Block guests from tipping
      if (socket.isGuest) {
        socket.emit('tip_error', { message: 'Authentication required. Please sign in to send tips.' });
        return;
      }

      try {
        const { streamId, toUserId, amount, tokens, message, isPrivate } = data;
        const tipAmount = tokens || amount; // Support both field names
        
        // Validate tip data
        if (!streamId || !toUserId || !tipAmount || tipAmount <= 0) {
          socket.emit('tip_error', { message: 'Invalid tip data' });
          return;
        }

        // Process tip through service layer
        const tip = await sendTip({
          streamId,
          fromUserId: socket.userId,
          toUserId,
          tokens: tipAmount,
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
          tokens: tipAmount,
          amount: tipAmount, // Support both field names
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

    // Handle chat messages with automated content filtering
    socket.on('send_message', async (data) => {
      // Block guests from chatting
      if (socket.isGuest) {
        socket.emit('message_error', { message: 'Authentication required. Please sign in to chat.' });
        return;
      }

      const { streamId, message, type = 'text' } = data;
      
      // Validate message
      if (!streamId || !message || message.trim().length === 0) {
        socket.emit('message_error', { message: 'Invalid message data' });
        return;
      }

      const trimmedMessage = message.trim();

      // Automated content filtering
      try {
        const moderationService = require('../services/moderationService');
        const analysis = await moderationService.analyzeTextContent(trimmedMessage, 'message');
        
        // If message is flagged, handle appropriately
        if (analysis.isFlagged && analysis.riskScore > 0.7) {
          // High risk - block message and warn user
          socket.emit('message_error', { 
            message: 'Your message was blocked due to inappropriate content. Repeated violations may result in account suspension.'
          });
          
          // Log for moderation review
          logger.warn(`Blocked message from ${socket.userId} in stream ${streamId}: Risk score ${analysis.riskScore}`);
          
          // Auto-create report for high-risk content
          if (analysis.riskScore > 0.8) {
            try {
              await moderationService.createContentReport({
                reporterId: 'system',
                reportedUserId: socket.userId,
                contentType: 'message',
                contentId: null,
                reason: 'automated_flag',
                description: `Automated flag: ${trimmedMessage}`,
                evidence: analysis,
                content: trimmedMessage
              });
            } catch (reportError) {
              logger.error('Failed to create automated report:', reportError);
            }
          }
          
          return; // Don't send the message
        } else if (analysis.isFlagged && analysis.riskScore > 0.5) {
          // Medium risk - send but flag for review
          logger.info(`Flagged message from ${socket.userId} in stream ${streamId}: Risk score ${analysis.riskScore}`);
          
          // Store flagged message with analysis for moderation
          // (This could be stored in a flagged_messages table or similar)
        }
      } catch (filterError) {
        // Don't block message if filtering fails
        logger.warn('Content filtering error:', filterError);
      }

      const chatMessage = {
        id: uuidv4(),
        userId: socket.userId,
        displayName: socket.user.display_name,
        message: trimmedMessage,
        type: type,
        timestamp: new Date().toISOString()
      };

      // Broadcast to all users in the stream
      io.to(`stream:${streamId}`).emit('chat_message', chatMessage);
      
      logger.info(`Chat message from ${socket.userId} in stream ${streamId}: ${trimmedMessage}`);
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

// Store io instance for external use
let ioInstance = null;

// Initialize io instance
const setIOInstance = (io) => {
  ioInstance = io;
};

// Utility functions for external use
const getActiveConnections = () => activeConnections;
const getStreamRooms = () => streamRooms;
const getUserSocket = (userId) => activeConnections.get(userId);

// Broadcast function for external services
const broadcastToStream = (streamId, event, data) => {
  if (ioInstance) {
    ioInstance.to(`stream:${streamId}`).emit(event, data);
  }
};

const broadcastToUser = (userId, event, data) => {
  // Use room-based broadcasting for better scalability
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit(event, data);
  }
};

const broadcastToAdmins = (event, data) => {
  if (ioInstance) {
    ioInstance.to('admin').emit(event, data);
  }
};

module.exports = {
  setupSocketHandlers,
  setIOInstance,
  getActiveConnections,
  getStreamRooms,
  getUserSocket,
  broadcastToStream,
  broadcastToUser,
  broadcastToAdmins
};
