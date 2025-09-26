import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import * as mediasoupClient from 'mediasoup-client';
import { useStreamStore } from '../stores/streamStore';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

// Components
import VideoPlayer from './VideoPlayer';
import ChatPanel from './ChatPanel';
import TipPanel from './TipPanel';
import StreamControls from './StreamControls';
import ViewerList from './ViewerList';

const StreamRoomContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: calc(100vh - 64px);
  background: ${props => props.theme.colors.background};
`;

const StreamContent = styled.div`
  display: flex;
  flex: 1;
  gap: ${props => props.theme.spacing.lg};
  padding: ${props => props.theme.spacing.lg};
  overflow: hidden;

  @media (max-width: ${props => props.theme.breakpoints.tablet}) {
    flex-direction: column;
    padding: ${props => props.theme.spacing.md};
  }
`;

const VideoSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const SidePanel = styled.div`
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.md};

  @media (max-width: ${props => props.theme.breakpoints.tablet}) {
    width: 100%;
    height: 300px;
  }
`;

const StreamHeader = styled.div`
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: ${props => props.theme.spacing.md};
  padding: ${props => props.theme.spacing.md};
  background: ${props => props.theme.colors.surface};
  border-radius: ${props => props.theme.borderRadius.lg};
`;

const StreamTitle = styled.h1`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 0;
`;

const StreamInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.md};
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.875rem;
`;

const ViewerCount = styled.span`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.xs};
`;

const StatusIndicator = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => 
    props.status === 'live' ? props.theme.colors.error : 
    props.status === 'starting' ? props.theme.colors.warning : 
    props.theme.colors.textSecondary
  };
  animation: ${props => props.status === 'live' ? 'pulse 2s infinite' : 'none'};

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

