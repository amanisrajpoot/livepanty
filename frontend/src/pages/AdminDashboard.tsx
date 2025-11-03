import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import FinancialDashboard from '../components/FinancialDashboard';
import SystemMonitoringDashboard from '../components/SystemMonitoringDashboard';
import UserManagement from '../components/UserManagement';
import ModerationDashboard from '../pages/ModerationDashboard';
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
  Clock,
  Download,
  ZoomIn,
  ZoomOut,
  X as XIcon,
  Search,
  Filter
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

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
      const response = await fetch(`${API_BASE_URL}/api/admin/overview`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOverview(data.overview);
      } else {
        console.error('Failed to fetch overview:', response.status);
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
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'financial', label: 'Financial', icon: TrendingUp },
    { id: 'monitoring', label: 'Monitoring', icon: Activity },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'kyc', label: 'KYC', icon: FileText },
    { id: 'moderation', label: 'Moderation', icon: Shield },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <div className="h-full bg-gray-50">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Manage your platform</p>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
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
      <div>
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

        {activeTab === 'analytics' && <AnalyticsDashboard token={token} />}

        {activeTab === 'financial' && <FinancialDashboard token={token} />}

        {activeTab === 'monitoring' && <SystemMonitoringDashboard token={token} />}

        {activeTab === 'users' && <UserManagement token={token} />}

        {activeTab === 'kyc' && <KYCReviewInterface token={token} />}

        {activeTab === 'moderation' && <ModerationDashboard token={token} />}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">System Settings</h3>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Platform Configuration</h4>
                  <p className="text-sm text-gray-600 mb-4">Configure platform-wide settings and preferences</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Maintenance Mode</span>
                      <button className="px-4 py-2 bg-gray-200 rounded-md text-sm hover:bg-gray-300">Disabled</button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Auto-approve KYC</span>
                      <button className="px-4 py-2 bg-gray-200 rounded-md text-sm hover:bg-gray-300">Disabled</button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Enable Registration</span>
                      <button className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700">Enabled</button>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Content Moderation</h4>
                  <p className="text-sm text-gray-600 mb-4">Configure automated content filtering and moderation rules</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Auto-filter Profanity</span>
                      <button className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700">Enabled</button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Auto-flag Spam</span>
                      <button className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700">Enabled</button>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Payment Settings</h4>
                  <p className="text-sm text-gray-600 mb-4">Manage payment gateway and token settings</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Payment Gateway</span>
                      <span className="text-sm font-medium text-gray-900">Razorpay</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Token Price (per 100)</span>
                      <span className="text-sm font-medium text-gray-900">₹10.00</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// KYC Review Interface Component
interface KYCVerification {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  username: string;
  document_type: string;
  document_number: string;
  issuing_country: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  notes: string | null;
  s3_key: string;
  user_created_at: string;
}

