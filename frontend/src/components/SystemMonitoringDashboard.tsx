import React, { useState, useEffect } from 'react';
import {
  Activity,
  Database,
  Server,
  HardDrive,
  Cpu,
  MemoryStick,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

interface SystemHealth {
  database: {
    status: string;
    responseTime?: string;
    lastCheck: string;
  };
  redis: {
    status: string;
    lastCheck: string;
  };
  disk: {
    status: string;
    lastCheck: string;
  };
  memory: {
    status: string;
    rss?: string;
    heapTotal?: string;
    heapUsed?: string;
    external?: string;
    lastCheck: string;
  };
  overall: string;
  timestamp: string;
}

interface SystemMonitoringDashboardProps {
  token: string | null;
}

const SystemMonitoringDashboard: React.FC<SystemMonitoringDashboardProps> = ({ token }) => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (token) {
      fetchHealth();
    }
  }, [token]);

  useEffect(() => {
    if (autoRefresh && token) {
      const interval = setInterval(() => {
        fetchHealth();
      }, 10000); // Refresh every 10 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh, token]);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/admin/system/health`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setHealth(data.health);
      }
    } catch (error) {
      console.error('Error fetching system health:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'excellent':
      case 'good':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'unhealthy':
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'excellent':
      case 'good':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'unhealthy':
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getOverallHealthPercentage = (overall: string) => {
    switch (overall.toLowerCase()) {
      case 'excellent':
        return 95;
      case 'good':
        return 85;
      case 'warning':
        return 65;
      case 'critical':
        return 35;
      default:
        return 50;
    }
  };

  if (loading && !health) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600">Unable to fetch system health data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">System Monitoring</h2>
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span>Auto-refresh (10s)</span>
            </label>
            <button
              onClick={fetchHealth}
              className="px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-md transition-colors flex items-center space-x-1"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overall Health Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Overall System Health</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(health.overall)}`}>
            {health.overall.toUpperCase()}
          </span>
        </div>
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className={`h-4 rounded-full transition-all duration-300 ${
                health.overall === 'excellent' || health.overall === 'good'
                  ? 'bg-green-600'
                  : health.overall === 'warning'
                  ? 'bg-yellow-600'
                  : 'bg-red-600'
              }`}
              style={{ width: `${getOverallHealthPercentage(health.overall)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Last updated: {new Date(health.timestamp).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Service Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Database */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-gray-900">Database</span>
            </div>
            {getStatusIcon(health.database.status)}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Status:</span>
              <span className={`font-medium ${getStatusColor(health.database.status).split(' ')[1]}`}>
                {health.database.status}
              </span>
            </div>
            {health.database.responseTime && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Response:</span>
                <span className="text-gray-900">{health.database.responseTime}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-gray-500">
              <span>Last check:</span>
              <span>{new Date(health.database.lastCheck).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        {/* Redis */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Server className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-gray-900">Redis</span>
            </div>
            {getStatusIcon(health.redis.status)}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Status:</span>
              <span className={`font-medium ${getStatusColor(health.redis.status).split(' ')[1]}`}>
                {health.redis.status}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Last check:</span>
              <span>{new Date(health.redis.lastCheck).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        {/* Disk */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <HardDrive className="h-5 w-5 text-green-600" />
              <span className="font-medium text-gray-900">Disk</span>
            </div>
            {getStatusIcon(health.disk.status)}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Status:</span>
              <span className={`font-medium ${getStatusColor(health.disk.status).split(' ')[1]}`}>
                {health.disk.status}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Last check:</span>
              <span>{new Date(health.disk.lastCheck).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        {/* Memory */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <MemoryStick className="h-5 w-5 text-orange-600" />
              <span className="font-medium text-gray-900">Memory</span>
            </div>
            {getStatusIcon(health.memory.status)}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Status:</span>
              <span className={`font-medium ${getStatusColor(health.memory.status).split(' ')[1]}`}>
                {health.memory.status}
              </span>
            </div>
            {health.memory.rss && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">RSS:</span>
                <span className="text-gray-900">{health.memory.rss}</span>
              </div>
            )}
            {health.memory.heapUsed && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Heap Used:</span>
                <span className="text-gray-900">{health.memory.heapUsed}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-gray-500">
              <span>Last check:</span>
              <span>{new Date(health.memory.lastCheck).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Memory Information */}
      {health.memory.heapTotal && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Memory Usage Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">RSS</p>
              <p className="text-sm font-semibold text-gray-900">{health.memory.rss || 'N/A'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Heap Total</p>
              <p className="text-sm font-semibold text-gray-900">{health.memory.heapTotal || 'N/A'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Heap Used</p>
              <p className="text-sm font-semibold text-gray-900">{health.memory.heapUsed || 'N/A'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">External</p>
              <p className="text-sm font-semibold text-gray-900">{health.memory.external || 'N/A'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemMonitoringDashboard;