const StreamRoom = () => {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    currentStream,
    socket,
    isConnected,
    joinStream,
    leaveStream,
    sendTip,
    sendMessage,
    initializeMediasoup,
    createProducer,
    createConsumer
  } = useStreamStore();

  // Local state
  const [stream, setStream] = useState(null);
  const [isPerformer, setIsPerformer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [streamStatus, setStreamStatus] = useState('connecting');

  // Refs
  const videoRef = useRef(null);
  const producerRef = useRef(null);
  const consumersRef = useRef(new Map());
  const mediasoupDeviceRef = useRef(null);

  // Initialize WebRTC
  const initializeWebRTC = useCallback(async () => {
    try {
      if (!socket) {
        throw new Error('Socket not connected');
      }

      // Initialize mediasoup device
      mediasoupDeviceRef.current = new mediasoupClient.Device();

      // Get router RTP capabilities
      const { rtpCapabilities } = await new Promise((resolve, reject) => {
        socket.emit('join_room', { roomId: streamId }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });

      // Load device with router capabilities
      await mediasoupDeviceRef.current.load({ routerRtpCapabilities: rtpCapabilities });

      // Create send transport for performers
      if (isPerformer) {
        await createSendTransport();
      }

      // Create recv transport for all users
      await createRecvTransport();

      // Create consumers for existing producers
      if (rtpCapabilities.existingProducers) {
        for (const producerId of rtpCapabilities.existingProducers) {
          await createConsumerForProducer(producerId);
        }
      }

      setStreamStatus('connected');
    } catch (error) {
      console.error('Failed to initialize WebRTC:', error);
      setError('Failed to connect to stream');
      toast.error('Failed to connect to stream');
    }
  }, [streamId, socket, isPerformer]);

  // Create send transport
  const createSendTransport = useCallback(async () => {
    try {
      const transport = await new Promise((resolve, reject) => {
        socket.emit('create_transport', { roomId: streamId, direction: 'send' }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });

      const sendTransport = mediasoupDeviceRef.current.createSendTransport({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters
      });

      // Handle transport events
      sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        socket.emit('connect_transport', {
          transportId: sendTransport.id,
          dtlsParameters
        }, (response) => {
          if (response.error) {
            errback(new Error(response.error));
          } else {
            callback();
          }
        });
      });

      sendTransport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
        socket.emit('create_producer', {
          roomId: streamId,
          kind,
          rtpParameters
        }, (response) => {
          if (response.error) {
            errback(new Error(response.error));
          } else {
            callback({ id: response.id });
          }
        });
      });

      return sendTransport;
    } catch (error) {
      console.error('Failed to create send transport:', error);
      throw error;
    }
  }, [streamId, socket]);

  // Create recv transport
  const createRecvTransport = useCallback(async () => {
    try {
      const transport = await new Promise((resolve, reject) => {
        socket.emit('create_transport', { roomId: streamId, direction: 'recv' }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });

      const recvTransport = mediasoupDeviceRef.current.createRecvTransport({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters
      });

      // Handle transport events
      recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        socket.emit('connect_transport', {
          transportId: recvTransport.id,
          dtlsParameters
        }, (response) => {
          if (response.error) {
            errback(new Error(response.error));
          } else {
            callback();
          }
        });
      });

      return recvTransport;
    } catch (error) {
      console.error('Failed to create recv transport:', error);
      throw error;
    }
  }, [streamId, socket]);

  // Start camera and microphone
  const startMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Create video producer
      const sendTransport = await createSendTransport();
      const videoProducer = await sendTransport.produce({ track: stream.getVideoTracks()[0] });
      
      // Create audio producer
      const audioProducer = await sendTransport.produce({ track: stream.getAudioTracks()[0] });

      producerRef.current = { video: videoProducer, audio: audioProducer };

      return stream;
    } catch (error) {
      console.error('Failed to start media:', error);
      toast.error('Failed to access camera/microphone');
      throw error;
    }
  }, [createSendTransport]);

  // Create consumer for producer
  const createConsumerForProducer = useCallback(async (producerId) => {
    try {
      const consumer = await new Promise((resolve, reject) => {
        socket.emit('create_consumer', {
          roomId: streamId,
          producerId,
          rtpCapabilities: mediasoupDeviceRef.current.rtpCapabilities
        }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });

      const recvTransport = await createRecvTransport();
      const mediasoupConsumer = await recvTransport.consume({
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type
      });

      consumersRef.current.set(producerId, mediasoupConsumer);

      // Handle consumer track
      const track = mediasoupConsumer.track;
      if (track.kind === 'video') {
        // Add video track to a video element
        const videoElement = document.createElement('video');
        videoElement.srcObject = new MediaStream([track]);
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.muted = true;
        
        // Add to video container
        const videoContainer = document.getElementById('video-container');
        if (videoContainer) {
          videoContainer.appendChild(videoElement);
        }
      }

      return mediasoupConsumer;
    } catch (error) {
      console.error('Failed to create consumer:', error);
      throw error;
    }
  }, [streamId, socket, createRecvTransport]);

  // Handle tip sending
  const handleSendTip = useCallback(async (tokens, message) => {
    try {
      await sendTip(streamId, stream.host_id, tokens, message);
      toast.success(`Tip sent: ${tokens} tokens`);
    } catch (error) {
      console.error('Failed to send tip:', error);
      toast.error('Failed to send tip');
    }
  }, [streamId, stream, sendTip]);

  // Handle message sending
  const handleSendMessage = useCallback(async (message) => {
    try {
      await sendMessage(streamId, message);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    }
  }, [streamId, sendMessage]);

  // Initialize stream
  useEffect(() => {
    const initializeStream = async () => {
      try {
        setIsLoading(true);

        // Fetch stream data
        const response = await fetch(`/api/streams/${streamId}`);
        if (!response.ok) {
          throw new Error('Stream not found');
        }

        const streamData = await response.json();
        setStream(streamData);
        setIsPerformer(streamData.host_id === user?.id);

        // Join stream room
        await joinStream(streamId, isPerformer ? 'performer' : 'viewer');

        // Initialize WebRTC
        await initializeWebRTC();

        // Start media if performer
        if (isPerformer) {
          await startMedia();
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize stream:', error);
        setError(error.message);
        setIsLoading(false);
      }
    };

    if (isConnected && user) {
      initializeStream();
    }

    return () => {
      // Cleanup
      if (producerRef.current) {
        producerRef.current.video?.close();
        producerRef.current.audio?.close();
      }
      
      consumersRef.current.forEach(consumer => consumer.close());
      consumersRef.current.clear();
      
      leaveStream(streamId);
    };
  }, [streamId, user, isConnected, joinStream, leaveStream, initializeWebRTC, startMedia, isPerformer]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleUserJoined = (data) => {
      setViewerCount(prev => prev + 1);
    };

    const handleUserLeft = (data) => {
      setViewerCount(prev => Math.max(0, prev - 1));
    };

    const handleNewProducer = (data) => {
      createConsumerForProducer(data.producerId);
    };

    const handleProducerClosed = (data) => {
      const consumer = consumersRef.current.get(data.producerId);
      if (consumer) {
        consumer.close();
        consumersRef.current.delete(data.producerId);
      }
    };

    const handleTipReceived = (tip) => {
      toast.success(`Tip received: ${tip.tokens} tokens from ${tip.fromDisplayName}`);
    };

    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);
    socket.on('new_producer', handleNewProducer);
    socket.on('producer_closed', handleProducerClosed);
    socket.on('tip_received', handleTipReceived);

    return () => {
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);
      socket.off('new_producer', handleNewProducer);
      socket.off('producer_closed', handleProducerClosed);
      socket.off('tip_received', handleTipReceived);
    };
  }, [socket, createConsumerForProducer]);

  if (isLoading) {
    return (
      <StreamRoomContainer>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <div>Loading stream...</div>
        </div>
      </StreamRoomContainer>
    );
  }

  if (error) {
    return (
      <StreamRoomContainer>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <div>
            <h2>Error: {error}</h2>
            <button onClick={() => navigate('/dashboard')}>Go Back</button>
          </div>
        </div>
      </StreamRoomContainer>
    );
  }

  return (
    <StreamRoomContainer>
      <StreamHeader>
        <div>
          <StreamTitle>{stream?.title}</StreamTitle>
          <StreamInfo>
            <span>by {stream?.host_name}</span>
            <ViewerCount>
              <StatusIndicator status={streamStatus} />
              {viewerCount} viewers
            </ViewerCount>
          </StreamInfo>
        </div>
      </StreamHeader>

      <StreamContent>
        <VideoSection>
          <div id="video-container" style={{ flex: 1, position: 'relative' }}>
            {isPerformer && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: '8px'
                }}
              />
            )}
          </div>
          
          {isPerformer && (
            <StreamControls
              stream={stream}
              producer={producerRef.current}
              onStatusChange={setStreamStatus}
            />
          )}
        </VideoSection>

        <SidePanel>
          <ChatPanel
            streamId={streamId}
            onSendMessage={handleSendMessage}
          />
          
          <TipPanel
            streamId={streamId}
            performerId={stream?.host_id}
            performerName={stream?.host_name}
            onSendTip={handleSendTip}
          />
          
          <ViewerList
            streamId={streamId}
            viewerCount={viewerCount}
          />
        </SidePanel>
      </StreamContent>
    </StreamRoomContainer>
  );
};

export default StreamRoom;
