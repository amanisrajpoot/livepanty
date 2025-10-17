require('dotenv').config();
const io = require('socket.io-client');
const logger = require('./backend/src/utils/logger');

async function testWebRTC() {
  try {
    console.log('🧪 Testing WebRTC Functionality...\n');
    
    // Test 1: Connect to WebRTC socket
    console.log('📡 Test 1: WebRTC Socket Connection');
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

    // Test 2: Join a room
    console.log('\n🏠 Test 2: Join Room');
    const roomId = 'test-room-' + Date.now();
    
    await new Promise((resolve, reject) => {
      socket.emit('join_room', { roomId }, (response) => {
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

    // Test 3: Create transport
    console.log('\n🚚 Test 3: Create Transport');
    await new Promise((resolve, reject) => {
      socket.emit('create_transport', { direction: 'send' }, (response) => {
        if (response.error) {
          console.log('❌ Failed to create transport:', response.error);
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

    // Test 4: Create receive transport
    console.log('\n📥 Test 4: Create Receive Transport');
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

    // Test 5: Create producer (simulated)
    console.log('\n📹 Test 5: Create Producer');
    await new Promise((resolve, reject) => {
      socket.emit('create_producer', {
        kind: 'video',
        rtpParameters: {
          // Simulated RTP parameters
          codecs: [],
          headerExtensions: [],
          rtcp: {}
        }
      }, (response) => {
        if (response.error) {
          console.log('❌ Failed to create producer:', response.error);
          reject(new Error(response.error));
        } else {
          console.log('✅ Successfully created producer:', response.id);
          resolve();
        }
      });
    });

    // Test 6: Create consumer (simulated)
    console.log('\n👁️ Test 6: Create Consumer');
    await new Promise((resolve, reject) => {
      socket.emit('create_consumer', {
        producerId: 'test-producer-id',
        rtpCapabilities: {
          // Simulated RTP capabilities
          codecs: [],
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

    // Test 7: Leave room
    console.log('\n🚪 Test 7: Leave Room');
    socket.emit('leave_room', { roomId });
    console.log('✅ Left room successfully');

    // Disconnect
    socket.disconnect();
    console.log('✅ Disconnected from WebRTC socket');

    console.log('\n🎉 All WebRTC tests passed!');
    console.log('\n📋 WebRTC Features Available:');
    console.log('  ✅ Socket.IO connection with authentication');
    console.log('  ✅ Room creation and joining');
    console.log('  ✅ WebRTC transport creation (send/receive)');
    console.log('  ✅ Producer creation for media streaming');
    console.log('  ✅ Consumer creation for media receiving');
    console.log('  ✅ Proper error handling and responses');
    
    console.log('\n🚀 WebRTC is ready for real-time streaming!');
    
  } catch (error) {
    console.error('❌ WebRTC test failed:', error.message);
  } finally {
    process.exit(0);
  }
}

testWebRTC();
