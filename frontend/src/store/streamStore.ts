import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './authStore';

interface Stream {
  id: string;
  host_id: string;
  host_name: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  is_private: boolean;
  is_age_restricted: boolean;
  status: 'created' | 'live' | 'ended' | 'cancelled';
  started_at?: string;
  ended_at?: string;
  viewer_count: number;
  peak_viewer_count: number;
  total_tokens_received: number;
  thumbnail_url?: string;
  created_at: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  message: string;
  type: 'text' | 'tip' | 'system';
  timestamp: string;
}

interface Tip {
  id: string;
  fromUserId: string;
  fromDisplayName: string;
  toUserId: string;
  tokens: number;
  message?: string;
  isPrivate: boolean;
  timestamp: string;
}

interface StreamState {
  streams: Stream[];
  currentStream: Stream | null;
  currentViewers: string[];
  chatMessages: ChatMessage[];
  tips: Tip[];
  socket: Socket | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

interface StreamActions {
  // Stream management
  fetchStreams: () => Promise<void>;
  createStream: (streamData: CreateStreamData) => Promise<void>;
  joinStream: (streamId: string, role: 'viewer' | 'performer') => void;
  leaveStream: (streamId: string) => void;
  startStream: (streamId: string) => Promise<void>;
  endStream: (streamId: string) => Promise<void>;
  
  // Real-time features
  connectSocket: (token: string) => void;
  disconnectSocket: () => void;
  sendMessage: (message: string, type?: 'text' | 'tip') => void;
  sendTip: (toUserId: string, tokens: number, message?: string, isPrivate?: boolean) => void;
  
  // State management
  setCurrentStream: (stream: Stream | null) => void;
  addChatMessage: (message: ChatMessage) => void;
  addTip: (tip: Tip) => void;
  updateViewerCount: (count: number) => void;
  clearError: () => void;
}

interface CreateStreamData {
  title: string;
  description?: string;
  category: string;
  tags?: string[];
  is_private?: boolean;
  tip_enabled?: boolean;
  chat_enabled?: boolean;
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

export const useStreamStore = create<StreamState & StreamActions>((set, get) => ({
  // State
  streams: [],
  currentStream: null,
  currentViewers: [],
  chatMessages: [],
  tips: [],
  socket: null,
  isConnected: false,
  isLoading: false,
  error: null,

  // Actions
  fetchStreams: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const { token } = useAuthStore.getState();
      
      const response = await fetch(`${API_BASE_URL}/api/streams`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch streams');
      }

      set({ streams: data.streams, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch streams',
        isLoading: false,
      });
    }
  },

  createStream: async (streamData: CreateStreamData) => {
    set({ isLoading: true, error: null });
    
    try {
      const { token } = useAuthStore.getState();
      
      const response = await fetch(`${API_BASE_URL}/api/streams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(streamData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create stream');
      }

      // Add to streams list
      const newStream = {
        id: data.stream_id,
        host_id: useAuthStore.getState().user?.id || '',
        host_name: useAuthStore.getState().user?.display_name || '',
        title: streamData.title,
        description: streamData.description,
        category: streamData.category,
        tags: streamData.tags,
        is_private: streamData.is_private || false,
        is_age_restricted: true,
        status: 'created' as const,
        viewer_count: 0,
        peak_viewer_count: 0,
        total_tokens_received: 0,
        created_at: new Date().toISOString(),
      };

      set(state => ({
        streams: [newStream, ...state.streams],
        currentStream: newStream,
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create stream',
        isLoading: false,
      });
    }
  },

  joinStream: (streamId: string, role: 'viewer' | 'performer') => {
    const { socket } = get();
    
    if (socket && socket.connected) {
      socket.emit('join_stream', { streamId, role });
    }
  },

  leaveStream: (streamId: string) => {
    const { socket } = get();
    
    if (socket && socket.connected) {
      socket.emit('leave_stream', { streamId });
    }
    
    set({
      currentStream: null,
      chatMessages: [],
      tips: [],
      currentViewers: [],
    });
  },

  startStream: async (streamId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const { token } = useAuthStore.getState();
      
      const response = await fetch(`${API_BASE_URL}/api/streams/${streamId}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to start stream');
      }

      set(state => ({
        streams: state.streams.map(stream =>
          stream.id === streamId
            ? { ...stream, status: 'live', started_at: data.started_at }
            : stream
        ),
        currentStream: state.currentStream?.id === streamId
          ? { ...state.currentStream, status: 'live', started_at: data.started_at }
          : state.currentStream,
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to start stream',
        isLoading: false,
      });
    }
  },

  endStream: async (streamId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const { token } = useAuthStore.getState();
      
      const response = await fetch(`${API_BASE_URL}/api/streams/${streamId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to end stream');
      }

      set(state => ({
        streams: state.streams.map(stream =>
          stream.id === streamId
            ? { ...stream, status: 'ended', ended_at: data.ended_at }
            : stream
        ),
        currentStream: state.currentStream?.id === streamId
          ? { ...state.currentStream, status: 'ended', ended_at: data.ended_at }
          : state.currentStream,
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to end stream',
        isLoading: false,
      });
    }
  },

  connectSocket: (token: string) => {
    const socket = io(SOCKET_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      set({ isConnected: true });
    });

    socket.on('disconnect', () => {
      set({ isConnected: false });
    });

    socket.on('room_state', (data) => {
      set({
        currentViewers: [...data.performers, ...data.viewers],
      });
    });

    socket.on('user_joined', (data) => {
      set(state => ({
        currentViewers: [...state.currentViewers, data.userId],
      }));
    });

    socket.on('user_left', (data) => {
      set(state => ({
        currentViewers: state.currentViewers.filter(id => id !== data.userId),
      }));
    });

    socket.on('chat_message', (message: ChatMessage) => {
      set(state => ({
        chatMessages: [...state.chatMessages, message],
      }));
    });

    socket.on('tip_received', (tip: Tip) => {
      set(state => ({
        tips: [...state.tips, tip],
      }));
    });

    socket.on('error', (error) => {
      set({ error: error.message });
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const { socket } = get();
    
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  sendMessage: (message: string, type: 'text' | 'tip' = 'text') => {
    const { socket, currentStream } = get();
    
    if (socket && socket.connected && currentStream) {
      socket.emit('send_message', {
        streamId: currentStream.id,
        message,
        type,
      });
    }
  },

  sendTip: (toUserId: string, tokens: number, message?: string, isPrivate?: boolean) => {
    const { socket, currentStream } = get();
    
    if (socket && socket.connected && currentStream) {
      socket.emit('send_tip', {
        streamId: currentStream.id,
        toUserId,
        tokens,
        message,
        isPrivate,
      });
    }
  },

  setCurrentStream: (stream: Stream | null) => {
    set({ currentStream: stream });
  },

  addChatMessage: (message: ChatMessage) => {
    set(state => ({
      chatMessages: [...state.chatMessages, message],
    }));
  },

  addTip: (tip: Tip) => {
    set(state => ({
      tips: [...state.tips, tip],
    }));
  },

  updateViewerCount: (count: number) => {
    set(state => ({
      currentStream: state.currentStream
        ? { ...state.currentStream, viewer_count: count }
        : null,
    }));
  },

  clearError: () => {
    set({ error: null });
  },
}));

