import { useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

interface KYCStatusUpdate {
  verificationId: string;
  userId: string;
  status: 'approved' | 'rejected' | 'pending' | 'requires_review';
  notes: string | null;
  timestamp: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

interface UseKYCSocketOptions {
  onStatusUpdate?: (update: KYCStatusUpdate) => void;
  onError?: (error: Error) => void;
}

export const useKYCSocket = (options: UseKYCSocketOptions = {}) => {
  const { token, user } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);
  const { onStatusUpdate, onError } = options;

  useEffect(() => {
    // Only connect if user is authenticated and has token
    if (!token || !user) {
      return;
    }

    // Create socket connection
    const socket = io(SOCKET_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('KYC Socket connected');
    });

    socket.on('disconnect', (reason) => {
      console.log('KYC Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('KYC Socket connection error:', error);
      if (onError) {
        onError(new Error('Failed to connect to server'));
      }
    });

    // Listen for KYC status updates
    const handleStatusUpdate = (update: KYCStatusUpdate) => {
      console.log('KYC status updated:', update);
      
      // Only handle updates for the current user
      if (update.userId === user?.id) {
        if (onStatusUpdate) {
          onStatusUpdate(update);
        }
      }
    };

    socket.on('kyc_status_updated', handleStatusUpdate);

    // Cleanup on unmount
    return () => {
      socket.off('kyc_status_updated', handleStatusUpdate);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user?.id, onStatusUpdate, onError]);

  // Return socket instance and helper functions
  return {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected || false,
  };
};

