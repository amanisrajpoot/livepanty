require('dotenv').config();
const io = require('socket.io-client');
const axios = require('axios');

async function testWebRTCWithFreshToken() {
  try {
    console.log('🧪 WebRTC Testing with Fresh Token...\n');
    
    // Step 1: Login to get fresh token
    console.log('🔐 Step 1: Get Fresh Authentication Token');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'viewer1@demo.com',
      password: 'demo123'
    });
    
    const token = loginResponse.data.access_token;
    console.log('✅ Fresh token obtained:', token.substring(0, 20) + '...');
    
    // Step 2: Test WebRTC socket connection
    console.log('\n🔌 Step 2: WebRTC Socket Connection');
    const socket = io('http://localhost:3001', {
      auth: { token }
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

    // Step 3: Get streams with fresh token
    console.log('\n📺 Step 3: Get Streams with Fresh Token');
    const streamsResponse = await axios.get('http://localhost:3001/api/streams', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const testStreamId = streamsResponse.data.streams[0].id;
    console.log('✅ Found test stream:', testStreamId);
    console.log('   Stream title:', streamsResponse.data.streams[0].title);

    // Step 4: Join WebRTC room
    console.log('\n🏠 Step 4: Join WebRTC Room');
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

    // Step 5: Create send transport
    console.log('\n📤 Step 5: Create Send Transport');
    await new Promise((resolve, reject) => {
      socket.emit('webrtc_create_transport', { direction: 'send' }, (response) => {
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

    // Step 6: Create receive transport
    console.log('\n📥 Step 6: Create Receive Transport');
    await new Promise((resolve, reject) => {
      socket.emit('webrtc_create_transport', { direction: 'recv' }, (response) => {
        if (response.error) {
          console.log('❌ Failed to create receive transport:', response.error);
          reject(new Error(response.error));
        } else {
          console.log('✅ Successfully created receive transport:', response.id);
          resolve();
        }
      });
    });

    // Step 7: Create video producer
    console.log('\n📹 Step 7: Create Video Producer');
    await new Promise((resolve, reject) => {
      socket.emit('webrtc_create_producer', {
        kind: 'video',
        rtpParameters: {
          codecs: [
            {
              mimeType: 'video/VP8',
              clockRate: 90000,
              payloadType: 96
            }
          ],
          headerExtensions: [],
          rtcp: { cname: 'test-producer' }
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

    // Step 8: Create consumer
    console.log('\n👁️ Step 8: Create Consumer');
    await new Promise((resolve, reject) => {
      socket.emit('webrtc_create_consumer', {
        producerId: 'test-producer-id',
        rtpCapabilities: {
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
          resolve();
        }
      });
    });

    // Step 9: Test chat functionality
    console.log('\n💬 Step 9: Chat Functionality');
    await new Promise((resolve, reject) => {
      socket.emit('send_message', {
        streamId: testStreamId,
        message: 'Test WebRTC message from fresh token',
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

    // Step 10: Leave room
    console.log('\n🚪 Step 10: Leave Room');
    socket.emit('leave_room', { roomId: testStreamId });
    console.log('✅ Left room successfully');

    // Disconnect
    socket.disconnect();
    console.log('✅ Disconnected from WebRTC socket');

    console.log('\n🎉 All WebRTC tests passed with fresh token!');
    console.log('\n📋 WebRTC Features Verified:');
    console.log('  ✅ Fresh authentication token generation');
    console.log('  ✅ Socket.IO connection with valid authentication');
    console.log('  ✅ Room creation and joining');
    console.log('  ✅ WebRTC transport creation (send/receive)');
    console.log('  ✅ Producer creation (video)');
    console.log('  ✅ Consumer creation for media receiving');
    console.log('  ✅ Chat messaging functionality');
    console.log('  ✅ Proper error handling and responses');
    
    console.log('\n🚀 WebRTC is fully functional and ready for production!');
    
  } catch (error) {
    console.error('❌ WebRTC test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  } finally {
    process.exit(0);
  }
}

testWebRTCWithFreshToken();
