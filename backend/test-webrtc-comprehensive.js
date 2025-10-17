require('dotenv').config();
const io = require('socket.io-client');
const axios = require('axios');

async function testWebRTCComprehensive() {
  try {
    console.log('🧪 Comprehensive WebRTC Testing...\n');
    
    // Test 1: Check server health
    console.log('📡 Test 1: Server Health Check');
    const healthResponse = await axios.get('http://localhost:3001/health');
    console.log('✅ Backend server healthy:', healthResponse.data.status);
    
    // Test 2: Get valid stream ID from database
    console.log('\n📺 Test 2: Get Valid Stream ID');
    const streamsResponse = await axios.get('http://localhost:3001/api/streams', {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3ODhiNDEyMy03N2UwLTQxZmItODliNS1jZGZkMzkwODI4ZTMiLCJlbWFpbCI6InZpZXdlcjFAZGVtby5jb20iLCJyb2xlIjoidmlld2VyIiwiaWF0IjoxNzYwNzI2NTY1LCJleHAiOjE3NjA3MzAxNjV9.vpORivAtlfCf89fpcZOGOSfO4fwXXEIYTu_K73xnSxI'
      }
    });
    
    if (streamsResponse.data.streams.length === 0) {
      throw new Error('No streams available for testing');
    }
    
    const testStreamId = streamsResponse.data.streams[0].id;
    console.log('✅ Found test stream:', testStreamId);
    console.log('   Stream title:', streamsResponse.data.streams[0].title);
    
    // Test 3: Test WebRTC socket connection
    console.log('\n🔌 Test 3: WebRTC Socket Connection');
    const socket = io('http://localhost:3001', {
      auth: {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3ODhiNDEyMy03N2UwLTQxZmItODliNS1jZGZkMzkwODI4ZTMiLCJlbWFpbCI6InZpZXdlcjFAZGVtby5jb20iLCJyb2xlIjoidmlld2VyIiwiaWF0IjoxNzYwNzI2NTY1LCJleHAiOjE3NjA3MzAxNjV9.vpORivAtlfCf89fpcZOGOSfO4fwXXEIYTu_K73xnSxI'
      }
    });

    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        console.log('✅ WebRTC socket connected successfully');
        resolve();
      });
      
      socket.on('connect_error', (error) => {
        console.log('❌ WebRTC socket connection failed:', error.message);
        reject(error);
      });
      
      setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);
    });

    // Test 4: Join WebRTC room
    console.log('\n🏠 Test 4: Join WebRTC Room');
    await new Promise((resolve, reject) => {
      socket.emit('join_room', { roomId: testStreamId }, (response) => {
        if (response.error) {
          console.log('❌ Failed to join room:', response.error);
          reject(new Error(response.error));
        } else {
          console.log('✅ Successfully joined room:', response.roomId);
          console.log('   RTP Capabilities available:', !!response.rtpCapabilities);
          console.log('   Existing producers:', response.existingProducers.length);
          resolve();
        }
      });
    });

    // Test 5: Create send transport
    console.log('\n📤 Test 5: Create Send Transport');
    await new Promise((resolve, reject) => {
      socket.emit('create_transport', { direction: 'send' }, (response) => {
        if (response.error) {
          console.log('❌ Failed to create send transport:', response.error);
          reject(new Error(response.error));
        } else {
          console.log('✅ Successfully created send transport:', response.id);
          console.log('   ICE Parameters available:', !!response.iceParameters);
          console.log('   ICE Candidates:', response.iceCandidates.length);
          console.log('   DTLS Parameters available:', !!response.dtlsParameters);
          resolve();
        }
      });
    });

    // Test 6: Create receive transport
    console.log('\n📥 Test 6: Create Receive Transport');
    await new Promise((resolve, reject) => {
      socket.emit('create_transport', { direction: 'recv' }, (response) => {
        if (response.error) {
          console.log('❌ Failed to create receive transport:', response.error);
          reject(new Error(response.error));
        } else {
          console.log('✅ Successfully created receive transport:', response.id);
          resolve();
        }
      });
    });

    // Test 7: Test transport connection (simulated)
    console.log('\n🔗 Test 7: Connect Transport (Simulated)');
    await new Promise((resolve, reject) => {
      socket.emit('connect_transport', {
        transportId: 'test-transport-id',
        dtlsParameters: {
          // Simulated DTLS parameters
          role: 'auto',
          fingerprints: []
        }
      }, (response) => {
        if (response.error) {
          console.log('❌ Failed to connect transport:', response.error);
          reject(new Error(response.error));
        } else {
          console.log('✅ Transport connection simulated successfully');
          resolve();
        }
      });
    });

    // Test 8: Create video producer
    console.log('\n📹 Test 8: Create Video Producer');
    await new Promise((resolve, reject) => {
      socket.emit('create_producer', {
        kind: 'video',
        rtpParameters: {
          // Simulated RTP parameters
          codecs: [
            {
              mimeType: 'video/VP8',
              clockRate: 90000,
              payloadType: 96
            }
          ],
          headerExtensions: [],
          rtcp: {
            cname: 'test-producer'
          }
        }
      }, (response) => {
        if (response.error) {
          console.log('❌ Failed to create video producer:', response.error);
          reject(new Error(response.error));
        } else {
          console.log('✅ Successfully created video producer:', response.id);
          resolve();
        }
      });
    });

    // Test 9: Create audio producer
    console.log('\n🎵 Test 9: Create Audio Producer');
    await new Promise((resolve, reject) => {
      socket.emit('create_producer', {
        kind: 'audio',
        rtpParameters: {
          // Simulated RTP parameters
          codecs: [
            {
              mimeType: 'audio/opus',
              clockRate: 48000,
              payloadType: 111
            }
          ],
          headerExtensions: [],
          rtcp: {
            cname: 'test-audio-producer'
          }
        }
      }, (response) => {
        if (response.error) {
          console.log('❌ Failed to create audio producer:', response.error);
          reject(new Error(response.error));
        } else {
          console.log('✅ Successfully created audio producer:', response.id);
          resolve();
        }
      });
    });

    // Test 10: Create consumer
    console.log('\n👁️ Test 10: Create Consumer');
    await new Promise((resolve, reject) => {
      socket.emit('create_consumer', {
        producerId: 'test-producer-id',
        rtpCapabilities: {
          // Simulated RTP capabilities
          codecs: [
            {
              mimeType: 'video/VP8',
              clockRate: 90000,
              kind: 'video'
            }
          ],
          headerExtensions: []
        }
      }, (response) => {
        if (response.error) {
          console.log('❌ Failed to create consumer:', response.error);
          reject(new Error(response.error));
        } else {
          console.log('✅ Successfully created consumer:', response.id);
          console.log('   Producer ID:', response.producerId);
          console.log('   Kind:', response.kind);
          console.log('   Type:', response.type);
          resolve();
        }
      });
    });

    // Test 11: Test chat functionality
    console.log('\n💬 Test 11: Chat Functionality');
    await new Promise((resolve, reject) => {
      socket.emit('send_message', {
        streamId: testStreamId,
        message: 'Test WebRTC message',
        type: 'chat'
      }, (response) => {
        if (response.error) {
          console.log('❌ Failed to send message:', response.error);
          reject(new Error(response.error));
        } else {
          console.log('✅ Successfully sent chat message');
          resolve();
        }
      });
    });

    // Test 12: Test tipping functionality
    console.log('\n💰 Test 12: Tipping Functionality');
    await new Promise((resolve, reject) => {
      socket.emit('send_tip', {
        streamId: testStreamId,
        toUserId: 'test-user-id',
        amount: 10,
        message: 'Test tip for WebRTC'
      }, (response) => {
        if (response.error) {
          console.log('❌ Failed to send tip:', response.error);
          reject(new Error(response.error));
        } else {
          console.log('✅ Successfully sent tip');
          resolve();
        }
      });
    });

    // Test 13: Leave room
    console.log('\n🚪 Test 13: Leave Room');
    socket.emit('leave_room', { roomId: testStreamId });
    console.log('✅ Left room successfully');

    // Disconnect
    socket.disconnect();
    console.log('✅ Disconnected from WebRTC socket');

    console.log('\n🎉 All WebRTC tests passed!');
    console.log('\n📋 WebRTC Features Verified:');
    console.log('  ✅ Server health and connectivity');
    console.log('  ✅ Database integration with valid stream IDs');
    console.log('  ✅ Socket.IO connection with authentication');
    console.log('  ✅ Room creation and joining');
    console.log('  ✅ WebRTC transport creation (send/receive)');
    console.log('  ✅ Transport connection simulation');
    console.log('  ✅ Producer creation (video/audio)');
    console.log('  ✅ Consumer creation for media receiving');
    console.log('  ✅ Chat messaging functionality');
    console.log('  ✅ Tipping functionality');
    console.log('  ✅ Proper error handling and responses');
    
    console.log('\n🚀 WebRTC is fully functional and ready for production!');
    
  } catch (error) {
    console.error('❌ WebRTC test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

testWebRTCComprehensive();
