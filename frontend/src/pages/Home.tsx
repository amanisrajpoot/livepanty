import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Video, Users, DollarSign, Shield, Zap, Heart } from 'lucide-react';

const Home: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();

  const features = [
    {
      icon: Video,
      title: 'Live Streaming',
      description: 'High-quality, low-latency streaming with WebRTC technology for real-time interaction.',
    },
    {
      icon: DollarSign,
      title: 'Token Economy',
      description: 'Send tips instantly with our secure virtual token system. Support your favorite performers.',
    },
    {
      icon: Users,
      title: 'Community',
      description: 'Connect with performers and viewers in real-time chat during live streams.',
    },
    {
      icon: Shield,
      title: 'Safe & Secure',
      description: 'Age verification, content moderation, and secure payment processing.',
    },
    {
      icon: Zap,
      title: 'Real-time Tips',
      description: 'See your tips appear instantly on screen with beautiful animations.',
    },
    {
      icon: Heart,
      title: 'Support Creators',
      description: 'Help performers monetize their content directly through your support.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">LivePanty</span>
            </div>
            
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <span className="text-sm text-gray-600">
                    Welcome back, {user?.display_name}!
                  </span>
                  <Link
                    to="/dashboard"
                    className="btn-primary"
                  >
                    Go to Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="btn-outline"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="btn-primary"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Live Streaming Meets
            <span className="text-primary-600"> Real-time Tipping</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Connect with performers through high-quality live streams and support them 
            instantly with our secure token-based tipping system.
          </p>
          
          {!isAuthenticated && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="btn-primary text-lg px-8 py-3"
              >
                Start Watching
              </Link>
              <Link
                to="/register?role=performer"
                className="btn-secondary text-lg px-8 py-3"
              >
                Become a Performer
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Choose LivePanty?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We've built the most advanced live streaming platform with real-time tipping, 
              ensuring the best experience for both performers and viewers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="card text-center">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-6 h-6 text-primary-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="card">
              <div className="text-4xl font-bold text-primary-600 mb-2">
                &lt;500ms
              </div>
              <div className="text-lg text-gray-600">
                Ultra-low latency streaming
              </div>
            </div>
            <div className="card">
              <div className="text-4xl font-bold text-primary-600 mb-2">
                24/7
              </div>
              <div className="text-lg text-gray-600">
                Content moderation & support
              </div>
            </div>
            <div className="card">
              <div className="text-4xl font-bold text-primary-600 mb-2">
                100%
              </div>
              <div className="text-lg text-gray-600">
                Secure payment processing
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!isAuthenticated && (
        <section className="py-20 bg-primary-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
              Join thousands of performers and viewers already using LivePanty 
              to connect, stream, and support each other.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="bg-white text-primary-600 hover:bg-gray-50 font-medium py-3 px-8 rounded-lg transition-colors duration-200"
              >
                Create Free Account
              </Link>
              <Link
                to="/login"
                className="border border-white text-white hover:bg-white hover:text-primary-600 font-medium py-3 px-8 rounded-lg transition-colors duration-200"
              >
                Already have an account?
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">LivePanty</span>
              </div>
              <p className="text-gray-400">
                The ultimate live streaming platform with real-time tipping.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Platform</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/" className="hover:text-white">Home</Link></li>
                <li><Link to="/dashboard" className="hover:text-white">Streams</Link></li>
                <li><Link to="/create-stream" className="hover:text-white">Create</Link></li>
                <li><Link to="/wallet" className="hover:text-white">Wallet</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-white">Contact Us</a></li>
                <li><a href="#" className="hover:text-white">Community</a></li>
                <li><a href="#" className="hover:text-white">Guidelines</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Cookie Policy</a></li>
                <li><a href="#" className="hover:text-white">Age Verification</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 LivePanty. All rights reserved. | 18+ Only</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
