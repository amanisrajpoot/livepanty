import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Video, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

const QuickRegister: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { quickRegister, error, clearError } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as any;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    clearError();

    try {
      // Generate display name from email if not provided
      const finalDisplayName = displayName.trim() || formData.email.split('@')[0];
      
      const registrationData = {
        email: formData.email,
        password: formData.password,
        display_name: finalDisplayName,
        role: 'viewer' as const,
      };
      
      await quickRegister(registrationData);
      
      // Redirect to the page user came from, or dashboard
      const redirectTo = state?.from || state?.redirectAfter || '/dashboard';
      navigate(redirectTo);
    } catch (error) {
      // Error is handled by the store
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link to="/" className="flex items-center justify-center space-x-2 mb-6">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <Video className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">LivePanty</span>
          </Link>
          <h2 className="text-3xl font-bold text-gray-900">
            Join LivePanty
          </h2>
          <p className="mt-2 text-gray-600">
            Create account in seconds - just email & password!
          </p>
        </div>

        {/* Quick Registration Form */}
        <div className="card">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="input pl-10"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            {/* Display Name (Optional) */}
            <div>
              <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 mb-2">
                Display Name <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="display_name"
                  name="display_name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input pl-10"
                  placeholder="How should we call you? (auto-generated if empty)"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                If empty, we'll use your email username
              </p>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="input pl-10 pr-10"
                  placeholder="At least 8 characters"
                  minLength={8}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>

            {/* Terms - Compact */}
            <p className="text-xs text-center text-gray-500">
              By continuing, you agree to our{' '}
              <button className="text-primary-600 hover:text-primary-500">Terms</button> and{' '}
              <button className="text-primary-600 hover:text-primary-500">Privacy</button>.
              Must be 18+.
            </p>
          </form>

          {/* Footer Links */}
          <div className="mt-6 space-y-3 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-primary-600 hover:text-primary-500 font-medium">
                Sign in
              </Link>
            </p>
            <p className="text-sm text-gray-500">
              Just want to watch?{' '}
              <Link to="/streams" className="text-primary-600 hover:text-primary-500">
                Browse as Guest
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickRegister;
