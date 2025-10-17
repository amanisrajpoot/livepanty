import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, Users, Lock, Video, Star } from 'lucide-react';

interface Stream {
  id: string;
  title: string;
  performer: {
    name: string;
    avatar: string;
    isOnline: boolean;
    rating: number;
  };
  thumbnail: string;
  viewers: number;
  isLive: boolean;
  category: string;
  tags: string[];
  isPrivate: boolean;
}

const GuestStreams: React.FC = () => {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Dummy data for demo
  useEffect(() => {
    const dummyStreams: Stream[] = [
      {
        id: '1',
        title: 'Welcome to my room! 💕',
        performer: {
          name: 'Emma_Rose',
          avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
          isOnline: true,
          rating: 4.9
        },
        thumbnail: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=300&fit=crop',
        viewers: 1247,
        isLive: true,
        category: 'cam',
        tags: ['new', 'friendly', 'chat'],
        isPrivate: false
      },
      {
        id: '2',
        title: 'Dancing & Music 🎵',
        performer: {
          name: 'Luna_Moon',
          avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
          isOnline: true,
          rating: 4.8
        },
        thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop',
        viewers: 892,
        isLive: true,
        category: 'dance',
        tags: ['dance', 'music', 'fun'],
        isPrivate: false
      },
      {
        id: '3',
        title: 'Private Session 🔒',
        performer: {
          name: 'Sophia_Secret',
          avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
          isOnline: true,
          rating: 4.9
        },
        thumbnail: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=300&fit=crop',
        viewers: 156,
        isLive: true,
        category: 'private',
        tags: ['private', 'exclusive'],
        isPrivate: true
      },
      {
        id: '4',
        title: 'Gaming & Chat 🎮',
        performer: {
          name: 'Gamer_Girl_99',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
          isOnline: true,
          rating: 4.7
        },
        thumbnail: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=300&fit=crop',
        viewers: 634,
        isLive: true,
        category: 'gaming',
        tags: ['gaming', 'chat', 'fun'],
        isPrivate: false
      },
      {
        id: '5',
        title: 'Fitness & Wellness 💪',
        performer: {
          name: 'Fit_Angel',
          avatar: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=150&h=150&fit=crop&crop=face',
          isOnline: true,
          rating: 4.8
        },
        thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop',
        viewers: 423,
        isLive: true,
        category: 'fitness',
        tags: ['fitness', 'wellness', 'motivation'],
        isPrivate: false
      },
      {
        id: '6',
        title: 'Art & Creativity 🎨',
        performer: {
          name: 'Creative_Soul',
          avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face',
          isOnline: true,
          rating: 4.9
        },
        thumbnail: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop',
        viewers: 287,
        isLive: true,
        category: 'art',
        tags: ['art', 'creative', 'drawing'],
        isPrivate: false
      }
    ];

    setTimeout(() => {
      setStreams(dummyStreams);
      setIsLoading(false);
    }, 1000);
  }, []);

  const categories = [
    { id: 'all', name: 'All Streams', count: streams.length },
    { id: 'cam', name: 'Cam Shows', count: streams.filter(s => s.category === 'cam').length },
    { id: 'dance', name: 'Dance', count: streams.filter(s => s.category === 'dance').length },
    { id: 'gaming', name: 'Gaming', count: streams.filter(s => s.category === 'gaming').length },
    { id: 'fitness', name: 'Fitness', count: streams.filter(s => s.category === 'fitness').length },
    { id: 'art', name: 'Art', count: streams.filter(s => s.category === 'art').length },
    { id: 'private', name: 'Private', count: streams.filter(s => s.category === 'private').length },
  ];

  const filteredStreams = selectedCategory === 'all' 
    ? streams 
    : streams.filter(stream => stream.category === selectedCategory);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">LivePanty</span>
            </Link>
            
            <div className="flex items-center space-x-4">
              <Link
                to="/quick-register"
                className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                Join Free
              </Link>
              <Link
                to="/login"
                className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Watch Live Streams
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Discover amazing performers and join the community
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              to="/quick-register"
              className="bg-primary-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Join Free to Watch
            </Link>
            <Link
              to="/performer-register"
              className="bg-gray-200 text-gray-900 px-8 py-3 rounded-lg text-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Start Streaming
            </Link>
          </div>
        </div>

        {/* Categories */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                {category.name} ({category.count})
              </button>
            ))}
          </div>
        </div>

        {/* Streams Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
                <div className="aspect-video bg-gray-300"></div>
                <div className="p-4">
                  <div className="h-4 bg-gray-300 rounded mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredStreams.map((stream) => (
              <Link 
                key={stream.id} 
                to={stream.isPrivate ? '/login' : `/stream/${stream.id}`}
                className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow block"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gray-200">
                  <img
                    src={stream.thumbnail}
                    alt={stream.title}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Live Badge */}
                  {stream.isLive && (
                    <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-medium flex items-center">
                      <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></div>
                      LIVE
                    </div>
                  )}

                  {/* Viewers Count */}
                  <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs flex items-center">
                    <Users className="w-3 h-3 mr-1" />
                    {stream.viewers.toLocaleString()}
                  </div>

                  {/* Private Overlay */}
                  {stream.isPrivate && (
                    <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                      <div className="text-center text-white">
                        <Lock className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm font-medium">Private Session</p>
                        <p className="text-xs opacity-75">Sign in to view</p>
                      </div>
                    </div>
                  )}

                  {/* Play Button */}
                  <Link 
                    to={stream.isPrivate ? '/login' : `/stream/${stream.id}`}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="bg-white bg-opacity-90 rounded-full p-3 hover:bg-opacity-100 transition-all">
                      <Play className="w-6 h-6 text-gray-900" />
                    </div>
                  </Link>
                </div>

                {/* Stream Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-gray-900 text-sm line-clamp-2">
                      {stream.title}
                    </h3>
                    {stream.isPrivate && (
                      <Lock className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                    )}
                  </div>

                  <div className="flex items-center space-x-2 mb-2">
                    <img
                      src={stream.performer.avatar}
                      alt={stream.performer.name}
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="text-sm text-gray-600">{stream.performer.name}</span>
                    <div className="flex items-center text-yellow-500">
                      <Star className="w-3 h-3 fill-current" />
                      <span className="text-xs ml-1">{stream.performer.rating}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {stream.tags.slice(0, 3).map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 capitalize">
                      {stream.category}
                    </span>
                    {stream.isPrivate ? (
                      <button className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                        Sign in to view
                      </button>
                    ) : (
                      <button className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                        Watch now
                      </button>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Call to Action */}
        <div className="mt-12 text-center">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Ready to join the community?
            </h2>
            <p className="text-gray-600 mb-6">
              Sign up for free to watch unlimited streams, tip performers, and enjoy private sessions.
            </p>
            <Link
              to="/quick-register"
              className="bg-primary-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Join LivePanty Free
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestStreams;
