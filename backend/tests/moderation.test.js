const request = require('supertest');
const express = require('express');
const moderationRoutes = require('../src/routes/moderation');
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
app.use('/api/moderation', moderationRoutes);

describe('Moderation API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/moderation/report', () => {
    it('should create a content report', async () => {
      const reportData = {
        reportedUserId: 'reported-user-id',
        contentType: 'message',
        reason: 'harassment',
        description: 'Test report'
      };

      query.mockResolvedValueOnce({ rows: [{ id: 'report-id' }] });

      const response = await request(app)
        .post('/api/moderation/report')
        .set('Authorization', 'Bearer test-token')
        .send(reportData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('reportId');
    });
  });

  describe('POST /api/moderation/analyze', () => {
    it('should analyze text content', async () => {
      const analyzeData = {
        text: 'Test message content',
        contentType: 'message'
      };

      const response = await request(app)
        .post('/api/moderation/analyze')
        .set('Authorization', 'Bearer test-token')
        .send(analyzeData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('analysis');
      expect(response.body.analysis).toHaveProperty('isFlagged');
      expect(response.body.analysis).toHaveProperty('riskScore');
    });
  });

  describe('GET /api/moderation/admin/reports', () => {
    it('should return pending reports for admin', async () => {
      const mockReports = {
        rows: [
          { id: 'r1', status: 'pending' },
          { id: 'r2', status: 'flagged' }
        ]
      };

      query.mockResolvedValueOnce(mockReports);

      const response = await request(app)
        .get('/api/moderation/admin/reports')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('reports');
    });

    it('should filter reports by status', async () => {
      const mockReports = {
        rows: [{ id: 'r1', status: 'escalated' }]
      };

      query.mockResolvedValueOnce(mockReports);

      const response = await request(app)
        .get('/api/moderation/admin/reports?status=escalated')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('reports');
    });
  });

  describe('PATCH /api/moderation/admin/reports/:id/status', () => {
    it('should update report status', async () => {
      const reportId = 'report-id';
      const updateData = {
        status: 'resolved',
        action: 'warn_user',
        notes: 'Issue resolved'
      };

      query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .patch(`/api/moderation/admin/reports/${reportId}/status`)
        .set('Authorization', 'Bearer test-token')
        .send(updateData);

      expect(response.status).toBe(200);
    });
  });
});

