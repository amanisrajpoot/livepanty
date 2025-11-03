import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useStreamStore } from '../store/streamStore';
import { Video, Lock, MessageCircle, Heart, Globe, Tag } from 'lucide-react';

const CreateStream: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { createStream, isLoading, error } = useStreamStore();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    tags: '',
    is_private: false,
    tip_enabled: true,
    chat_enabled: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tagArray, setTagArray] = useState<string[]>([]);

  const categories = [
    { value: 'cam', label: 'Cam Show', icon: '🎥' },
    { value: 'dance', label: 'Dance', icon: '💃' },
    { value: 'gaming', label: 'Gaming', icon: '🎮' },
    { value: 'music', label: 'Music', icon: '🎵' },
    { value: 'fitness', label: 'Fitness', icon: '💪' },
    { value: 'art', label: 'Art', icon: '🎨' },
    { value: 'chat', label: 'Chat', icon: '💬' },
    { value: 'cooking', label: 'Cooking', icon: '👨‍🍳' },
    { value: 'education', label: 'Education', icon: '📚' },
    { value: 'other', label: 'Other', icon: '✨' },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (name === 'tags') {
      // Convert comma-separated tags to array
      const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      setTagArray(tags);
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 200) {
      newErrors.title = 'Title must be 200 characters or less';
    }

    if (formData.description.length > 1000) {
      newErrors.description = 'Description must be 1000 characters or less';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (tagArray.length > 10) {
      newErrors.tags = 'Maximum 10 tags allowed';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await createStream({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        category: formData.category,
        tags: tagArray.length > 0 ? tagArray : undefined,
        is_private: formData.is_private,
        tip_enabled: formData.tip_enabled,
        chat_enabled: formData.chat_enabled,
      });

      // Navigate to dashboard after successful creation
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to create stream:', err);
      // Error is handled by store
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
            <Video className="w-8 h-8 mr-3 text-primary-600" />
            Create New Stream
          </h1>
          <p className="text-gray-600">
            Set up your streaming session and start sharing your content with viewers
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Stream Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., Welcome to my room!"
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.title ? 'border-red-300' : 'border-gray-300'
              }`}
              maxLength={200}
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">{formData.title.length}/200 characters</p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Tell viewers what your stream is about..."
              rows={4}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.description ? 'border-red-300' : 'border-gray-300'
              }`}
              maxLength={1000}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">{formData.description.length}/1000 characters</p>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {categories.map((cat) => (
                <label
                  key={cat.value}
                  className={`relative flex flex-col items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.category === cat.value
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-300 hover:border-primary-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={cat.value}
                    checked={formData.category === cat.value}
                    onChange={handleInputChange}
                    className="sr-only"
                  />
                  <span className="text-2xl mb-1">{cat.icon}</span>
                  <span className="text-sm font-medium text-gray-700">{cat.label}</span>
                </label>
              ))}
            </div>
            {errors.category && (
              <p className="mt-1 text-sm text-red-600">{errors.category}</p>
            )}
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Tag className="w-4 h-4 mr-2" />
              Tags (Optional)
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
              placeholder="fun, chat, friendly (comma-separated)"
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.tags ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.tags && (
              <p className="mt-1 text-sm text-red-600">{errors.tags}</p>
            )}
            {tagArray.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {tagArray.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-1 text-sm text-gray-500">Separate tags with commas (max 10 tags)</p>
          </div>

          {/* Settings Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Privacy Setting */}
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="is_private"
                  checked={formData.is_private}
                  onChange={handleInputChange}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                />
                <div className="ml-3">
                  <div className="flex items-center">
                    {formData.is_private ? (
                      <Lock className="w-5 h-5 text-gray-700 mr-2" />
                    ) : (
                      <Globe className="w-5 h-5 text-gray-700 mr-2" />
                    )}
                    <span className="font-medium text-gray-900">
                      {formData.is_private ? 'Private Stream' : 'Public Stream'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {formData.is_private
                      ? 'Only authenticated users can view'
                      : 'Anyone can view (guest access)'}
                  </p>
                </div>
              </label>
            </div>

            {/* Tips Setting */}
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="tip_enabled"
                  checked={formData.tip_enabled}
                  onChange={handleInputChange}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                />
                <div className="ml-3">
                  <div className="flex items-center">
                    <Heart className="w-5 h-5 text-gray-700 mr-2" />
                    <span className="font-medium text-gray-900">Enable Tips</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Allow viewers to send tips
                  </p>
                </div>
              </label>
            </div>

            {/* Chat Setting */}
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="chat_enabled"
                  checked={formData.chat_enabled}
                  onChange={handleInputChange}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                />
                <div className="ml-3">
                  <div className="flex items-center">
                    <MessageCircle className="w-5 h-5 text-gray-700 mr-2" />
                    <span className="font-medium text-gray-900">Enable Chat</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Allow viewers to chat
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Video className="w-5 h-5 mr-2" />
                  Create Stream
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateStream;
