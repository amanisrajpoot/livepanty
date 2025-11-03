const logger = require('../utils/logger');
const streamingService = require('../services/streamingService');
const { query } = require('../database/connection');

const setupStreamingHandlers = (io) => {
  io.on('connection', (socket) => {
    logger.info(`Streaming client connected: ${socket.id}`);

    // Handle joining a stream room
    socket.on('join_stream', async (data, callback) => {
      try {
        const { streamId, role } = data;
        
        if (!streamId) {
          return callback({ error: 'Stream ID is required' });
        }

        // Get stream info
        const streamInfo = await streamingService.getStreamInfo(streamId);
        if (!streamInfo) {
          return callback({ error: 'Stream not found' });
        }

        // Check if stream is live
        if (streamInfo.status !== 'live') {
          return callback({ error: 'Stream is not live' });
        }

        // Create or get room
        const roomId = `stream_${streamId}`;
        await streamingService.createRoom(roomId, streamId);

        // Join socket room
        socket.join(roomId);
        socket.currentRoom = roomId;
        socket.currentStream = streamId;
        socket.userRole = role;

        // Get router RTP capabilities
        const rtpCapabilities = await streamingService.getRouterRtpCapabilities(roomId);
        const existingProducers = await streamingService.getProducers(roomId);

        // Increment viewer count
        await streamingService.incrementViewerCount(streamId);

        // Notify others in the room
        socket.to(roomId).emit('user_joined', {
          userId: socket.userId,
          displayName: socket.user?.display_name || 'Anonymous',
          role: role,
          timestamp: new Date().toISOString()
        });

        callback({
          success: true,
          rtpCapabilities,
          existingProducers,
          streamInfo
        });

        logger.info(`User ${socket.userId} joined stream ${streamId} as ${role}`);
      } catch (error) {
        logger.error('Error joining stream:', error);
        callback({ error: 'Failed to join stream' });
      }
    });

    // Handle leaving a stream room
    socket.on('leave_stream', async (data) => {
      try {
        const { streamId } = data;
        
        if (socket.currentRoom) {
          // Leave socket room
          socket.leave(socket.currentRoom);
          
          // Decrement viewer count
          if (streamId) {
            await streamingService.decrementViewerCount(streamId);
          }

          // Notify others in the room
          socket.to(socket.currentRoom).emit('user_left', {
            userId: socket.userId,
            displayName: socket.user?.display_name || 'Anonymous',
            timestamp: new Date().toISOString()
          });

          socket.currentRoom = null;
          socket.currentStream = null;
          socket.userRole = null;

          logger.info(`User ${socket.userId} left stream ${streamId}`);
        }
      } catch (error) {
        logger.error('Error leaving stream:', error);
      }
    });

    // Handle creating WebRTC transport
    socket.on('create_transport', async (data, callback) => {
      try {
        const { direction, streamId } = data;
        
        if (!socket.currentRoom) {
          return callback({ error: 'Not in a stream room' });
        }

        const transport = await streamingService.createTransport(
          socket.currentRoom,
          direction,
          socket.id
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
        callback({ error: 'Failed to create transport' });
      }
    });

    // Handle connecting transport
    socket.on('connect_transport', async (data, callback) => {
      try {
        const { transportId, dtlsParameters } = data;
        
        if (!socket.currentRoom) {
          return callback({ error: 'Not in a stream room' });
        }

        const room = await streamingService.getRoom(socket.currentRoom);
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
        callback({ error: 'Failed to connect transport' });
      }
    });

    // Handle creating producer (for performers)
    socket.on('create_producer', async (data, callback) => {
      try {
        const { kind, rtpParameters } = data;
        
        if (!socket.currentRoom) {
          return callback({ error: 'Not in a stream room' });
        }

        if (socket.userRole !== 'performer') {
          return callback({ error: 'Only performers can create producers' });
        }

        const producer = await streamingService.createProducer(
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
        callback({ error: 'Failed to create producer' });
      }
    });

    // Handle creating consumer (for viewers)
    socket.on('create_consumer', async (data, callback) => {
      try {
        const { producerId, rtpCapabilities } = data;
        
        if (!socket.currentRoom) {
          return callback({ error: 'Not in a stream room' });
        }

        const consumer = await streamingService.createConsumer(
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
        callback({ error: 'Failed to create consumer' });
      }
    });

    // Handle starting stream (for performers)
    socket.on('start_stream', async (data, callback) => {
      try {
        const { streamId } = data;
        
        if (socket.userRole !== 'performer') {
          return callback({ error: 'Only performers can start streams' });
        }

        // Update stream status to live
        await streamingService.updateStreamStatus(streamId, 'live');

        // Notify all users in the room
        socket.to(socket.currentRoom).emit('stream_started', {
          streamId: streamId,
          timestamp: new Date().toISOString()
        });

        callback({ success: true });
        logger.info(`Stream ${streamId} started by user ${socket.userId}`);
      } catch (error) {
        logger.error('Error starting stream:', error);
        callback({ error: 'Failed to start stream' });
      }
    });

    // Handle ending stream (for performers)
    socket.on('end_stream', async (data, callback) => {
      try {
        const { streamId } = data;
        
        if (socket.userRole !== 'performer') {
          return callback({ error: 'Only performers can end streams' });
        }

        // Update stream status to ended
        await streamingService.updateStreamStatus(streamId, 'ended');

        // Notify all users in the room
        socket.to(socket.currentRoom).emit('stream_ended', {
          streamId: streamId,
          timestamp: new Date().toISOString()
        });

        // Clean up room
        if (socket.currentRoom) {
          await streamingService.deleteRoom(socket.currentRoom);
        }

        callback({ success: true });
        logger.info(`Stream ${streamId} ended by user ${socket.userId}`);
      } catch (error) {
        logger.error('Error ending stream:', error);
        callback({ error: 'Failed to end stream' });
      }
    });

    // Handle sending tips
    socket.on('send_tip', async (data, callback) => {
      try {
        const { streamId, amount, message } = data;
        
        if (!streamId || !amount || amount <= 0) {
          return callback({ error: 'Invalid tip data' });
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

        // Use tipService for consistent tip processing
        const { sendTip } = require('../services/tipService');
        
        try {
          const tip = await sendTip({
            streamId,
            fromUserId: socket.userId,
            toUserId: hostId,
            tokens: amount,
            message,
            isPrivate: false
          });

          if (!tip || !tip.success) {
            throw new Error('Failed to process tip');
          }

          // Notify all users in the room
          socket.to(socket.currentRoom).emit('tip_received', {
            fromUserId: socket.userId,
            fromDisplayName: socket.user?.display_name || 'Anonymous',
            amount: amount,
            message: message,
            timestamp: tip.created_at || new Date().toISOString()
          });

          callback({ success: true, tip });
          logger.info(`Tip of ${amount} tokens sent from ${socket.userId} to stream ${streamId}`);
        } catch (error) {
          logger.error('Error processing tip:', error);
          callback({ error: error.message || 'Failed to send tip' });
        }
      } catch (error) {
        logger.error('Error sending tip:', error);
        callback({ error: 'Failed to send tip' });
      }
    });

    // Handle sending chat messages
    socket.on('send_message', async (data, callback) => {
      try {
        const { streamId, message, type = 'chat' } = data;
        
        if (!streamId || !message) {
          return callback({ error: 'Invalid message data' });
        }

        // Broadcast message to all users in the room
        socket.to(socket.currentRoom).emit('message_received', {
          fromUserId: socket.userId,
          fromDisplayName: socket.user?.display_name || 'Anonymous',
          message: message,
          type: type,
          timestamp: new Date().toISOString()
        });

        callback({ success: true });
        logger.info(`Message sent by ${socket.userId} in stream ${streamId}`);
      } catch (error) {
        logger.error('Error sending message:', error);
        callback({ error: 'Failed to send message' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      try {
        if (socket.currentRoom && socket.currentStream) {
          // Decrement viewer count
          await streamingService.decrementViewerCount(socket.currentStream);

          // Notify others in the room
          socket.to(socket.currentRoom).emit('user_left', {
            userId: socket.userId,
            displayName: socket.user?.display_name || 'Anonymous',
            timestamp: new Date().toISOString()
          });
        }

        logger.info(`Streaming client disconnected: ${socket.id}`);
      } catch (error) {
        logger.error('Error handling disconnect:', error);
      }
    });
  });
};

module.exports = setupStreamingHandlers;
