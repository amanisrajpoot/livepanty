import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useWalletStore } from '../store/walletStore';
import NotificationCenter from './NotificationCenter';
import { 
  Home, 
  Video, 
  Plus, 
  User, 
  Wallet, 
  LogOut, 
  Menu, 
  X,
  Settings,
  Shield,
  Bell
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);
  const location = useLocation();
  const navigate = useNavigate();
  const socketRef = useRef<any>(null);
  
  const { user, logout, token } = useAuthStore();
  const { tokenBalance, fetchBalance } = useWalletStore();

  // Fetch wallet balance when component mounts
  React.useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Fetch unread notification count
  useEffect(() => {
    if (!token || !user) return;

    const fetchUnreadCount = async () => {
      try {
        const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const response = await fetch(`${API_BASE_URL}/api/notifications/unread/count`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUnreadNotificationCount(data.count || 0);
        }
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchUnreadCount();

    // Set up socket connection for real-time updates
    try {
      const { io } = require('socket.io-client');
      const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:3001', {
        auth: {
          token,
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Layout socket connected');
      });

      // Listen for new notifications
      socket.on('notification_created', () => {
        fetchUnreadCount();
      });

      // Cleanup on unmount
      return () => {
        if (socket) {
          socket.disconnect();
          socketRef.current = null;
        }
      };
    } catch (error) {
      console.error('Error setting up socket connection:', error);
    }
  }, [token, user]);

  const handleLogout = () => {
    logout();
    navigate('/');
    setUserMenuOpen(false);
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Streams', href: '/dashboard', icon: Video },
    { name: 'Create Stream', href: '/create-stream', icon: Plus },
    { name: 'Wallet', href: '/wallet', icon: Wallet },
    { name: 'KYC Verification', href: '/kyc', icon: Shield },
    { name: 'Profile', href: '/profile', icon: User },
  ];

  // Add admin links if user is admin
  if (user?.role === 'admin') {
    navigation.push({ name: 'Admin Dashboard', href: '/admin-dashboard', icon: Settings });
  }

  const isActive = (href: string) => {
    if (href === '/dashboard' && location.pathname === '/') return true;
    return location.pathname === href;
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-gray-600 opacity-75"></div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">LivePanty</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* User info */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.display_name}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.role === 'admin' ? 'Admin' : user?.role === 'performer' ? 'Performer' : 'Viewer'}
              </p>
            </div>
          </div>
          
          {/* Wallet balance */}
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Token Balance</span>
              <span className="text-sm font-medium text-gray-900">
                {tokenBalance.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-3">
          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200
                    ${isActive(item.href)
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="mr-3 w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Top bar */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center space-x-4">
              {/* Search bar */}
              <div className="hidden md:block">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search streams..."
                    className="w-64 pl-4 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setNotificationCenterOpen(true)}
                  className="relative p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Notifications"
                >
                  <Bell className="h-5 w-5 text-gray-600" />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute top-0 right-0 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center transform translate-x-1/2 -translate-y-1/2">
                      {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                    </span>
                  )}
                </button>
              </div>

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50"
                >
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-primary-600" />
                  </div>
                  <span className="hidden md:block text-sm font-medium text-gray-700">
                    {user?.display_name}
                  </span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      <Link
                        to="/profile"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <User className="w-4 h-4 mr-3" />
                        Profile
                      </Link>
                      <Link
                        to="/wallet"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Wallet className="w-4 h-4 mr-3" />
                        Wallet
                      </Link>
                      <Link
                        to="/settings"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Settings className="w-4 h-4 mr-3" />
                        Settings
                      </Link>
                      <hr className="my-1" />
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="w-4 h-4 mr-3" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Notification Center */}
      <NotificationCenter
        isOpen={notificationCenterOpen}
        onClose={() => {
          setNotificationCenterOpen(false);
          // Refresh unread count when closing
          if (token && user) {
            const fetchUnreadCount = async () => {
              try {
                const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
                const response = await fetch(`${API_BASE_URL}/api/notifications/unread/count`, {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                });
                if (response.ok) {
                  const data = await response.json();
                  setUnreadNotificationCount(data.count || 0);
                }
              } catch (error) {
                console.error('Error fetching unread count:', error);
              }
            };
            fetchUnreadCount();
          }
        }}
      />
    </div>
  );
};

export default Layout;
