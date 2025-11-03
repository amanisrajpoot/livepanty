import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  TrendingUp,
  Users,
  Video,
  DollarSign,
  Activity,
  Calendar
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

interface AnalyticsData {
  period: string;
  data: Array<{
    period: string;
    user_count?: number;
    stream_count?: number;
    revenue?: number;
    tip_count?: number;
  }>;
  generatedAt: string;
}

interface AnalyticsDashboardProps {
  token: string | null;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'1d' | '7d' | '30d'>('7d');
  const [userAnalytics, setUserAnalytics] = useState<AnalyticsData | null>(null);
  const [streamAnalytics, setStreamAnalytics] = useState<AnalyticsData | null>(null);
  const [revenueAnalytics, setRevenueAnalytics] = useState<AnalyticsData | null>(null);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    if (token) {
      fetchAnalytics();
      fetchSummary();
    }
  }, [token, period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [userData, streamData, revenueData] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/analytics?period=${period}&type=users`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${API_BASE_URL}/api/admin/analytics?period=${period}&type=streams`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${API_BASE_URL}/api/admin/analytics?period=${period}&type=revenue`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      if (userData.ok) {
        const userResult = await userData.json();
        setUserAnalytics(userResult.analytics);
      }

      if (streamData.ok) {
        const streamResult = await streamData.json();
        setStreamAnalytics(streamResult.analytics);
      }

      if (revenueData.ok) {
        const revenueResult = await revenueData.json();
        setRevenueAnalytics(revenueResult.analytics);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/overview`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data.overview);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const formatDate = (dateString: string, period: string) => {
    const date = new Date(dateString);
    if (period === '1d') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Analytics Dashboard</h2>
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-500" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as '1d' | '7d' | '30d')}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="1d">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Users</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {summary.users?.total_users || 0}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  +{summary.users?.new_users_today || 0} today
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Live Streams</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {summary.streams?.live_streams || 0}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {summary.streams?.total_streams || 0} total
                </p>
              </div>
              <div className="p-3 bg-pink-100 rounded-lg">
                <Video className="h-6 w-6 text-pink-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {summary.financial?.total_tokens_purchased?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-gray-600 mt-1">tokens purchased</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Users</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {summary.users?.active_users || 0}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  {summary.users?.kyc_verified_users || 0} verified
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Growth Chart */}
      {userAnalytics && userAnalytics.data.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Growth</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={userAnalytics.data.map(item => ({
              date: formatDate(item.period, period),
              users: item.user_count || 0,
              fullDate: item.period
            }))}>
              <defs>
                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="users"
                stroke="#8B5CF6"
                fillOpacity={1}
                fill="url(#colorUsers)"
                name="New Users"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Streams and Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stream Statistics */}
        {streamAnalytics && streamAnalytics.data.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Stream Activity</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={streamAnalytics.data.map(item => ({
                date: formatDate(item.period, period),
                streams: item.stream_count || 0,
                fullDate: item.period
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip />
                <Legend />
                <Bar dataKey="streams" fill="#EC4899" name="Streams" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Revenue Chart */}
        {revenueAnalytics && revenueAnalytics.data.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trends</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueAnalytics.data.map(item => ({
                date: formatDate(item.period, period),
                revenue: item.revenue || 0,
                fullDate: item.period
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip formatter={(value: number) => `${value.toLocaleString()} tokens`} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10B981"
                  strokeWidth={2}
                  name="Revenue"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* User Distribution */}
      {summary && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Distribution</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {summary.users?.total_performers || 0}
              </div>
              <div className="text-sm text-gray-600 mt-2">Performers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-pink-600">
                {summary.users?.total_viewers || 0}
              </div>
              <div className="text-sm text-gray-600 mt-2">Viewers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {summary.users?.kyc_verified_users || 0}
              </div>
              <div className="text-sm text-gray-600 mt-2">KYC Verified</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;

