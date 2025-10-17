import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  Camera,
  Shield
} from 'lucide-react';

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    documentType: '',
    documentNumber: '',
    issuingCountry: ''
  });

  useEffect(() => {
    fetchKYCStatus();
  }, []);

  const fetchKYCStatus = async () => {
    try {
      const response = await fetch('/api/kyc/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setKycStatus(data.kyc);
      }
    } catch (error) {
      console.error('Error fetching KYC status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a valid file type (JPEG, PNG, GIF, PDF, or WebP)');
        return;
      }
      
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile || !formData.documentType || !formData.documentNumber || !formData.issuingCountry) {
      alert('Please fill in all fields and select a document');
      return;
    }

    setSubmitting(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('document', selectedFile);
      formDataToSend.append('documentType', formData.documentType);
      formDataToSend.append('documentNumber', formData.documentNumber);
      formDataToSend.append('issuingCountry', formData.issuingCountry);

      const response = await fetch('/api/kyc/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });

      if (response.ok) {
        const data = await response.json();
        alert('Document uploaded successfully! Your verification is being processed.');
        setSelectedFile(null);
        setFormData({ documentType: '', documentNumber: '', issuingCountry: '' });
        fetchKYCStatus();
      } else {
        const error = await response.json();
        alert(`Upload failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setSubmitting(false);
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

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Image/PDF *
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition-colors">
                  <div className="space-y-1 text-center">
                    {selectedFile ? (
                      <div className="flex items-center space-x-2">
                        <FileText className="h-8 w-8 text-gray-400" />
                        <span className="text-sm text-gray-600">{selectedFile.name}</span>
                      </div>
                    ) : (
                      <div>
                        <Camera className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="flex text-sm text-gray-600">
                          <label className="relative cursor-pointer bg-white rounded-md font-medium text-purple-600 hover:text-purple-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-purple-500">
                            <span>Upload a file</span>
                            <input
                              type="file"
                              className="sr-only"
                              onChange={handleFileChange}
                              accept="image/*,.pdf"
                            />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG, GIF, PDF up to 10MB</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : 'Submit for Verification'}
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
