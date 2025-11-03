import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Trash2,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  Flag,
  Shield,
  DollarSign,
  Video,
  Settings,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const { token, user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [markingAsRead, setMarkingAsRead] = useState<string | null>(null);
  const [expandedNotifications, setExpandedNotifications] = useState<Set<string>>(new Set());
  const socketRef = useRef<any>(null);
  const notificationListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      fetchUnreadCount();
      setupSocketConnection();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isOpen, token]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/notifications?limit=50&offset=0`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/unread/count`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const setupSocketConnection = () => {
    if (!token || !user) return;

    try {
      const { io } = require('socket.io-client');
      const socket = io(API_BASE_URL, {
        auth: {
          token,
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Notification socket connected');
      });

      // Listen for new notifications
      socket.on('notification_created', (notification: Notification) => {
        console.log('New notification received:', notification);
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);
      });

      socket.on('disconnect', () => {
        console.log('Notification socket disconnected');
      });
    } catch (error) {
      console.error('Error setting up socket connection:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (markingAsRead) return;

    try {
      setMarkingAsRead(notificationId);
      const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    } finally {
      setMarkingAsRead(null);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const notification = notifications.find(n => n.id === notificationId);
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        if (notification && !notification.is_read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const toggleExpand = (notificationId: string) => {
    setExpandedNotifications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'kyc_approved':
      case 'kyc_status_updated':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'kyc_rejected':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
      case 'suspension':
      case 'ban':
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
      case 'tip_received':
        return <DollarSign className="h-5 w-5 text-green-600" />;
      case 'stream_started':
      case 'stream_ended':
        return <Video className="h-5 w-5 text-blue-600" />;
      case 'report_resolved':
        return <Shield className="h-5 w-5 text-purple-600" />;
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'kyc_approved':
      case 'kyc_status_updated':
        return 'bg-green-50 border-green-200';
      case 'kyc_rejected':
        return 'bg-red-50 border-red-200';
      case 'warning':
      case 'suspension':
      case 'ban':
        return 'bg-orange-50 border-orange-200';
      case 'tip_received':
        return 'bg-green-50 border-green-200';
      case 'stream_started':
      case 'stream_ended':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" onClick={onClose}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" />

      {/* Notification Panel */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl transform transition-transform duration-300 ease-in-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3">
            <Bell className="h-6 w-6 text-gray-700" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
              {unreadCount > 0 && (
                <p className="text-sm text-gray-500">{unreadCount} unread</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex items-center space-x-1"
                title="Mark all as read"
              >
                <CheckCheck className="h-4 w-4" />
                <span>Mark all read</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div
          ref={notificationListRef}
          className="h-[calc(100vh-80px)] overflow-y-auto"
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Bell className="h-12 w-12 text-gray-300 mb-4" />
              <p className="text-gray-500 text-center">No notifications yet</p>
              <p className="text-sm text-gray-400 text-center mt-2">
                You'll see updates about your KYC status, tips, and more here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => {
                const isExpanded = expandedNotifications.has(notification.id);
                const hasDetails = notification.data && Object.keys(notification.data).length > 0;

                return (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      !notification.is_read ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <p className={`text-sm font-medium ${
                                !notification.is_read ? 'text-gray-900 font-semibold' : 'text-gray-700'
                              }`}>
                                {notification.title}
                              </p>
                              {!notification.is_read && (
                                <span className="h-2 w-2 bg-blue-600 rounded-full"></span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center space-x-3 mt-2">
                              <span className="text-xs text-gray-400">
                                {formatTime(notification.created_at)}
                              </span>
                              {hasDetails && (
                                <button
                                  onClick={() => toggleExpand(notification.id)}
                                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                                >
                                  <span>{isExpanded ? 'Show less' : 'Show details'}</span>
                                  {isExpanded ? (
                                    <ChevronUp className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && hasDetails && (
                              <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                                <pre className="text-xs text-gray-600 overflow-x-auto">
                                  {JSON.stringify(notification.data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                            {!notification.is_read && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                disabled={markingAsRead === notification.id}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                title="Mark as read"
                              >
                                {markingAsRead === notification.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => deleteNotification(notification.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Delete notification"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
            <button
              onClick={() => {
                fetchNotifications();
                fetchUnreadCount();
              }}
              className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md border border-gray-300 transition-colors"
            >
              Refresh Notifications
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;

