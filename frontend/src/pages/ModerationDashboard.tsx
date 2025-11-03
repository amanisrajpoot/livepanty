import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  Flag,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  Eye,
  X as XIcon,
  AlertCircle,
  User,
  Shield,
  FileText,
  Zap,
  TrendingUp
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

interface ContentReport {
  id: string;
  reporter_id: string;
  reporter_name: string;
  reporter_email: string;
  reported_user_id: string;
  reported_user_name: string;
  reported_user_email: string;
  content_type: 'message' | 'stream' | 'profile' | 'comment' | 'tip';
  content_id: string | null;
  reason: string;
  description: string | null;
  evidence: any;
  status: 'pending' | 'flagged' | 'escalated' | 'approved' | 'rejected' | 'resolved';
  automated_analysis: any;
  risk_score: number;
  moderator_id: string | null;
  action_taken: string | null;
  moderator_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface ModerationDashboardProps {
  token: string | null;
}

const ModerationDashboard: React.FC<ModerationDashboardProps> = ({ token }) => {
  const { user } = useAuthStore();
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ContentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState('');
  const [action, setAction] = useState<string>('');
  const socketRef = useRef<any>(null);

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  // Set up real-time socket listener for report updates
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

    // Listen for new reports (can be added later)
    const handleReportUpdate = () => {
      fetchReports();
    };

    // Cleanup
    return () => {
      if (socket) {
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [token, user?.role]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      let url = `${API_BASE_URL}/api/moderation/admin/reports?limit=50&offset=0`;
      if (statusFilter !== 'all') {
        url += `&status=${statusFilter}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setReports(data.reports || []);
      } else {
        setError('Failed to fetch reports');
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      setError('Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = (report: ContentReport) => {
    setSelectedReport(report);
    setNotes(report.moderator_notes || '');
    setAction(report.action_taken || '');
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedReport) return;

    try {
      setProcessing(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/moderation/admin/reports/${selectedReport.id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status,
          action: action || null,
          notes: notes.trim() || null
        })
      });

      if (response.ok) {
        await fetchReports();
        setSelectedReport(null);
        setNotes('');
        setAction('');
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

  const handleEscalate = async () => {
    if (!selectedReport) return;

    try {
      setProcessing(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/moderation/admin/reports/${selectedReport.id}/escalate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: notes.trim() || 'Escalated by moderator'
        })
      });

      if (response.ok) {
        await fetchReports();
        setSelectedReport(null);
        setNotes('');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to escalate report');
      }
    } catch (error) {
      console.error('Error escalating report:', error);
      setError('Failed to escalate report');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'escalated':
        return 'bg-orange-100 text-orange-800';
      case 'flagged':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getReasonLabel = (reason: string) => {
    return reason.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = searchTerm === '' || 
      report.reported_user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.reporter_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.reason.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Content Moderation</h3>
            <p className="text-sm text-gray-500 mt-1">
              {reports.length} {statusFilter === 'pending' ? 'pending' : 'total'} report(s)
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="pending">Pending</option>
              <option value="flagged">Flagged</option>
              <option value="escalated">Escalated</option>
              <option value="all">All</option>
            </select>
            <button
              onClick={fetchReports}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reports List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h4 className="font-medium text-gray-900">Reports</h4>
            </div>
            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  No reports found
                </div>
              ) : (
                filteredReports.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => handleViewReport(report)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedReport?.id === report.id ? 'bg-purple-50 border-l-4 border-purple-500' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{report.reported_user_name}</p>
                        <p className="text-sm text-gray-500">{getReasonLabel(report.reason)}</p>
                      </div>
                      <div className="flex flex-col items-end space-y-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                          {report.status}
                        </span>
                        {report.risk_score > 0.7 && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            High Risk
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      <p>Reporter: {report.reporter_name}</p>
                      <p>Created: {formatDate(report.created_at)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Report Details Panel */}
        <div className="lg:col-span-2">
          {selectedReport ? (
            <div className="space-y-6">
              {/* Report Information */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Report Details</h4>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedReport(null);
                      setNotes('');
                      setAction('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Reported User</p>
                    <p className="font-medium text-gray-900">{selectedReport.reported_user_name}</p>
                    <p className="text-xs text-gray-500">{selectedReport.reported_user_email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Reporter</p>
                    <p className="font-medium text-gray-900">{selectedReport.reporter_name}</p>
                    <p className="text-xs text-gray-500">{selectedReport.reporter_email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Content Type</p>
                    <p className="font-medium text-gray-900">{selectedReport.content_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Reason</p>
                    <p className="font-medium text-gray-900">{getReasonLabel(selectedReport.reason)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedReport.status)}`}>
                      {selectedReport.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Risk Score</p>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            selectedReport.risk_score > 0.7 ? 'bg-red-500' :
                            selectedReport.risk_score > 0.4 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${selectedReport.risk_score * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-medium">
                        {(selectedReport.risk_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Created At</p>
                    <p className="text-sm text-gray-900">{formatDate(selectedReport.created_at)}</p>
                  </div>
                  {selectedReport.reviewed_at && (
                    <div>
                      <p className="text-sm text-gray-500">Reviewed At</p>
                      <p className="text-sm text-gray-900">{formatDate(selectedReport.reviewed_at)}</p>
                    </div>
                  )}
                </div>

                {selectedReport.description && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Description</p>
                    <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                      {selectedReport.description}
                    </p>
                  </div>
                )}

                {selectedReport.automated_analysis && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Automated Analysis</p>
                    <div className="bg-blue-50 p-3 rounded-md">
                      <pre className="text-xs text-gray-700">
                        {JSON.stringify(selectedReport.automated_analysis, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {selectedReport.evidence && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Evidence</p>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p className="text-xs text-gray-700">
                        {selectedReport.evidence.count || 0} file(s) attached
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Moderator Actions */}
              <div className="bg-white rounded-lg shadow p-6">
                <h4 className="font-medium text-gray-900 mb-4">Moderator Actions</h4>
                
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Action to Take
                    </label>
                    <select
                      value={action}
                      onChange={(e) => setAction(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select action</option>
                      <option value="warn_user">Warn User</option>
                      <option value="suspend_user">Suspend User</option>
                      <option value="ban_user">Ban User</option>
                      <option value="delete_content">Delete Content</option>
                      <option value="hide_content">Hide Content</option>
                      <option value="no_action">No Action</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Add notes about your decision..."
                    />
                  </div>

                  <div className="flex space-x-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleUpdateStatus('approved')}
                      disabled={processing || !action}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      <CheckCircle className="h-5 w-5" />
                      <span>Approve & Take Action</span>
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('rejected')}
                      disabled={processing}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      <XCircle className="h-5 w-5" />
                      <span>Reject Report</span>
                    </button>
                    <button
                      onClick={handleEscalate}
                      disabled={processing}
                      className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      <AlertTriangle className="h-5 w-5" />
                      <span>Escalate</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Flag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Select a report to review</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModerationDashboard;

