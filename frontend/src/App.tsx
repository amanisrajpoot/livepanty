import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useStreamStore } from './store/streamStore';

// Components
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import QuickRegister from './pages/QuickRegister';
import GuestStreams from './pages/GuestStreams';
import Dashboard from './pages/Dashboard';
import StreamingRoom from './components/StreamingRoom';
import CreateStream from './pages/CreateStream';
import Profile from './pages/Profile';
import Wallet from './pages/Wallet';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';
import TokenPurchase from './components/TokenPurchase';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; requireAuth?: boolean; requireRole?: string }> = ({
  children,
  requireAuth = true,
  requireRole,
}) => {
  const { isAuthenticated, user } = useAuthStore();

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireRole && user?.role !== requireRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Public Route Component (redirect if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  const { isAuthenticated, token, refreshAuth } = useAuthStore();
  const { connectSocket, disconnectSocket } = useStreamStore();

  // Initialize authentication and socket connection
  useEffect(() => {
    if (isAuthenticated && token) {
      // Connect to socket for real-time features
      connectSocket(token);
      
      // Refresh token periodically
      const interval = setInterval(() => {
        refreshAuth();
      }, 30 * 60 * 1000); // 30 minutes

      return () => {
        clearInterval(interval);
        disconnectSocket();
      };
    } else {
      disconnectSocket();
    }
  }, [isAuthenticated, token, connectSocket, disconnectSocket, refreshAuth]);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/streams" element={<GuestStreams />} />
          
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />

          <Route
            path="/quick-register"
            element={
              <PublicRoute>
                <QuickRegister />
              </PublicRoute>
            }
          />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/stream/:streamId"
            element={
              <ProtectedRoute>
                <StreamingRoom />
              </ProtectedRoute>
            }
          />

          <Route
            path="/create-stream"
            element={
              <ProtectedRoute>
                <Layout>
                  <CreateStream />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Layout>
                  <Profile />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/wallet"
            element={
              <ProtectedRoute>
                <Layout>
                  <Wallet />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/buy-tokens"
            element={
              <ProtectedRoute>
                <TokenPurchase />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute requireRole="admin">
                <Layout>
                  <Admin />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;