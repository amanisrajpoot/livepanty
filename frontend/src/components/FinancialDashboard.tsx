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
  DollarSign,
  TrendingUp,
  CreditCard,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Calendar
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

interface FinancialDashboardProps {
  token: string | null;
}

const FinancialDashboard: React.FC<FinancialDashboardProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [financialData, setFinancialData] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (token) {
      fetchFinancialData();
      fetchTransactions();
    }
  }, [token, period]);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/admin/overview`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFinancialData(data.overview?.financial);
      }
    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/analytics?period=${period}&type=revenue`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTransactions(data.analytics?.data || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading && !financialData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const transactionTypes = [
    { name: 'Purchases', value: financialData?.total_purchases || 0, color: '#8B5CF6' },
    { name: 'Tips', value: financialData?.total_tips || 0, color: '#EC4899' },
    { name: 'Payouts', value: 0, color: '#F59E0B' }
  ];

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Financial Reporting</h2>
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-500" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as '7d' | '30d' | '90d')}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Financial Summary Cards */}
      {financialData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Tokens in Circulation</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(financialData.total_tokens_in_circulation || 0)}
                </p>
                <p className="text-xs text-gray-600 mt-1">All time</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Wallet className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tokens Purchased</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(financialData.total_tokens_purchased || 0)}
                </p>
                <p className="text-xs text-green-600 mt-1 flex items-center">
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  Revenue
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tokens Tipped</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(financialData.total_tokens_tipped || 0)}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {financialData.total_tips || 0} transactions
                </p>
              </div>
              <div className="p-3 bg-pink-100 rounded-lg">
                <CreditCard className="h-6 w-6 text-pink-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Average Tip</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {Math.round(financialData.avg_tip_amount || 0)}
                </p>
                <p className="text-xs text-gray-600 mt-1">tokens per tip</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Chart */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trends</h3>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={transactions.map(item => ({
              date: formatDate(item.period),
              revenue: item.revenue || 0,
              transactions: item.transaction_count || 0,
              fullDate: item.period
            }))}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip formatter={(value: number) => `${formatCurrency(value)} tokens`} />
              <Legend />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10B981"
                fillOpacity={1}
                fill="url(#colorRevenue)"
                name="Revenue"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Transaction Types Pie Chart */}
      {financialData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaction Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={transactionTypes}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(props: any) => {
                    const name = props.name || '';
                    const percent = props.percent || 0;
                    return `${name}: ${(percent * 100).toFixed(0)}%`;
                  }}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {transactionTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaction Summary</h3>
            <div className="space-y-4 mt-6">
              {transactionTypes.map((type, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: type.color }}
                    />
                    <span className="text-sm font-medium text-gray-700">{type.name}</span>
                  </div>
                  <span className="text-lg font-semibold text-gray-900">
                    {formatCurrency(type.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialDashboard;

