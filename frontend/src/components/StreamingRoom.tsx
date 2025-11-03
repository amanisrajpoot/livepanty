import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
// import QRCode from 'qrcode'; // Not used in this component
import { useAuthStore } from '../store/authStore';
// import { useStreamStore } from '../store/streamStore'; // Not used in this component
import { useWalletStore } from '../store/walletStore';
import ReportContent from './ReportContent';
import GuestPrompts from './GuestPrompts';
import { Flag } from 'lucide-react';

// Type definitions for mediasoup-client
type Producer = any;
type Consumer = any;
type Transport = any;

interface StreamInfo {
  id: string;
  host_id: string;
  title: string;
  description: string;
  host_name: string;
  host_avatar: string;
  status: string;
  viewer_count: number;
  category?: string;
  tags?: string[];
  is_private?: boolean;
  total_tokens_received?: number;
  thumbnail_url?: string;
  sfu_room_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface RoomStats {
  totalViewers: number;
  totalPerformers: number;
}

interface TipData {
  fromUserId: string;
  fromDisplayName: string;
  amount: number;
  message: string;
  timestamp: string;
}

interface MessageData {
  id?: string;
  fromUserId: string;
  fromDisplayName: string;
  message: string;
  type: string;
  timestamp: string;
}

const StreamingRoom: React.FC = () => {
  const { streamId } = useParams<{ streamId: string }>();
  const navigate = useNavigate();
  
  const { user, isAuthenticated, token } = useAuthStore();
  // const { joinStream, leaveStream } = useStreamStore(); // Not used in this component
  const { tokenBalance } = useWalletStore();

  // Guest mode tracking
  const [isGuest, setIsGuest] = useState(!isAuthenticated);
  const [viewTime, setViewTime] = useState(0);
  const viewTimeRef = useRef(0);

  // State management
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [roomStats, setRoomStats] = useState<RoomStats>({ totalViewers: 0, totalPerformers: 0 });
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Demo mode state - can be toggled when stream not found
  const [enableDemoMode, setEnableDemoMode] = useState(false);
  const [demoTips, setDemoTips] = useState<TipData[]>([
    { fromUserId: 'demo1', fromDisplayName: 'TipMaster', amount: 50, message: 'Amazing stream!', timestamp: new Date(Date.now() - 30000).toISOString() },
    { fromUserId: 'demo2', fromDisplayName: 'FanGirl99', amount: 100, message: 'Love your energy!', timestamp: new Date(Date.now() - 60000).toISOString() },
    { fromUserId: 'demo3', fromDisplayName: 'Viewer123', amount: 25, message: 'Keep it up!', timestamp: new Date(Date.now() - 90000).toISOString() }
  ]);

  // WebRTC state
  const [device, setDevice] = useState<mediasoupClient.Device | null>(null);
  const [producers, setProducers] = useState<Map<string, Producer>>(new Map());
  const [consumers, setConsumers] = useState<Map<string, Consumer>>(new Map());
  const [transports, setTransports] = useState<Map<string, Transport>>(new Map());

  // Chat and tips
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [tips, setTips] = useState<TipData[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [tipAmount, setTipAmount] = useState(10);
  const [tipMessage, setTipMessage] = useState('');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    userId: string;
    userName: string;
    contentType: 'stream' | 'message' | 'profile';
    contentId?: string;
    contentPreview?: string;
  } | null>(null);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const hasJoinedRoomRef = useRef<boolean>(false);
  const isJoiningRef = useRef<boolean>(false);
  const streamInfoRef = useRef<StreamInfo | null>(null);
  const socketInitializedRef = useRef<boolean>(false);

  // Determine user role
  const isPerformer = user?.role === 'performer' && streamInfo?.host_name === user?.display_name;

  // Initialize WebRTC device
  const initializeDevice = useCallback(async (rtpCapabilities: any) => {
    try {
      const newDevice = new mediasoupClient.Device();
      await newDevice.load({ routerRtpCapabilities: rtpCapabilities });
      setDevice(newDevice);
      return newDevice;
    } catch (error) {
      console.error('Failed to initialize device:', error);
      throw error;
    }
  }, []);

  // Create transport
  const createTransport = useCallback(async (direction: 'send' | 'recv') => {
    if (!socketRef.current || !device) throw new Error('Socket not connected or device not initialized');

    return new Promise<Transport>((resolve, reject) => {
      socketRef.current!.emit('webrtc_create_transport', {
        direction
      }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        if (!response.success) {
          reject(new Error('Failed to create transport'));
          return;
        }

        // Create transport based on direction using correct mediasoup-client API
        let transport: any;
        if (direction === 'send') {
          transport = (device as any).createSendTransport({
            id: response.id,
            iceParameters: response.iceParameters,
            iceCandidates: response.iceCandidates,
            dtlsParameters: response.dtlsParameters
          });
          
          // Handle produce event for send transport
          transport.on('produce', async ({ kind, rtpParameters }: any, callback: any, errback: any) => {
            try {
              socketRef.current!.emit('webrtc_create_producer', {
                kind,
                rtpParameters
              }, (producerResponse: any) => {
                if (producerResponse.error) {
                  errback(new Error(producerResponse.error));
                } else {
                  callback({ id: producerResponse.id });
                }
              });
            } catch (error) {
              errback(error);
            }
          });
        } else {
          transport = (device as any).createRecvTransport({
            id: response.id,
            iceParameters: response.iceParameters,
            iceCandidates: response.iceCandidates,
            dtlsParameters: response.dtlsParameters
          });
        }

        // Handle transport events
        transport.on('connect', async ({ dtlsParameters }: { dtlsParameters: any }) => {
          try {
            const ack = await new Promise<any>((res, rej) => {
              socketRef.current!.emit('webrtc_connect_transport', {
                transportId: transport.id,
                dtlsParameters
              }, (ackResponse: any) => {
                if (ackResponse.error) {
                  rej(new Error(ackResponse.error));
                } else {
                  res(ackResponse);
                }
              });
            });
          } catch (error) {
            console.error('Failed to connect transport:', error);
          }
        });

        transport.on('connectionstatechange', (state: string) => {
          console.log(`Transport connection state: ${state}`);
        });

        setTransports(prev => new Map(prev).set(direction, transport));
        resolve(transport);
      });
    });
  }, [device, streamId]);

