import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, UserPlus, ShoppingCart, Sparkles, Lock } from 'lucide-react';

interface GuestPromptsProps {
  onSignUp: () => void;
  onBuyTokens: () => void;
  viewTime?: number; // Time in seconds user has been viewing
  streamId?: string;
}

const GuestPrompts: React.FC<GuestPromptsProps> = ({ 
  onSignUp, 
  onBuyTokens,
  viewTime = 0,
  streamId
}) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptType, setPromptType] = useState<'signup' | 'tokens' | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Show initial prompt after 30 seconds
    if (viewTime === 0) {
      const timer = setTimeout(() => {
        setPromptType('signup');
        setShowPrompt(true);
      }, 30000); // 30 seconds

      return () => clearTimeout(timer);
    }

    // Show token prompt after 2 minutes
    if (viewTime >= 120 && !showPrompt) {
      setPromptType('tokens');
      setShowPrompt(true);
    }
  }, [viewTime, showPrompt]);

  // Periodic prompts every 3 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (!showPrompt) {
        // Alternate between signup and tokens
        const type = Math.random() > 0.5 ? 'signup' : 'tokens';
        setPromptType(type);
        setShowPrompt(true);
      }
    }, 180000); // 3 minutes

    return () => clearInterval(interval);
  }, [showPrompt]);

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 transform transition-all">
        <div className="relative p-6">
          {/* Close Button */}
          <button
            onClick={() => setShowPrompt(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {promptType === 'signup' ? (
            <div className="text-center">
              {/* Icon */}
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-purple-100 mb-4">
                <UserPlus className="h-8 w-8 text-purple-600" />
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Love what you're seeing?
              </h3>
              <p className="text-gray-600 mb-6">
                Sign up free to tip performers, chat with others, and enjoy unlimited streams!
              </p>

              {/* Benefits */}
              <div className="bg-purple-50 rounded-lg p-4 mb-6 text-left">
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-center">
                    <Sparkles className="h-4 w-4 text-purple-600 mr-2" />
                    Tip and support your favorite performers
                  </li>
                  <li className="flex items-center">
                    <Lock className="h-4 w-4 text-purple-600 mr-2" />
                    Access private streams and exclusive content
                  </li>
                  <li className="flex items-center">
                    <UserPlus className="h-4 w-4 text-purple-600 mr-2" />
                    Connect with the community in chat
                  </li>
                </ul>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/quick-register"
                  onClick={() => {
                    onSignUp();
                    setShowPrompt(false);
                  }}
                  className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors text-center"
                >
                  Sign Up Free
                </Link>
                <button
                  onClick={() => navigate('/login')}
                  className="flex-1 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Sign In
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-4">
                Already have an account? <Link to="/login" className="text-purple-600 hover:text-purple-700">Sign in</Link>
              </p>
            </div>
          ) : (
            <div className="text-center">
              {/* Icon */}
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-pink-100 mb-4">
                <ShoppingCart className="h-8 w-8 text-pink-600" />
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Support This Performer
              </h3>
              <p className="text-gray-600 mb-6">
                Show your appreciation by sending tips! Tokens unlock amazing features and support creators.
              </p>

              {/* Token Packages */}
              <div className="bg-pink-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { tokens: 100, price: 10, popular: false },
                    { tokens: 500, price: 45, popular: true },
                    { tokens: 1000, price: 80, popular: false }
                  ].map((pkg) => (
                    <button
                      key={pkg.tokens}
                      onClick={() => {
                        navigate('/quick-register');
                        setShowPrompt(false);
                      }}
                      className={`relative p-3 rounded-lg border-2 transition-all ${
                        pkg.popular
                          ? 'border-pink-500 bg-pink-100'
                          : 'border-gray-200 bg-white hover:border-pink-300'
                      }`}
                    >
                      {pkg.popular && (
                        <span className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-pink-500 text-white text-xs px-2 py-0.5 rounded-full">
                          Popular
                        </span>
                      )}
                      <div className="font-bold text-gray-900">{pkg.tokens}</div>
                      <div className="text-xs text-gray-600">tokens</div>
                      <div className="text-xs font-medium text-gray-900 mt-1">${pkg.price}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    navigate('/quick-register');
                    onBuyTokens();
                    setShowPrompt(false);
                  }}
                  className="flex-1 bg-pink-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-pink-700 transition-colors"
                >
                  Get Tokens Now
                </button>
                <button
                  onClick={() => setShowPrompt(false)}
                  className="flex-1 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Maybe Later
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-4">
                <Link to="/quick-register" className="text-pink-600 hover:text-pink-700">Sign up</Link> to start tipping!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GuestPrompts;

