import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useKYCSocket } from '../hooks/useKYCSocket';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  Camera,
  Shield,
  X,
  Bell
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

interface KYCStatus {
  kyc_verified: boolean;
  kyc_verified_at: string | null;
  latest_verification_status: string | null;
  latest_submission_date: string | null;
  latest_notes: string | null;
}

const KYCVerification: React.FC = () => {
  const { user, token } = useAuthStore();
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [statusNotification, setStatusNotification] = useState<{
    show: boolean;
    status: string;
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    documentType: '',
    documentNumber: '',
    issuingCountry: ''
  });

  // Set up real-time socket listener for KYC status updates
  useKYCSocket({
    onStatusUpdate: (update) => {
      console.log('Real-time KYC status update received:', update);
      
      // Show notification
      const statusMessages: Record<string, string> = {
        approved: 'Your KYC verification has been approved! You can now access all platform features.',
        rejected: 'Your KYC verification has been rejected. Please check the notes and resubmit.',
        requires_review: 'Your KYC verification requires manual review. Please wait for an admin to review your documents.',
        pending: 'Your KYC verification is pending review.'
      };

      setStatusNotification({
        show: true,
        status: update.status,
        message: statusMessages[update.status] || 'Your KYC status has been updated.',
      });

      // Refresh KYC status from API
      fetchKYCStatus();

      // Auto-hide notification after 5 seconds
      setTimeout(() => {
        setStatusNotification(null);
      }, 5000);
    },
    onError: (error) => {
      console.error('KYC Socket error:', error);
    },
  });

  useEffect(() => {
    fetchKYCStatus();
  }, []);

  const fetchKYCStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/kyc/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setKycStatus(data.kyc);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to fetch KYC status');
      }
    } catch (error) {
      console.error('Error fetching KYC status:', error);
      setError('Failed to fetch KYC status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const validateFile = (file: File): string | null => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return 'Please select a valid file type (JPEG, PNG, GIF, PDF, or WebP)';
    }
    
    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return 'File size must be less than 10MB';
    }
    
    return null;
  };

  const processFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setError(null);
    setSelectedFile(file);
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

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
    
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    
    if (!selectedFile || !formData.documentType || !formData.documentNumber || !formData.issuingCountry) {
      setError('Please fill in all fields and select a document');
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('document', selectedFile);
      formDataToSend.append('documentType', formData.documentType);
      formDataToSend.append('documentNumber', formData.documentNumber);
      formDataToSend.append('issuingCountry', formData.issuingCountry);

      // Simulate upload progress (in real implementation, use XMLHttpRequest for progress tracking)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch(`${API_BASE_URL}/api/kyc/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.ok) {
        const data = await response.json();
        setSuccess(true);
        setSelectedFile(null);
        setFilePreview(null);
        setFormData({ documentType: '', documentNumber: '', issuingCountry: '' });
        
        // Reset form after showing success
        setTimeout(() => {
          setSuccess(false);
          fetchKYCStatus();
        }, 2000);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Upload failed. Please try again.');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      setError('Upload failed. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-6 w-6 text-red-500" />;
      case 'pending':
      case 'requires_review':
        return <Clock className="h-6 w-6 text-yellow-500" />;
      default:
        return <AlertCircle className="h-6 w-6 text-gray-400" />;
    }
  };

  const getStatusText = (status: string | null) => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'pending':
        return 'Pending Review';
      case 'requires_review':
        return 'Requires Review';
      default:
        return 'Not Submitted';
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'approved':
        return 'text-green-600 bg-green-100';
      case 'rejected':
        return 'text-red-600 bg-red-100';
      case 'pending':
      case 'requires_review':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading KYC status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-purple-100 rounded-full">
              <Shield className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Identity Verification</h1>
          <p className="text-gray-600 mt-2">
            Verify your identity to access all platform features and start earning
          </p>
        </div>

        {/* Real-time Status Notification */}
        {statusNotification && statusNotification.show && (
          <div className={`mb-6 p-4 rounded-lg shadow-lg flex items-start space-x-3 animate-fade-in ${
            statusNotification.status === 'approved' 
              ? 'bg-green-50 border border-green-200' 
              : statusNotification.status === 'rejected'
              ? 'bg-red-50 border border-red-200'
              : 'bg-yellow-50 border border-yellow-200'
          }`}>
            <Bell className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
              statusNotification.status === 'approved' 
                ? 'text-green-600' 
                : statusNotification.status === 'rejected'
                ? 'text-red-600'
                : 'text-yellow-600'
            }`} />
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                statusNotification.status === 'approved' 
                  ? 'text-green-800' 
                  : statusNotification.status === 'rejected'
                  ? 'text-red-800'
                  : 'text-yellow-800'
              }`}>
                {statusNotification.message}
              </p>
            </div>
            <button
              onClick={() => setStatusNotification(null)}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Current Status */}
        {kycStatus && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Status</h2>
            <div className="flex items-center space-x-4">
              {getStatusIcon(kycStatus.latest_verification_status)}
              <div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(kycStatus.latest_verification_status)}`}>
                  {getStatusText(kycStatus.latest_verification_status)}
                </span>
                {kycStatus.latest_notes && (
                  <p className="text-sm text-gray-600 mt-1">{kycStatus.latest_notes}</p>
                )}
                {kycStatus.kyc_verified_at && (
                  <p className="text-sm text-gray-500 mt-1">
                    Verified on {new Date(kycStatus.kyc_verified_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Verification Form */}
        {(!kycStatus?.kyc_verified && kycStatus?.latest_verification_status !== 'approved') && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Submit Documents</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Document Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Type *
                </label>
                <select
                  value={formData.documentType}
                  onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Select document type</option>
                  <option value="passport">Passport</option>
                  <option value="drivers_license">Driver's License</option>
                  <option value="national_id">National ID</option>
                  <option value="birth_certificate">Birth Certificate</option>
                </select>
              </div>

              {/* Document Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Number *
                </label>
                <input
                  type="text"
                  value={formData.documentNumber}
                  onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter document number"
                  required
                />
              </div>

              {/* Issuing Country */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Issuing Country *
                </label>
                <select
                  value={formData.issuingCountry}
                  onChange={(e) => setFormData({ ...formData, issuingCountry: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Select country</option>
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="GB">United Kingdom</option>
                  <option value="AU">Australia</option>
                  <option value="IN">India</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                  <option value="ES">Spain</option>
                  <option value="IT">Italy</option>
                  <option value="NL">Netherlands</option>
                </select>
              </div>

              {/* File Upload with Drag and Drop */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Image/PDF *
                </label>
                <div
                  ref={dropZoneRef}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-all ${
                    isDragging
                      ? 'border-purple-500 bg-purple-50'
                      : selectedFile
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
                  }`}
                >
                  <div className="space-y-4 text-center w-full">
                    {selectedFile ? (
                      <div className="space-y-4">
                        {/* File Preview */}
                        {filePreview ? (
                          <div className="relative mx-auto max-w-md">
                            <img
                              src={filePreview}
                              alt="Document preview"
                              className="max-h-64 mx-auto rounded-lg border-2 border-gray-200 shadow-sm"
                            />
                            <button
                              type="button"
                              onClick={removeFile}
                              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center space-x-2 p-4 bg-gray-50 rounded-lg">
                            <FileText className="h-8 w-8 text-gray-400" />
                            <div className="text-left">
                              <p className="text-sm font-medium text-gray-700">{selectedFile.name}</p>
                              <p className="text-xs text-gray-500">
                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={removeFile}
                              className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        )}
                        
                        {/* Upload Progress */}
                        {submitting && (
                          <div className="space-y-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                              ></div>
                            </div>
                            <p className="text-xs text-gray-500">Uploading... {uploadProgress}%</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {isDragging ? (
                          <Upload className="mx-auto h-12 w-12 text-purple-500 animate-bounce" />
                        ) : (
                          <Camera className="mx-auto h-12 w-12 text-gray-400" />
                        )}
                        <div className="text-sm text-gray-600">
                          <label className="relative cursor-pointer bg-white rounded-md font-medium text-purple-600 hover:text-purple-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-purple-500">
                            <span>Click to upload</span>
                            <input
                              ref={fileInputRef}
                              type="file"
                              className="sr-only"
                              onChange={handleFileChange}
                              accept="image/*,.pdf"
                            />
                          </label>
                          <span className="text-gray-500"> or drag and drop</span>
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG, GIF, PDF, WebP up to 10MB</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start space-x-2">
                  <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-center space-x-2 animate-fade-in">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <p className="text-sm text-green-800">
                    Document uploaded successfully! Your verification is being processed.
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end space-x-3">
                {selectedFile && (
                  <button
                    type="button"
                    onClick={removeFile}
                    disabled={submitting}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Remove File
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting || !selectedFile}
                  className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {submitting ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Submit for Verification</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Verification Requirements */}
        <div className="bg-blue-50 rounded-lg p-6 mt-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Verification Requirements</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
              Document must be clear and readable
            </li>
            <li className="flex items-start">
              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
              All text must be visible and not cut off
            </li>
            <li className="flex items-start">
              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
              Document must be valid and not expired
            </li>
            <li className="flex items-start">
              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
              File size must be less than 10MB
            </li>
            <li className="flex items-start">
              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
              Supported formats: JPEG, PNG, GIF, PDF, WebP
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default KYCVerification;