const KYCReviewInterface: React.FC<{ token: string | null }> = ({ token }) => {
  const { user } = useAuthStore();
  const [verifications, setVerifications] = useState<KYCVerification[]>([]);
  const [selectedVerification, setSelectedVerification] = useState<KYCVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [notes, setNotes] = useState('');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [documentImage, setDocumentImage] = useState<string | null>(null);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    fetchVerifications();
  }, [statusFilter]);

  // Set up real-time socket listener for admin updates
  useEffect(() => {
    if (!token || !user || user.role !== 'admin') {
      return;
    }

    const { io } = require('socket.io-client');
    const socket = io(API_BASE_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socketRef.current = socket;

    // Listen for KYC verification updates
    const handleVerificationUpdate = (update: any) => {
      console.log('KYC verification updated (admin):', update);
      
      // Refresh verifications list if viewing relevant status
      if (statusFilter === 'all' || statusFilter === update.status || update.status === 'pending' || update.status === 'requires_review') {
        fetchVerifications();
      }

      // If the updated verification is currently selected, update it
      if (selectedVerification && selectedVerification.id === update.verificationId) {
        fetchVerifications();
      }
    };

    socket.on('kyc_verification_updated', handleVerificationUpdate);

    return () => {
      socket.off('kyc_verification_updated', handleVerificationUpdate);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user?.role, statusFilter]);

  const fetchVerifications = async () => {
    try {
      setLoading(true);
      const url = statusFilter === 'all' 
        ? `${API_BASE_URL}/api/admin/kyc/all`
        : `${API_BASE_URL}/api/admin/kyc/pending?limit=50&offset=0`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setVerifications(data.verifications || []);
      } else {
        setError('Failed to fetch verifications');
      }
    } catch (error) {
      console.error('Error fetching verifications:', error);
      setError('Failed to fetch verifications');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocument = async (verificationId: string) => {
    try {
      setLoadingDocument(true);
      const response = await fetch(`${API_BASE_URL}/api/kyc/admin/verification/${verificationId}/document`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        setDocumentImage(imageUrl);
      } else {
        setError('Failed to load document');
      }
    } catch (error) {
      console.error('Error fetching document:', error);
      setError('Failed to load document');
    } finally {
      setLoadingDocument(false);
    }
  };

  const handleViewVerification = async (verification: KYCVerification) => {
    setSelectedVerification(verification);
    setNotes(verification.notes || '');
    setZoomLevel(100);
    setDocumentImage(null);
    await fetchDocument(verification.id);
  };

  const handleUpdateStatus = async (status: 'approved' | 'rejected' | 'requires_review') => {
    if (!selectedVerification) return;

    try {
      setProcessing(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/kyc/admin/verification/${selectedVerification.id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status,
          notes: notes.trim() || null
        })
      });

      if (response.ok) {
        // Refresh verifications list
        await fetchVerifications();
        setSelectedVerification(null);
        setNotes('');
        setDocumentImage(null);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      setError('Failed to update status');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadDocument = async () => {
    if (!selectedVerification) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/kyc/admin/verification/${selectedVerification.id}/document`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kyc-document-${selectedVerification.id}.${blob.type.includes('pdf') ? 'pdf' : 'jpg'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      setError('Failed to download document');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
      case 'requires_review':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">KYC Verification Review</h3>
            <p className="text-sm text-gray-500 mt-1">
              {verifications.length} {statusFilter === 'pending' ? 'pending' : 'total'} verification(s)
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="pending">Pending</option>
              <option value="requires_review">Requires Review</option>
              <option value="all">All</option>
            </select>
            <button
              onClick={fetchVerifications}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Verifications List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h4 className="font-medium text-gray-900">Verifications</h4>
            </div>
            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                </div>
              ) : verifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  No verifications found
                </div>
              ) : (
                verifications.map((verification) => (
                  <button
                    key={verification.id}
                    onClick={() => handleViewVerification(verification)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedVerification?.id === verification.id ? 'bg-purple-50 border-l-4 border-purple-500' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{verification.display_name}</p>
                        <p className="text-sm text-gray-500">{verification.email}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(verification.status)}`}>
                        {verification.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      <p>{verification.document_type.replace('_', ' ')} • {verification.issuing_country}</p>
                      <p>Submitted: {formatDate(verification.submitted_at)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Document Viewer and Review Panel */}
        <div className="lg:col-span-2">
          {selectedVerification ? (
            <div className="space-y-6">
              {/* User Information */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-medium text-gray-900">User Information</h4>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedVerification(null);
                      setDocumentImage(null);
                      setNotes('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Display Name</p>
                    <p className="font-medium text-gray-900">{selectedVerification.display_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Username</p>
                    <p className="font-medium text-gray-900">{selectedVerification.username || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium text-gray-900">{selectedVerification.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">User Since</p>
                    <p className="font-medium text-gray-900">{formatDate(selectedVerification.user_created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Document Type</p>
                    <p className="font-medium text-gray-900">{selectedVerification.document_type.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Document Number</p>
                    <p className="font-medium text-gray-900">{selectedVerification.document_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Issuing Country</p>
                    <p className="font-medium text-gray-900">{selectedVerification.issuing_country}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Submitted At</p>
                    <p className="font-medium text-gray-900">{formatDate(selectedVerification.submitted_at)}</p>
                  </div>
                </div>
              </div>

              {/* Document Viewer */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium text-gray-900">Document</h4>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setZoomLevel(Math.max(50, zoomLevel - 25))}
                      className="p-2 hover:bg-gray-100 rounded"
                    >
                      <ZoomOut className="h-5 w-5" />
                    </button>
                    <span className="text-sm text-gray-600 w-12 text-center">{zoomLevel}%</span>
                    <button
                      onClick={() => setZoomLevel(Math.min(200, zoomLevel + 25))}
                      className="p-2 hover:bg-gray-100 rounded"
                    >
                      <ZoomIn className="h-5 w-5" />
                    </button>
                    <button
                      onClick={handleDownloadDocument}
                      className="p-2 hover:bg-gray-100 rounded"
                    >
                      <Download className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 overflow-auto max-h-[500px]">
                  {loadingDocument ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                    </div>
                  ) : documentImage ? (
                    <div className="flex justify-center">
                      <img
                        src={documentImage}
                        alt="KYC Document"
                        style={{ width: `${zoomLevel}%`, height: 'auto' }}
                        className="shadow-lg rounded"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      No document available
                    </div>
                  )}
                </div>
              </div>

              {/* Review Actions */}
              <div className="bg-white rounded-lg shadow p-6">
                <h4 className="font-medium text-gray-900 mb-4">Review & Action</h4>
                
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                    {error}
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Add notes about this verification..."
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => handleUpdateStatus('approved')}
                    disabled={processing}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    <CheckCircle className="h-5 w-5" />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('rejected')}
                    disabled={processing}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    <XCircle className="h-5 w-5" />
                    <span>Reject</span>
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('requires_review')}
                    disabled={processing}
                    className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    <Clock className="h-5 w-5" />
                    <span>Requires Review</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Select a verification to review</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
