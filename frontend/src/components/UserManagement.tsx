import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Filter,
  Eye,
  Edit,
  Ban,
  AlertTriangle,
  CheckCircle,
  XCircle,
  UserX,
  Shield,
  Mail,
  Calendar,
  DollarSign,
  Video,
  FileText,
  RefreshCw,
  Download,
  MoreVertical,
  Trash2,
  UserCheck,
  UserX as UserXIcon
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

interface User {
  id: string;
  email: string;
  display_name: string;
  username: string;
  role: 'performer' | 'viewer' | 'admin';
  status: 'active' | 'suspended' | 'banned';
  kyc_verified: boolean;
  created_at: string;
  last_login_at: string | null;
  token_balance: number;
  report_count: number;
  warning_count: number;
}

interface UserManagementProps {
  token: string | null;
}

const UserManagement: React.FC<UserManagementProps> = ({ token }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [kycFilter, setKycFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [processing, setProcessing] = useState<string | null>(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'suspend' | 'ban' | 'activate' | null>(null);
  const [actionReason, setActionReason] = useState('');

  const limit = 20;

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: ((page - 1) * limit).toString()
      });

      if (searchTerm) params.append('search', searchTerm);
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (kycFilter !== 'all') params.append('kyc_verified', kycFilter === 'verified' ? 'true' : 'false');

      const response = await fetch(`${API_BASE_URL}/api/admin/users?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setTotalUsers(data.total || data.users?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, [token, page, searchTerm, roleFilter, statusFilter, kycFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleUserAction = async (userId: string, action: 'suspend' | 'ban' | 'activate', reason?: string) => {
    if (!token || processing) return;
    try {
      setProcessing(userId);
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: action === 'activate' ? 'active' : action,
          reason: reason || `Admin action: ${action}`
        })
      });

      if (response.ok) {
        await fetchUsers();
        if (selectedUser?.id === userId) {
          const updatedUser = await fetchUserDetails(userId);
          setSelectedUser(updatedUser);
        }
        setActionModalOpen(false);
        setActionType(null);
        setActionReason('');
      }
    } catch (error) {
      console.error('Error updating user status:', error);
    } finally {
      setProcessing(null);
    }
  };

  const fetchUserDetails = async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.user;
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
    return null;
  };

  const handleViewUser = async (user: User) => {
    const details = await fetchUserDetails(user.id);
    if (details) {
      setSelectedUser({ ...user, ...details });
      setShowUserDetails(true);
    } else {
      setSelectedUser(user);
      setShowUserDetails(true);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'banned':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'performer':
        return 'bg-blue-100 text-blue-800';
      case 'viewer':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredUsers = users;

  const totalPages = Math.ceil(totalUsers / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
          <button
            onClick={fetchUsers}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md border border-gray-300 transition-colors flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Roles</option>
            <option value="performer">Performers</option>
            <option value="viewer">Viewers</option>
            <option value="admin">Admins</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>

          <select
            value={kycFilter}
            onChange={(e) => {
              setKycFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All KYC Status</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No users found</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      KYC
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reports
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <Users className="h-5 w-5 text-purple-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.display_name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(user.status)}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.kyc_verified ? (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verified
                          </span>
                        ) : (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            <XCircle className="h-3 w-3 mr-1" />
                            Unverified
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.token_balance?.toLocaleString() || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.report_count || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleViewUser(user)}
                            className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded-md transition-colors"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {user.status === 'active' ? (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setActionType('suspend');
                                  setActionModalOpen(true);
                                }}
                                className="text-yellow-600 hover:text-yellow-900 p-2 hover:bg-yellow-50 rounded-md transition-colors"
                                title="Suspend User"
                                disabled={processing === user.id}
                              >
                                <AlertTriangle className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setActionType('ban');
                                  setActionModalOpen(true);
                                }}
                                className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-md transition-colors"
                                title="Ban User"
                                disabled={processing === user.id}
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleUserAction(user.id, 'activate')}
                              className="text-green-600 hover:text-green-900 p-2 hover:bg-green-50 rounded-md transition-colors"
                              title="Activate User"
                              disabled={processing === user.id}
                            >
                              <UserCheck className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{' '}
                      <span className="font-medium">{Math.min(page * limit, totalUsers)}</span> of{' '}
                      <span className="font-medium">{totalUsers}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (page <= 3) {
                          pageNum = i + 1;
                        } else if (page >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = page - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPage(pageNum)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              page === pageNum
                                ? 'z-10 bg-purple-50 border-purple-500 text-purple-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Details Modal */}
          {showUserDetails && selectedUser && (
            <UserDetailsModal
              user={selectedUser}
              onClose={() => {
                setShowUserDetails(false);
                setSelectedUser(null);
              }}
              onAction={handleUserAction}
              token={token}
              processing={processing}
            />
          )}

          {/* Action Modal */}
          {actionModalOpen && selectedUser && actionType && (
            <ActionModal
              user={selectedUser}
              actionType={actionType}
              reason={actionReason}
              onReasonChange={setActionReason}
              onConfirm={() => handleUserAction(selectedUser.id, actionType, actionReason)}
              onCancel={() => {
                setActionModalOpen(false);
                setActionType(null);
                setActionReason('');
              }}
              processing={processing === selectedUser.id}
            />
          )}
        </>
      )}
    </div>
  );
};

// User Details Modal Component
interface UserDetailsModalProps {
  user: User & { [key: string]: any };
  onClose: () => void;
  onAction: (userId: string, action: 'suspend' | 'ban' | 'activate', reason?: string) => void;
  token: string | null;
  processing: string | null;
}

const UserDetailsModal: React.FC<UserDetailsModalProps> = ({ user, onClose, onAction, token, processing }) => {
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'suspend' | 'ban' | 'activate' | null>(null);
  const [actionReason, setActionReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" />

        <div
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">User Details</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Display Name</label>
                  <p className="mt-1 text-sm text-gray-900">{user.display_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="mt-1 text-sm text-gray-900">{user.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Username</label>
                  <p className="mt-1 text-sm text-gray-900">{user.username}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Role</label>
                  <p className="mt-1 text-sm text-gray-900 capitalize">{user.role}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <p className="mt-1 text-sm text-gray-900 capitalize">{user.status}</p>
                </div>
              </div>

              {/* Statistics */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Token Balance</label>
                  <p className="mt-1 text-sm text-gray-900">{user.token_balance?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Reports Received</label>
                  <p className="mt-1 text-sm text-gray-900">{user.report_count || 0}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Warnings</label>
                  <p className="mt-1 text-sm text-gray-900">{user.warning_count || 0}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">KYC Verified</label>
                  <p className="mt-1 text-sm text-gray-900">{user.kyc_verified ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Created At</label>
                  <p className="mt-1 text-sm text-gray-900">{new Date(user.created_at).toLocaleString()}</p>
                </div>
                {user.last_login_at && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Last Login</label>
                    <p className="mt-1 text-sm text-gray-900">{new Date(user.last_login_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end space-x-3">
              {user.status === 'active' ? (
                <>
                  <button
                    onClick={() => {
                      setActionType('suspend');
                      setActionModalOpen(true);
                    }}
                    className="px-4 py-2 text-sm text-yellow-700 bg-yellow-100 rounded-md hover:bg-yellow-200 transition-colors flex items-center space-x-2"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <span>Suspend</span>
                  </button>
                  <button
                    onClick={() => {
                      setActionType('ban');
                      setActionModalOpen(true);
                    }}
                    className="px-4 py-2 text-sm text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors flex items-center space-x-2"
                  >
                    <Ban className="h-4 w-4" />
                    <span>Ban</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onAction(user.id, 'activate')}
                  className="px-4 py-2 text-sm text-green-700 bg-green-100 rounded-md hover:bg-green-200 transition-colors flex items-center space-x-2"
                  disabled={processing === user.id}
                >
                  <UserCheck className="h-4 w-4" />
                  <span>Activate</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>

          {/* Action Modal */}
          {actionModalOpen && actionType && (
            <ActionModal
              user={user}
              actionType={actionType}
              reason={actionReason}
              onReasonChange={setActionReason}
              onConfirm={() => {
                onAction(user.id, actionType, actionReason);
                setActionModalOpen(false);
                setActionType(null);
                setActionReason('');
              }}
              onCancel={() => {
                setActionModalOpen(false);
                setActionType(null);
                setActionReason('');
              }}
              processing={processing === user.id}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Action Modal Component
interface ActionModalProps {
  user: User;
  actionType: 'suspend' | 'ban' | 'activate';
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  processing: boolean;
}

const ActionModal: React.FC<ActionModalProps> = ({
  user,
  actionType,
  reason,
  onReasonChange,
  onConfirm,
  onCancel,
  processing
}) => {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" />

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10 ${
                actionType === 'ban' ? 'bg-red-100' : actionType === 'suspend' ? 'bg-yellow-100' : 'bg-green-100'
              }`}>
                {actionType === 'ban' ? (
                  <Ban className="h-6 w-6 text-red-600" />
                ) : actionType === 'suspend' ? (
                  <AlertTriangle className="h-6 w-6 text-yellow-600" />
                ) : (
                  <UserCheck className="h-6 w-6 text-green-600" />
                )}
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {actionType === 'ban' ? 'Ban User' : actionType === 'suspend' ? 'Suspend User' : 'Activate User'}
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Are you sure you want to {actionType} <strong>{user.display_name}</strong>?
                  </p>
                </div>
                {(actionType === 'ban' || actionType === 'suspend') && (
                  <div className="mt-4">
                    <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
                      Reason (optional)
                    </label>
                    <textarea
                      id="reason"
                      rows={3}
                      value={reason}
                      onChange={(e) => onReasonChange(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                      placeholder="Enter reason for this action..."
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              onClick={onConfirm}
              disabled={processing}
              className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:ml-3 sm:w-auto sm:text-sm ${
                actionType === 'ban' ? 'bg-red-600 hover:bg-red-700' : actionType === 'suspend' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'
              } disabled:opacity-50`}
            >
              {processing ? 'Processing...' : 'Confirm'}
            </button>
            <button
              onClick={onCancel}
              disabled={processing}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;

