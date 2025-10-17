import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  Users, 
  Activity, 
  Shield, 
  FileText, 
  AlertTriangle, 
  TrendingUp,
  BarChart3,
  Settings,
  Eye,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

interface PlatformOverview {
  users: {
    total_users: number;
    new_users_today: number;
    new_users_week: number;
    total_performers: number;
    total_viewers: number;
    active_users: number;
    suspended_users: number;
    banned_users: number;
    kyc_verified_users: number;
  };
  streams: {
    total_streams: number;
    live_streams: number;
    ended_streams: number;
    streams_today: number;
    avg_viewer_count: number;
    max_viewer_count: number;
    total_tokens_received: number;
  };
  financial: {
    total_tokens_in_circulation: number;
    total_tokens_purchased: number;
    total_tokens_tipped: number;
    total_tokens_paid_out: number;
    total_purchases: number;
    total_tips: number;
    avg_tip_amount: number;
  };
  kyc: {
    total_verifications: number;
    pending_verifications: number;
    approved_verifications: number;
    rejected_verifications: number;
    verifications_today: number;
  };
  moderation: {
    total_reports: number;
    pending_reports: number;
    approved_reports: number;
    rejected_reports: number;
    escalated_reports: number;
    reports_today: number;
  };
}

const AdminDashboard: React.FC = () => {
  const { user, token } = useAuthStore();
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (user?.role !== 'admin') {
      window.location.href = '/dashboard';
      return;
    }
    fetchOverview();
  }, [user]);

  const fetchOverview = async () => {
    try {
      const response = await fetch('/api/admin/overview', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOverview(data.overview);
      }
    } catch (error) {
      console.error('Error fetching overview:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access the admin dashboard.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'kyc', label: 'KYC', icon: FileText },
    { id: 'moderation', label: 'Moderation', icon: Shield },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600">Manage your platform</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Welcome, {user?.display_name}</span>
              <div className="h-8 w-8 bg-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user?.display_name?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && overview && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Users Stats */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Users className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Users</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {overview.users.total_users.toLocaleString()}
                    </p>
                    <p className="text-sm text-green-600">
                      +{overview.users.new_users_today} today
                    </p>
                  </div>
                </div>
              </div>

              {/* Streams Stats */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Activity className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Live Streams</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {overview.streams.live_streams}
                    </p>
                    <p className="text-sm text-gray-600">
                      {overview.streams.total_streams} total
                    </p>
                  </div>
                </div>
              </div>

              {/* KYC Stats */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <FileText className="h-8 w-8 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">KYC Pending</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {overview.kyc.pending_verifications}
                    </p>
                    <p className="text-sm text-gray-600">
                      {overview.kyc.approved_verifications} approved
                    </p>
                  </div>
                </div>
              </div>

              {/* Moderation Stats */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Shield className="h-8 w-8 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Reports Pending</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {overview.moderation.pending_reports}
                    </p>
                    <p className="text-sm text-gray-600">
                      {overview.moderation.escalated_reports} escalated
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Overview */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Financial Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Tokens in Circulation</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {overview.financial.total_tokens_in_circulation.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Tips</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {overview.financial.total_tokens_tipped.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Average Tip</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {Math.round(overview.financial.avg_tip_amount)} tokens
                  </p>
                </div>
              </div>
            </div>

            {/* User Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">User Breakdown</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Performers</span>
                    <span className="font-semibold">{overview.users.total_performers}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Viewers</span>
                    <span className="font-semibold">{overview.users.total_viewers}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">KYC Verified</span>
                    <span className="font-semibold text-green-600">{overview.users.kyc_verified_users}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Suspended</span>
                    <span className="font-semibold text-yellow-600">{overview.users.suspended_users}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Banned</span>
                    <span className="font-semibold text-red-600">{overview.users.banned_users}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Stream Statistics</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Streams</span>
                    <span className="font-semibold">{overview.streams.total_streams}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Live Streams</span>
                    <span className="font-semibold text-green-600">{overview.streams.live_streams}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Average Viewers</span>
                    <span className="font-semibold">{Math.round(overview.streams.avg_viewer_count)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Peak Viewers</span>
                    <span className="font-semibold">{overview.streams.max_viewer_count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Streams Today</span>
                    <span className="font-semibold">{overview.streams.streams_today}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">User Management</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-500">User management interface coming soon...</p>
            </div>
          </div>
        )}

        {activeTab === 'kyc' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">KYC Management</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-500">KYC management interface coming soon...</p>
            </div>
          </div>
        )}

        {activeTab === 'moderation' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Content Moderation</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-500">Moderation interface coming soon...</p>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">System Settings</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-500">System settings interface coming soon...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
