import React, { useState, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  X,
  Flag,
  AlertTriangle,
  Upload,
  FileText,
  Camera,
  XCircle,
  CheckCircle
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

interface ReportContentProps {
  isOpen: boolean;
  onClose: () => void;
  reportedUserId: string;
  reportedUserName?: string;
  contentType: 'message' | 'stream' | 'profile' | 'comment' | 'tip';
  contentId?: string;
  contentPreview?: string;
}

const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment or Bullying' },
  { value: 'hate_speech', label: 'Hate Speech' },
  { value: 'spam', label: 'Spam or Scam' },
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'violence', label: 'Violence or Threats' },
  { value: 'fake_account', label: 'Fake Account' },
  { value: 'intellectual_property', label: 'Intellectual Property Violation' },
  { value: 'underage', label: 'Underage User' },
  { value: 'other', label: 'Other' }
];

const ReportContent: React.FC<ReportContentProps> = ({
  isOpen,
  onClose,
  reportedUserId,
  reportedUserName,
  contentType,
  contentId,
  contentPreview
}) => {
  const { token, user } = useAuthStore();
  const [reason, setReason] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidencePreviews, setEvidencePreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      processFiles(Array.from(files));
    }
  };

  const processFiles = useCallback((files: File[]) => {
    const validFiles: File[] = [];
    const previews: string[] = [];

    files.forEach((file) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Only image files are supported for evidence');
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setError(`${file.name} is too large. Maximum size is 5MB`);
        return;
      }

      validFiles.push(file);

      // Create preview for images
      const reader = new FileReader();
      reader.onloadend = () => {
        previews.push(reader.result as string);
        if (previews.length === validFiles.length) {
          setEvidencePreviews([...evidencePreviews, ...previews]);
        }
      };
      reader.readAsDataURL(file);
    });

    setEvidenceFiles([...evidenceFiles, ...validFiles]);
    setError(null);
  }, [evidenceFiles, evidencePreviews]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const removeFile = (index: number) => {
    setEvidenceFiles(evidenceFiles.filter((_, i) => i !== index));
    setEvidencePreviews(evidencePreviews.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!reason) {
      setError('Please select a reason for reporting');
      return;
    }

    if (!description.trim()) {
      setError('Please provide a description');
      return;
    }

    if (user?.id === reportedUserId) {
      setError('You cannot report yourself');
      return;
    }

    setSubmitting(true);

    try {
      // Upload evidence files first
      let evidence: any = null;
      if (evidenceFiles.length > 0) {
        // In production, upload to S3 or similar
        // For now, we'll just store file names
        evidence = {
          files: evidenceFiles.map(f => f.name),
          count: evidenceFiles.length
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/moderation/report`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reportedUserId,
          contentType,
          contentId,
          reason,
          description: description.trim(),
          evidence
        })
      });

      if (response.ok) {
        setSuccess(true);
        // Reset form
        setReason('');
        setDescription('');
        setEvidenceFiles([]);
        setEvidencePreviews([]);
        
        // Close after 2 seconds
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 2000);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to submit report');
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      setError('Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setReason('');
      setDescription('');
      setEvidenceFiles([]);
      setEvidencePreviews([]);
      setError(null);
      setSuccess(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 rounded-full">
                <Flag className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Report Content</h2>
                {reportedUserName && (
                  <p className="text-sm text-gray-500">Reporting: {reportedUserName}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={submitting}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content Preview */}
          {contentPreview && (
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-1">Content Preview:</p>
              <p className="text-sm text-gray-600">{contentPreview}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Reason Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Reporting *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              >
                <option value="">Select a reason</option>
                {REPORT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Details *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Please provide more details about why you're reporting this content..."
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                {description.length}/500 characters
              </p>
            </div>

            {/* Evidence Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Evidence (Screenshots, Images) <span className="text-gray-500">(Optional)</span>
              </label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`mt-1 border-2 border-dashed rounded-md p-6 transition-colors ${
                  isDragging
                    ? 'border-red-400 bg-red-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-center">
                  {evidenceFiles.length === 0 ? (
                    <div className="space-y-2">
                      <Camera className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="text-sm text-gray-600">
                        <label className="relative cursor-pointer bg-white rounded-md font-medium text-red-600 hover:text-red-500">
                          <span>Upload images</span>
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="sr-only"
                            multiple
                            accept="image/*"
                            onChange={handleFileChange}
                          />
                        </label>
                        <span className="text-gray-500"> or drag and drop</span>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB each</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {evidencePreviews.map((preview, index) => (
                          <div key={index} className="relative">
                            <img
                              src={preview}
                              alt={`Evidence ${index + 1}`}
                              className="w-full h-32 object-cover rounded-md border border-gray-300"
                            />
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <p className="mt-1 text-xs text-gray-600 truncate">
                              {evidenceFiles[index].name}
                            </p>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        + Add more images
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Important:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>False reports may result in your account being suspended</li>
                  <li>Reports are reviewed by our moderation team</li>
                  <li>You will be notified of the outcome</li>
                </ul>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start space-x-3">
                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-800">
                  Report submitted successfully! Thank you for helping keep our community safe.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !reason || !description.trim()}
                className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {submitting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Flag className="h-4 w-4" />
                    <span>Submit Report</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReportContent;

