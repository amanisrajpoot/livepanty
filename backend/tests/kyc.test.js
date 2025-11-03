const request = require('supertest');
const express = require('express');
const kycRoutes = require('../src/routes/kyc');
const { validateJWT } = require('../src/middleware/auth');
const { query } = require('../src/database/connection');

// Mock dependencies
jest.mock('../src/database/connection');
jest.mock('../src/utils/logger');
jest.mock('../src/middleware/auth', () => ({
  validateJWT: (req, res, next) => {
    req.user = { id: 'test-user-id', role: 'admin' };
    next();
  }
}));

const app = express();
app.use(express.json());
app.use('/api/kyc', kycRoutes);

describe('KYC API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/kyc/status', () => {
    it('should return KYC status', async () => {
      const mockVerification = {
        rows: [{
          id: 'verification-id',
          user_id: 'test-user-id',
          status: 'pending'
        }]
      };

      query.mockResolvedValueOnce(mockVerification);

      const response = await request(app)
        .get('/api/kyc/status')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('verification');
    });
  });

  describe('GET /api/kyc/history', () => {
    it('should return KYC history', async () => {
      const mockHistory = {
        rows: [
          { id: 'v1', status: 'approved' },
          { id: 'v2', status: 'rejected' }
        ]
      };

      query.mockResolvedValueOnce(mockHistory);

      const response = await request(app)
        .get('/api/kyc/history')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('verifications');
    });
  });

  describe('GET /api/kyc/admin/pending', () => {
    it('should return pending verifications for admin', async () => {
      const mockVerifications = {
        rows: [
          { id: 'v1', status: 'pending' },
          { id: 'v2', status: 'pending' }
        ]
      };

      query.mockResolvedValueOnce(mockVerifications);

      const response = await request(app)
        .get('/api/kyc/admin/pending')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('verifications');
    });
  });

  describe('PATCH /api/kyc/admin/verification/:id/status', () => {
    it('should update verification status', async () => {
      const verificationId = 'verification-id';
      const updateData = {
        status: 'approved',
        notes: 'Documents verified'
      };

      query.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            id: verificationId,
            user_id: 'user-id',
            status: 'approved'
          }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .patch(`/api/kyc/admin/verification/${verificationId}/status`)
        .set('Authorization', 'Bearer test-token')
        .send(updateData);

      expect(response.status).toBe(200);
    });
  });
});

