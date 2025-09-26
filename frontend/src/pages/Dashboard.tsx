import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStreamStore } from '../store/streamStore';
import { useAuthStore } from '../store/authStore';
import { 
  Video, 
  Users, 
  Eye, 
  Heart, 
  Plus, 
  Search,
  Filter,
  Play,
  Clock,
  TrendingUp,
  Star
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const { streams, fetchStreams, isLoading, error } = useStreamStore();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchStreams();
  }, [fetchStreams]);

  const categories = [
    'all',
    'music',
    'dance',
    'talk',
    'gaming',
    'art',
    'fitness',
    'cooking',
    'other'
  ];

  const filteredStreams = streams.filter(stream => {
    const matchesSearch = stream.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         stream.host_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || stream.category === selectedCategory;
    return matchesSearch && matchesCategory && stream.status === 'live';
  });

  const formatViewerCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Live Streams
            </h1>
            <p className="text-gray-600 mt-1">
              Discover and watch live streams from performers around the world
            </p>
          </div>
          
          {user?.role === 'performer' && (
            <Link
              to="/create-stream"
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Start Streaming</span>
            </Link>
          )}
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search streams or performers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-5 w-5 text-gray-400" />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input-field pl-10 pr-8"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <Video className="w-6 h-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">
                {streams.filter(s => s.status === 'live').length}
              </p>
              <p className="text-gray-600">Live Streams</p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-secondary-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-secondary-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">
                {streams.reduce((total, stream) => total + stream.viewer_count, 0)}
              </p>
              <p className="text-gray-600">Total Viewers</p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Heart className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">
                {formatTokens(streams.reduce((total, stream) => total + stream.total_tokens_received, 0))}
              </p>
              <p className="text-gray-600">Tokens Tipped</p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">
                {streams.filter(s => s.status === 'live').length > 0 ? 'Hot' : 'Cool'}
              </p>
              <p className="text-gray-600">Platform Status</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="spinner"></div>
          <span className="ml-2 text-gray-600">Loading streams...</span>
        </div>
      ) : (
        <>
          {/* Featured Streams */}
          {filteredStreams.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <Star className="w-6 h-6 text-yellow-500 mr-2" />
                Featured Streams
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredStreams.slice(0, 2).map((stream) => (
                  <Link
                    key={stream.id}
                    to={`/stream/${stream.id}`}
                    className="stream-card group"
                  >
                    <div className="relative">
                      <div className="aspect-video bg-gray-200 rounded-t-lg flex items-center justify-center">
                        <Play className="w-12 h-12 text-white opacity-80" />
                      </div>
                      <div className="absolute top-4 left-4 bg-red-500 text-white px-2 py-1 rounded text-sm font-medium">
                        LIVE
                      </div>
                      <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm flex items-center">
                        <Eye className="w-4 h-4 mr-1" />
                        {formatViewerCount(stream.viewer_count)}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                        {stream.title}
                      </h3>
                      <p className="text-gray-600 text-sm mt-1">
                        by {stream.host_name}
                      </p>
                      {stream.description && (
                        <p className="text-gray-500 text-sm mt-2 line-clamp-2">
                          {stream.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Heart className="w-4 h-4 mr-1" />
                            {formatTokens(stream.total_tokens_received)}
                          </span>
                          {stream.category && (
                            <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                              {stream.category}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <Clock className="w-4 h-4 mr-1" />
                          {new Date(stream.started_at || stream.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* All Streams */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              All Live Streams
            </h2>
            
            {filteredStreams.length === 0 ? (
              <div className="text-center py-12">
                <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No live streams found
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm || selectedCategory !== 'all'
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Be the first to start streaming!'}
                </p>
                {user?.role === 'performer' && (
                  <Link to="/create-stream" className="btn-primary">
                    Start Your First Stream
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredStreams.map((stream) => (
                  <Link
                    key={stream.id}
                    to={`/stream/${stream.id}`}
                    className="stream-card group"
                  >
                    <div className="relative">
                      <div className="aspect-video bg-gray-200 rounded-t-lg flex items-center justify-center">
                        <Play className="w-8 h-8 text-white opacity-80" />
                      </div>
                      <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
                        LIVE
                      </div>
                      <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs flex items-center">
                        <Eye className="w-3 h-3 mr-1" />
                        {formatViewerCount(stream.viewer_count)}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-medium text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-1">
                        {stream.title}
                      </h3>
                      <p className="text-gray-600 text-sm mt-1">
                        by {stream.host_name}
                      </p>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Heart className="w-3 h-3 mr-1" />
                            {formatTokens(stream.total_tokens_received)}
                          </span>
                        </div>
                        {stream.category && (
                          <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                            {stream.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
