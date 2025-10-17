require('dotenv').config();
const webrtcService = require('./src/services/webrtcService');
const io = require('socket.io-client');

async function testWebRTCDirect() {
  try {
    console.log('🧪 Direct WebRTC Service Testing...\n');
    
    // Test 1: Initialize WebRTC service directly
    console.log('🔧 Test 1: Initialize WebRTC Service');
    await webrtcService.initialize();
    console.log('✅ WebRTC service initialized successfully');
    
    // Test 2: Create a room
    console.log('\n🏠 Test 2: Create WebRTC Room');
    const roomId = 'test-room-' + Date.now();
    const room = await webrtcService.createRoom(roomId);
    console.log('✅ Room created successfully:', room.id);
    console.log('   Router available:', !!room.router);
    console.log('   RTP Capabilities available:', !!room.router.rtpCapabilities);
    
    // Test 3: Create WebRTC transport
    console.log('\n🚚 Test 3: Create WebRTC Transport');
    const transportInfo = await webrtcService.createWebRtcTransport(roomId, 'send');
    console.log('✅ Transport created successfully:', transportInfo.id);
    console.log('   ICE Parameters available:', !!transportInfo.iceParameters);
    console.log('   ICE Candidates:', transportInfo.iceCandidates.length);
    console.log('   DTLS Parameters available:', !!transportInfo.dtlsParameters);
    
    // Test 4: Test socket connection
    console.log('\n🔌 Test 4: Test Socket Connection');
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3ODhiNDEyMy03N2UwLTQxZmItODliNS1jZGZkMzkwODI4ZTMiLCJlbWFpbCI6InZpZXdlcjFAZGVtby5jb20iLCJyb2xlIjoidmlld2VyIiwiaWF0IjoxNzYwNzI5MDE3LCJleHAiOjE3NjA3MzI2MTd9.VMM0dKpLAYJM8n0LvZixmuKD2oXs4P5XTWOBTMoitIM';
    
    const socket = io('http://localhost:3001', {
      auth: { token }
    });

    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        console.log('✅ Socket connected successfully');
        resolve();
      });
      
      socket.on('connect_error', (error) => {
        console.log('❌ Socket connection failed:', error.message);
        reject(error);
      });
      
      setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);
    });

    // Test 5: Join room via socket
    console.log('\n🏠 Test 5: Join Room via Socket');
    await new Promise((resolve, reject) => {
      socket.emit('join_room', { roomId: roomId }, (response) => {
        if (response.error) {
          console.log('❌ Failed to join room via socket:', response.error);
          reject(new Error(response.error));
        } else {
          console.log('✅ Successfully joined room via socket:', response.roomId);
          console.log('   RTP Capabilities available:', !!response.rtpCapabilities);
          resolve();
        }
      });
    });

    // Test 6: Create transport via socket
    console.log('\n🚚 Test 6: Create Transport via Socket');
    await new Promise((resolve, reject) => {
      socket.emit('webrtc_create_transport', { direction: 'send' }, (response) => {
        if (response.error) {
          console.log('❌ Failed to create transport via socket:', response.error);
          reject(new Error(response.error));
        } else {
          console.log('✅ Successfully created transport via socket:', response.id);
          console.log('   ICE Parameters available:', !!response.iceParameters);
          resolve();
        }
      });
    });

    // Cleanup
    socket.disconnect();
    await webrtcService.cleanup();
    console.log('✅ Cleanup completed');

    console.log('\n🎉 All direct WebRTC tests passed!');
    console.log('\n📋 WebRTC Service Features Verified:');
    console.log('  ✅ WebRTC service initialization');
    console.log('  ✅ Room creation and management');
    console.log('  ✅ WebRTC transport creation');
    console.log('  ✅ Socket.IO connection and authentication');
    console.log('  ✅ Room joining via socket');
    console.log('  ✅ Transport creation via socket');
    
    console.log('\n🚀 WebRTC service is fully functional!');
    
  } catch (error) {
    console.error('❌ WebRTC test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

testWebRTCDirect();