  // Start local stream (for performers)
  const startLocalStream = useCallback(async () => {
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

      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create send transport
      const sendTransport = await createTransport('send');

        // Create video producer
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const videoProducer = await sendTransport.produce({
            track: videoTrack,
            encodings: [
              {
                maxBitrate: 1000000,
                scalabilityMode: 'S1T3'
              }
            ],
            codecOptions: {
              videoGoogleStartBitrate: 1000000
            }
          });

          // Producer is already created via transport 'produce' event handler
          console.log('Video producer created:', videoProducer.id);
          setProducers(prev => new Map(prev).set('video', videoProducer));
        }

      // Create audio producer
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const audioProducer = await sendTransport.produce({
          track: audioTrack
        });

        // Producer is already created via transport 'produce' event handler
        console.log('Audio producer created:', audioProducer.id);
        setProducers(prev => new Map(prev).set('audio', audioProducer));
      }

      setIsStreaming(true);
    } catch (error) {
      console.error('Failed to start local stream:', error);
      setError('Failed to access camera/microphone');
    }
  }, [createTransport]);

  // Create consumer for remote stream
  const createConsumer = useCallback(async (producerId: string) => {
    if (!device || !socketRef.current) return;

    try {
      const recvTransport = transports.get('recv');
      if (!recvTransport) {
        const newRecvTransport = await createTransport('recv');
        setTransports(prev => new Map(prev).set('recv', newRecvTransport));
      }

      const finalRecvTransport = transports.get('recv') || await createTransport('recv');

      const response = await new Promise<any>((resolve, reject) => {
        socketRef.current!.emit('webrtc_create_consumer', {
          producerId,
          rtpCapabilities: device.rtpCapabilities
        }, (data: any) => {
          if (data.error) {
            reject(new Error(data.error));
          } else {
            resolve(data);
          }
        });
      });

      if (!response.success) {
        throw new Error('Failed to create consumer on server');
      }

      const consumer = await finalRecvTransport.consume({
        id: response.id,
        producerId: response.producerId,
        kind: response.kind,
        rtpParameters: response.rtpParameters,
        type: response.type,
        producerPaused: response.producerPaused
      });

      setConsumers(prev => new Map(prev).set(producerId, consumer));

      // Play the stream
      const stream = new MediaStream([consumer.track]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Failed to create consumer:', error);
    }
  }, [device, transports, createTransport, streamId]);

  // Join stream
  const joinStreamRoom = useCallback(async () => {
    if (!streamId) return;
    
    // Prevent multiple simultaneous joins
    if (hasJoinedRoomRef.current || isJoiningRef.current) {
      console.log('Already joined or joining, skipping...');
      return;
    }
    
    isJoiningRef.current = true;

    // Wait for socket connection if not ready
    if (!socketRef.current || !socketRef.current.connected) {
      console.log('Waiting for socket connection...');
      // Wait up to 5 seconds for socket to connect
      let waitTime = 0;
      while ((!socketRef.current || !socketRef.current.connected) && waitTime < 5000) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitTime += 100;
      }
      
      if (!socketRef.current || !socketRef.current.connected) {
        console.warn('Socket not connected, continuing without socket...');
        isJoiningRef.current = false;
        // Don't set error, just continue without socket
      }
    }

    try {
      // Don't set loading if we already have stream info
      if (!streamInfo) {
        setLoading(true);
      }
      
      // First, get stream info from API (works for both guests and authenticated users)
      const headers: HeadersInit = {};
      const currentToken = useAuthStore.getState().token;
      if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
      }

      const streamResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/streams/${streamId}`, {
        headers
      });

      if (!streamResponse.ok) {
        let errorData;
        try {
          errorData = await streamResponse.json();
        } catch (e) {
          // If response is not JSON, get text
          const errorText = await streamResponse.text();
          throw new Error(errorText || `HTTP ${streamResponse.status}: ${streamResponse.statusText}`);
        }
        
        if (errorData.error === 'PRIVATE_STREAM') {
          // Redirect to login for private streams
          navigate('/login', { state: { from: `/stream/${streamId}` } });
          return;
        }
        
        if (errorData.error === 'STREAM_NOT_FOUND') {
          setError(`Stream not found. Please check the stream ID: ${streamId}`);
          setLoading(false);
          return;
        }
        
        if (errorData.error === 'INVALID_STREAM_ID') {
          setError(`Invalid stream ID format. Please use a valid stream ID.`);
          setLoading(false);
          navigate('/streams');
          return;
        }
        
        throw new Error(errorData.message || errorData.error || 'Failed to retrieve stream');
      }

      const streamData = await streamResponse.json();
      setStreamInfo(streamData);
      streamInfoRef.current = streamData; // Store in ref for socket handler
      setIsGuest(!streamData.is_authenticated);
      
      // Show stream info immediately, even if socket isn't ready
      // This ensures UI loads even if socket connection is slow
      if (!hasJoinedRoomRef.current) {
        setIsConnected(true);
        setLoading(false);
        hasJoinedRoomRef.current = true;
      }

      // Join the WebRTC room via socket (non-blocking)
      // Add timeout to prevent hanging
      let response: any;
      try {
        // Wait a bit for socket to be ready
        if (!socketRef.current || !socketRef.current.connected) {
          // Wait up to 3 seconds for socket connection
          let waitTime = 0;
          while ((!socketRef.current || !socketRef.current.connected) && waitTime < 3000) {
            await new Promise(resolve => setTimeout(resolve, 100));
            waitTime += 100;
          }
        }
        
        if (socketRef.current && socketRef.current.connected) {
          response = await Promise.race([
            new Promise<any>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Socket response timeout'));
              }, 5000); // 5 second timeout (shorter since we already have stream data)

              socketRef.current!.emit('join_room', {
                roomId: streamId
              }, (data: any) => {
                clearTimeout(timeout);
                if (data && data.error) {
                  reject(new Error(data.error));
                } else {
                  resolve(data || { success: true });
                }
              });
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Socket join timeout')), 5000)
            )
          ]) as any;
        } else {
          console.warn('Socket not connected, continuing without WebRTC');
          response = { success: true, isGuest: !isAuthenticated };
        }
      } catch (socketError) {
        console.warn('Socket join_room failed (non-critical):', socketError);
        // Continue without WebRTC - user can still see UI and chat
        response = { success: true, isGuest: !isAuthenticated };
      }

      // Initialize device for WebRTC (if not in demo mode and capabilities available)
      // This is done asynchronously so it doesn't block the UI
      if (!enableDemoMode && response && response.rtpCapabilities) {
        // Run WebRTC setup in background (don't block UI)
        (async () => {
          try {
            await initializeDevice(response.rtpCapabilities);

            // Create receive transport for viewers
            if (!isPerformer) {
              await createTransport('recv');
            }

            // Create consumers for existing producers
            for (const producerId of response.existingProducers || []) {
              await createConsumer(producerId);
            }
          } catch (webrtcError) {
            console.warn('WebRTC initialization failed (non-critical):', webrtcError);
            // Continue even if WebRTC fails - user can still see UI and chat
          }
        })();
      } else if (response && !response.rtpCapabilities) {
        console.warn('No WebRTC capabilities received - video may not be available');
      }
      
      // UI is already shown - no need to set loading/connected again
      isJoiningRef.current = false;
    } catch (error) {
      console.error('Failed to join stream:', error);
      setError(error instanceof Error ? error.message : 'Failed to join stream');
      setLoading(false);
      isJoiningRef.current = false;
      hasJoinedRoomRef.current = false; // Allow retry on error
    }
  }, [streamId]); // Only depend on streamId - prevents glitchy re-renders

  // Leave stream
  const leaveStreamRoom = useCallback(async () => {
    if (!socketRef.current) return;

    try {
      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      // Close producers
      Array.from(producers.values()).forEach(producer => {
        producer.close();
      });

      // Close consumers
      Array.from(consumers.values()).forEach(consumer => {
        consumer.close();
      });

      // Close transports
      Array.from(transports.values()).forEach(transport => {
        transport.close();
      });

      // Leave socket room
      socketRef.current.emit('leave_stream', { streamId });

      setIsConnected(false);
      setIsStreaming(false);
      navigate('/streams');
    } catch (error) {
      console.error('Failed to leave stream:', error);
    }
  }, [streamId, producers, consumers, transports, navigate]);

  // Send tip
  const handleSendTip = useCallback(async () => {
    if (!socketRef.current || !streamId || tipAmount <= 0) return;

    try {
      if (enableDemoMode) {
        // Demo mode - just show animation
        const newTip = {
          fromUserId: user?.id || 'demo-user',
          fromDisplayName: user?.display_name || 'You',
          amount: tipAmount,
          message: tipMessage,
          timestamp: new Date().toISOString()
        };
        
        setDemoTips(prev => [...prev, newTip]);
        setTips(prev => [...prev, newTip]);
        
        // Remove tip after animation
        setTimeout(() => {
          setTips(prev => prev.filter(tip => tip.timestamp !== newTip.timestamp));
        }, 3000);
      } else {
        // Real tip - send via socket to backend
        const response = await new Promise<any>((resolve, reject) => {
          socketRef.current!.emit('send_tip', {
            streamId,
            toUserId: streamInfo?.host_id,
            amount: tipAmount,
            message: tipMessage
          }, (data: any) => {
            if (data.error) {
              reject(new Error(data.error));
            } else {
              resolve(data);
            }
          });
        });

        if (response.success) {
          // Refresh wallet balance
          await useWalletStore.getState().refreshBalance();
          
          // Show tip animation
          setTips(prev => [...prev, {
            fromUserId: user?.id || '',
            fromDisplayName: user?.display_name || 'You',
            amount: tipAmount,
            message: tipMessage,
            timestamp: new Date().toISOString()
          }]);
        }
      }

      setTipAmount(0);
      setTipMessage('');
    } catch (error) {
      console.error('Failed to send tip:', error);
      setError(error instanceof Error ? error.message : 'Failed to send tip');
    }
  }, [streamId, tipAmount, tipMessage, user, enableDemoMode, streamInfo]);

  // Send message
  const handleSendMessage = useCallback(async () => {
    if (!socketRef.current || !newMessage.trim()) return;

    try {
      if (enableDemoMode) {
        // Demo mode - just add to messages
        const newMessageObj = {
          fromUserId: user?.id || 'demo-user',
          fromDisplayName: user?.display_name || 'You',
          message: newMessage.trim(),
          type: 'text',
          timestamp: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, newMessageObj]);
      } else {
        // Real message - send via socket to backend
        const response = await new Promise<any>((resolve, reject) => {
          socketRef.current!.emit('send_message', {
            streamId,
            message: newMessage.trim(),
            type: 'chat'
          }, (data: any) => {
            if (data.error) {
              reject(new Error(data.error));
            } else {
              resolve(data);
            }
          });
        });

        if (!response.success) {
          throw new Error('Failed to send message');
        }
      }

      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
    }
  }, [streamId, newMessage, enableDemoMode, user]);

  // Track view time for guests
  useEffect(() => {
    if (isGuest) {
      const interval = setInterval(() => {
        viewTimeRef.current += 1;
        setViewTime(viewTimeRef.current);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isGuest]);

  // Fetch stream info first (runs once when component mounts or streamId changes)
  useEffect(() => {
    if (!streamId) return;
    
    // Reset join flags when streamId changes
    hasJoinedRoomRef.current = false;
    isJoiningRef.current = false;
    
    // Fetch stream info and join room (this sets up the UI)
    // Don't wait for socket - show UI immediately
    // Use a ref to prevent re-runs
    if (!hasJoinedRoomRef.current) {
      joinStreamRoom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId]); // Only re-run when streamId changes

  // Initialize socket connection (separate from stream fetching)
  useEffect(() => {
    if (!streamId) return;
    
    // Prevent multiple socket initializations
    if (socketInitializedRef.current && socketRef.current && socketRef.current.connected) {
      // Socket already initialized and connected, just set up handlers
      return;
    }
    
    // Reset socket initialization flag when streamId changes
    if (!socketInitializedRef.current) {
      socketInitializedRef.current = true;
    }
    
    // Then set up socket connection (for WebRTC and real-time updates)
    const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    const socketOptions: any = {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    };

    // Add auth token if authenticated
    const currentToken = useAuthStore.getState().token;
    if (currentToken) {
      socketOptions.auth = { token: currentToken };
    }

    // Only create new socket if we don't have one or it's disconnected
    if (!socketRef.current || !socketRef.current.connected) {
      socketRef.current = io(API_BASE.replace('/api', ''), socketOptions);
    }
    
    const socket = socketRef.current;

    // Handle connection events - only join room if we haven't already
    const handleConnect = () => {
      console.log('Socket connected');
      // Only try to join WebRTC room if we have stream info and haven't joined yet
      // Use ref to check streamInfo without causing re-renders
      if (streamInfoRef.current && !hasJoinedRoomRef.current && socket.connected) {
        // This will join the WebRTC room (non-blocking, UI already shown)
        setTimeout(() => {
          if (!hasJoinedRoomRef.current && !isJoiningRef.current) {
            // Only join WebRTC part, don't refetch stream info
            (async () => {
              try {
                if (!socketRef.current || !socketRef.current.connected) return;
                
                const response = await new Promise<any>((resolve, reject) => {
                  const timeout = setTimeout(() => {
                    reject(new Error('Socket timeout'));
                  }, 5000);
                  
                  socketRef.current!.emit('join_room', {
                    roomId: streamId
                  }, (data: any) => {
                    clearTimeout(timeout);
                    if (data && data.error) {
                      reject(new Error(data.error));
                    } else {
                      resolve(data || { success: true });
                    }
                  });
                });
                
                // Initialize WebRTC if capabilities available
                if (response && response.rtpCapabilities && !enableDemoMode) {
                  try {
                    await initializeDevice(response.rtpCapabilities);
                    if (!isPerformer) {
                      await createTransport('recv');
                    }
                    for (const producerId of response.existingProducers || []) {
                      await createConsumer(producerId);
                    }
                  } catch (webrtcError) {
                    console.warn('WebRTC init failed:', webrtcError);
                  }
                }
              } catch (error) {
                console.warn('WebRTC join failed (non-critical):', error);
              }
            })();
          }
        }, 500);
      }
    };
    
    socket.on('connect', handleConnect);
    
    // If socket is already connected, handle it
    if (socket.connected) {
      handleConnect();
    }

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socket.on('error', (error: any) => {
      console.error('Socket error:', error);
      if (error.message === 'AUTHENTICATION_REQUIRED' && isGuest) {
        // Guest trying to access authenticated feature
        setError('Please sign in to use this feature');
      } else {
        setError(error.message || 'Connection error');
      }
      // Ensure loading is set to false on error
      setLoading(false);
    });
    
    // Connection timeout fallback - if socket doesn't connect within 10 seconds, continue anyway
    const connectionTimeout = setTimeout(() => {
      if (!socket.connected && loading && !hasJoinedRoomRef.current) {
        console.warn('Socket connection timeout, continuing without socket...');
        // Try to join stream room anyway (will use API fallback)
        joinStreamRoom();
      }
    }, 10000);

    // Set up demo data for better UX (only for demo mode)
    if (enableDemoMode) {
      setStreamInfo({
        id: streamId || 'demo-stream',
        host_id: 'demo-host-id',
        title: 'Welcome to my room! 💕',
        description: 'Come chat with me! I love dancing and chatting with viewers.',
        host_name: 'Emma Rose',
        host_avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
        status: 'live',
        viewer_count: 127,
        category: 'dance',
        is_private: false,
        total_tokens_received: 1250
      });
      
      setRoomStats({ totalViewers: 127, totalPerformers: 1 });
      
      // Add demo chat messages
      setMessages([
        {
          fromUserId: 'demo1',
          fromDisplayName: 'Emma Rose',
          message: 'Welcome everyone! Thanks for joining my stream! 💕',
          type: 'text',
          timestamp: new Date(Date.now() - 300000).toISOString()
        },
        {
          fromUserId: 'demo2',
          fromDisplayName: 'Viewer123',
          message: 'Hey Emma! Love your setup!',
          type: 'text',
          timestamp: new Date(Date.now() - 240000).toISOString()
        },
        {
          fromUserId: 'demo3',
          fromDisplayName: 'FanGirl99',
          message: 'Can you play some music?',
          type: 'text',
          timestamp: new Date(Date.now() - 180000).toISOString()
        },
        {
          fromUserId: 'demo4',
          fromDisplayName: 'TipMaster',
          message: 'Just sent you a tip! 💰',
          type: 'tip',
          timestamp: new Date(Date.now() - 120000).toISOString()
        },
        {
          fromUserId: 'demo5',
          fromDisplayName: 'NewViewer',
          message: 'First time here, this is amazing!',
          type: 'text',
          timestamp: new Date(Date.now() - 60000).toISOString()
        }
      ]);
      
      setLoading(false);
      setIsConnected(true);
    }

    // Socket event handlers
    socket.on('user_joined', (data) => {
      console.log('User joined:', data);
      setRoomStats(prev => ({
        ...prev,
        totalViewers: data.totalViewers || prev.totalViewers + 1
      }));
    });

    socket.on('user_left', (data) => {
      console.log('User left:', data);
      setRoomStats(prev => ({
        ...prev,
        totalViewers: Math.max(0, (data.totalViewers || prev.totalViewers) - 1)
      }));
    });

    socket.on('room_state', (data) => {
      console.log('Room state:', data);
      setRoomStats({
        totalViewers: data.viewers?.length || 0,
        totalPerformers: data.performers?.length || 0
      });
    });

    socket.on('new_producer', (data) => {
      console.log('New producer:', data);
      if (!enableDemoMode) {
        createConsumer(data.producerId);
      }
    });

    socket.on('producer_closed', (data) => {
      console.log('Producer closed:', data);
      const consumer = consumers.get(data.producerId);
      if (consumer) {
        consumer.close();
        setConsumers(prev => {
          const newConsumers = new Map(prev);
          newConsumers.delete(data.producerId);
          return newConsumers;
        });
      }
    });

    socket.on('tip_received', (data) => {
      console.log('Tip received:', data);
      setTips(prev => [...prev, data]);
    });

    socket.on('message_received', (data) => {
      console.log('Message received:', data);
      setMessages(prev => [...prev, data]);
    });

    socket.on('chat_message', (data) => {
      console.log('Chat message:', data);
      setMessages(prev => [...prev, {
        fromUserId: data.userId,
        fromDisplayName: data.displayName,
        message: data.message,
        type: data.type,
        timestamp: data.timestamp
      }]);
    });

    socket.on('stream_started', (data) => {
      console.log('Stream started:', data);
      setIsStreaming(true);
    });

    socket.on('stream_ended', (data) => {
      console.log('Stream ended:', data);
      setIsStreaming(false);
    });

    socket.on('stream_status_changed', (data) => {
      console.log('Stream status changed:', data);
      if (data.status === 'live') {
        setIsStreaming(true);
      } else {
        setIsStreaming(false);
      }
    });

    socket.on('viewer_count_changed', (data) => {
      console.log('Viewer count changed:', data);
      setRoomStats(prev => ({
        ...prev,
        totalViewers: data.count
      }));
    });

    // Cleanup function - only cleanup on unmount or streamId change
    return () => {
      clearTimeout(connectionTimeout);
      socketInitializedRef.current = false;
      hasJoinedRoomRef.current = false;
      isJoiningRef.current = false;
      if (socketRef.current) {
        socketRef.current.off('connect', handleConnect);
        socketRef.current.off('disconnect');
        socketRef.current.off('error');
        socketRef.current.off('user_joined');
        socketRef.current.off('user_left');
        socketRef.current.off('room_state');
        socketRef.current.off('new_producer');
        socketRef.current.off('producer_closed');
        socketRef.current.off('tip_received');
        socketRef.current.off('message_received');
        socketRef.current.off('chat_message');
        socketRef.current.off('stream_started');
        socketRef.current.off('stream_ended');
        socketRef.current.off('stream_status_changed');
        socketRef.current.off('viewer_count_changed');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId]); // Only re-run when streamId changes - prevent glitchy re-renders

  // Start streaming when performer joins
  useEffect(() => {
    if (isConnected && isPerformer && !isStreaming) {
      startLocalStream();
    }
  }, [isConnected, isPerformer, isStreaming, startLocalStream]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-pink-500 mx-auto"></div>
          <p className="text-white mt-4">Joining stream...</p>
        </div>
      </div>
    );
  }

  // If stream not found, offer demo mode
  if (error && error.toLowerCase().includes('not found') && !enableDemoMode) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-yellow-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-4">Stream Not Found</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => {
                setEnableDemoMode(true);
                setError(null);
                // Initialize demo data
                setStreamInfo({
                  id: streamId || 'demo-stream',
                  host_id: user?.id || 'demo-user',
                  title: 'Demo Stream - UI Testing',
                  description: 'This is a demo stream to test the UI features. The actual stream data is not available.',
                  host_name: user?.display_name || 'Demo Performer',
                  host_avatar: user?.profile_image_url || 'https://ui-avatars.com/api/?name=Demo',
                  status: 'live',
                  viewer_count: 1234,
                  category: 'demo',
                  tags: ['demo', 'testing', 'ui'],
                  is_private: false,
                  total_tokens_received: 5678,
                  sfu_room_id: 'demo-room',
                });
                setRoomStats({ totalViewers: 1234, totalPerformers: 1 });
                setIsStreaming(true);
                setLoading(false);
                setIsConnected(true);
              }}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Test UI in Demo Mode
            </button>
            <button
              onClick={() => navigate('/streams')}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Back to Streams
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Regular error (not "not found")
  if (error && !enableDemoMode) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-4">Stream Error</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={() => navigate('/streams')}
            className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 rounded-lg"
          >
            Back to Streams
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={leaveStreamRoom}
            className="text-gray-400 hover:text-white"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-xl font-bold">{streamInfo?.title}</h1>
            <p className="text-sm text-gray-400">
              by {streamInfo?.host_name} • {roomStats.totalViewers} viewers
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {!isPerformer && streamInfo && (
            <button
              onClick={() => {
                setReportTarget({
                  userId: streamInfo.host_id,
                  userName: streamInfo.host_name,
                  contentType: 'stream',
                  contentId: streamInfo.id,
                  contentPreview: `Stream: ${streamInfo.title}`
                });
                setReportModalOpen(true);
              }}
              className="flex items-center space-x-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
              title="Report this stream"
            >
              <Flag className="h-4 w-4" />
              <span className="text-sm">Report</span>
            </button>
          )}
          <div className="text-sm">
            <span className="text-gray-400">Your Tokens:</span>
            <span className="ml-2 font-bold text-pink-500">{tokenBalance}</span>
          </div>
          {isPerformer && (
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isStreaming ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm">{isStreaming ? 'Live' : 'Offline'}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex h-screen">
        {/* Main Video Area */}
        <div className="flex-1 relative">
          {/* Video Container */}
          <div className="relative w-full h-full bg-black">
            {/* Remote Video (for viewers) */}
            {!isPerformer && (
              <>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {/* Placeholder when no video stream */}
                {!remoteVideoRef.current?.srcObject && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                    <div className="text-center">
                      <div className="w-32 h-32 bg-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-4xl">🎥</span>
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2">Stream Starting Soon</h3>
                      <p className="text-gray-400 mb-4">The performer is setting up their stream</p>
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-sm text-gray-300">Waiting for stream...</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Local Video (for performers) */}
            {isPerformer && (
              <>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Placeholder when no local stream */}
                {!localVideoRef.current?.srcObject && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                    <div className="text-center">
                      <div className="w-32 h-32 bg-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-4xl">📹</span>
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2">Ready to Stream</h3>
                      <p className="text-gray-400 mb-4">Click "Start Streaming" to begin</p>
                      <button
                        onClick={startLocalStream}
                        className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 rounded-lg font-bold"
                      >
                        Start Streaming
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Stream Overlay */}
            <div className="absolute top-4 left-4 bg-black bg-opacity-50 rounded-lg p-3">
              <h2 className="font-bold text-lg">{streamInfo?.title}</h2>
              <p className="text-sm text-gray-300">{streamInfo?.description}</p>
            </div>

            {/* Viewer Count */}
            <div className="absolute top-4 right-4 bg-black bg-opacity-50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="font-bold">{roomStats.totalViewers}</span>
                <span className="text-sm text-gray-300">viewers</span>
              </div>
            </div>

            {/* Demo Mode Indicator */}
            {enableDemoMode && (
              <div className="absolute bottom-4 left-4 bg-yellow-600 bg-opacity-90 rounded-lg p-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm">🎭</span>
                  <span className="text-sm font-medium">Demo Mode</span>
                </div>
              </div>
            )}

            {/* Tip Animations */}
            <div className="absolute inset-0 pointer-events-none">
              {(enableDemoMode ? demoTips : tips).map((tip, index) => (
                <div
                  key={`${tip.fromUserId}-${tip.timestamp}-${index}`}
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-bounce"
                  style={{ 
                    animationDelay: `${index * 0.5}s`,
                    animationDuration: '2s'
                  }}
                >
                  <div className="bg-pink-500 text-white px-4 py-2 rounded-full font-bold text-lg shadow-lg">
                    💰 {tip.amount} tokens
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-gray-800 flex flex-col">
          {/* Chat Section */}
          <div className="flex-1 p-4">
            <h3 className="font-bold mb-4">Chat</h3>
            <div className="space-y-2 h-64 overflow-y-auto">
              {messages.map((message, index) => (
                <div key={`${message.fromUserId}-${message.timestamp}-${index}`} className="text-sm">
                  <div className="flex items-start space-x-2">
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center text-xs font-bold">
                        {message.fromDisplayName.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-pink-400">{message.fromDisplayName}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        {message.fromUserId !== user?.id && (
                          <button
                            onClick={() => {
                              setReportTarget({
                                userId: message.fromUserId,
                                userName: message.fromDisplayName,
                                contentType: 'message',
                                contentId: message.id || undefined,
                                contentPreview: `Message: ${message.message}`
                              });
                              setReportModalOpen(true);
                            }}
                            className="text-gray-400 hover:text-red-400 transition-colors"
                            title="Report this message"
                          >
                            <Flag className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-gray-200 mt-1 break-words">{message.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Message Input */}
            <div className="mt-4 flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg text-sm"
              />
              <button
                onClick={handleSendMessage}
                className="bg-pink-500 hover:bg-pink-600 px-4 py-2 rounded-lg text-sm"
              >
                Send
              </button>
            </div>
          </div>

          {/* Tips Section */}
          <div className="p-4 border-t border-gray-700">
            <h3 className="font-bold mb-4">Send Tip</h3>
            {isGuest ? (
              <div className="bg-pink-900 bg-opacity-50 border border-pink-500 rounded-lg p-4 text-center">
                <p className="text-sm text-pink-200 mb-3">
                  Support performers by sending tips! Get tokens to unlock this feature.
                </p>
                <button
                  onClick={() => navigate('/quick-register', { 
                    state: { from: `/stream/${streamId}` } 
                  })}
                  className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Get Tokens
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Amount</label>
                  <input
                    type="number"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(parseInt(e.target.value) || 0)}
                    min="1"
                    max="1000"
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Message (optional)</label>
                  <input
                    type="text"
                    value={tipMessage}
                    onChange={(e) => setTipMessage(e.target.value)}
                    placeholder="Say something nice..."
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-sm"
                  />
                </div>
                <button
                  onClick={handleSendTip}
                  disabled={tipAmount <= 0 || tipAmount > tokenBalance}
                  className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 rounded-lg font-bold"
                >
                  Send {tipAmount} Tokens
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Guest Conversion Prompts */}
      {isGuest && (
        <GuestPrompts
          onSignUp={() => {
            navigate('/quick-register', { 
              state: { 
                from: `/stream/${streamId}`,
                redirectAfter: `/stream/${streamId}`
              } 
            });
          }}
          onBuyTokens={() => {
            navigate('/quick-register', { 
              state: { 
                from: `/stream/${streamId}`,
                redirectAfter: `/stream/${streamId}`
              } 
            });
          }}
          viewTime={viewTime}
          streamId={streamId}
        />
      )}

      {/* Report Modal */}
      {reportTarget && (
        <ReportContent
          isOpen={reportModalOpen}
          onClose={() => {
            setReportModalOpen(false);
            setReportTarget(null);
          }}
          reportedUserId={reportTarget.userId}
          reportedUserName={reportTarget.userName}
          contentType={reportTarget.contentType}
          contentId={reportTarget.contentId}
          contentPreview={reportTarget.contentPreview}
        />
      )}
    </div>
  );
};

export default StreamingRoom;
