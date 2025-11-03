const kycService = require('../src/services/kycService');
const { query } = require('../src/database/connection');
const logger = require('../src/utils/logger');

// Mock dependencies
jest.mock('../src/database/connection');
jest.mock('../src/utils/logger');

describe('KYC Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createVerification', () => {
    it('should create a new KYC verification', async () => {
      const userId = 'test-user-id';
      const documentType = 'passport';
      const documentNumber = 'TEST123456';
      const mockResult = {
        rows: [{ id: 'verification-id' }]
      };

      query.mockResolvedValueOnce(mockResult);

      const verificationId = await kycService.createVerification(
        userId,
        documentType,
        documentNumber,
        'US'
      );

      expect(verificationId).toBe('verification-id');
      expect(query).toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      query.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        kycService.createVerification('user-id', 'passport', 'TEST123', 'US')
      ).rejects.toThrow();
    });
  });

  describe('getVerificationById', () => {
    it('should return verification by ID', async () => {
      const verificationId = 'test-verification-id';
      const mockVerification = {
        rows: [{
          id: verificationId,
          user_id: 'user-id',
          document_type: 'passport',
          status: 'pending'
        }]
      };

      query.mockResolvedValueOnce(mockVerification);

      const verification = await kycService.getVerificationById(verificationId);

      expect(verification).toBeDefined();
      expect(verification.id).toBe(verificationId);
    });

    it('should return null if verification not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const verification = await kycService.getVerificationById('non-existent-id');

      expect(verification).toBeNull();
    });
  });

  describe('updateVerificationStatus', () => {
    it('should update verification status', async () => {
      const verificationId = 'test-verification-id';
      const status = 'approved';
      const notes = 'Documents verified';
      const reviewedBy = 'admin-id';

      query.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            id: verificationId,
            user_id: 'user-id',
            status: status
          }]
        })
        .mockResolvedValueOnce({ rows: [] });

      await kycService.updateVerificationStatus(verificationId, status, notes, reviewedBy);

      expect(query).toHaveBeenCalled();
    });

    it('should update user kyc_verified when approved', async () => {
      const verificationId = 'test-verification-id';
      const status = 'approved';

      query.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            id: verificationId,
            user_id: 'user-id',
            status: status
          }]
        })
        .mockResolvedValueOnce({ rows: [] });

      await kycService.updateVerificationStatus(verificationId, status);

      expect(query).toHaveBeenCalledTimes(3);
    });
  });

  describe('getPendingVerifications', () => {
    it('should return pending verifications', async () => {
      const mockVerifications = {
        rows: [
          { id: 'v1', status: 'pending' },
          { id: 'v2', status: 'pending' }
        ]
      };

      query.mockResolvedValueOnce(mockVerifications);

      const verifications = await kycService.getPendingVerifications(10, 0);

      expect(verifications).toHaveLength(2);
      expect(query).toHaveBeenCalled();
    });
  });

  describe('getUserVerifications', () => {
    it('should return user verifications', async () => {
      const userId = 'test-user-id';
      const mockVerifications = {
        rows: [{ id: 'v1', user_id: userId }]
      };

      query.mockResolvedValueOnce(mockVerifications);

      const verifications = await kycService.getUserVerifications(userId);

      expect(verifications).toBeDefined();
      expect(query).toHaveBeenCalled();
    });
  });
});

