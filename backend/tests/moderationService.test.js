const moderationService = require('../src/services/moderationService');
const { query } = require('../src/database/connection');
const logger = require('../src/utils/logger');

// Mock dependencies
jest.mock('../src/database/connection');
jest.mock('../src/utils/logger');

describe('Moderation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createContentReport', () => {
    it('should create a content report', async () => {
      const reportData = {
        reporterId: 'reporter-id',
        reportedUserId: 'reported-id',
        contentType: 'message',
        contentId: 'content-id',
        reason: 'harassment',
        description: 'Test description',
        content: 'Test content'
      };

      const mockResult = {
        rows: [{ id: 'report-id' }]
      };

      query.mockResolvedValueOnce(mockResult);
      moderationService.triggerAutomatedAnalysis = jest.fn().mockResolvedValue({});

      const reportId = await moderationService.createContentReport(reportData);

      expect(reportId).toBe('report-id');
      expect(query).toHaveBeenCalled();
    });

    it('should trigger automated analysis', async () => {
      const reportData = {
        reporterId: 'reporter-id',
        reportedUserId: 'reported-id',
        contentType: 'message',
        reason: 'harassment',
        content: 'Test content'
      };

      query.mockResolvedValueOnce({ rows: [{ id: 'report-id' }] });
      moderationService.triggerAutomatedAnalysis = jest.fn().mockResolvedValue({});

      await moderationService.createContentReport(reportData);

      expect(moderationService.triggerAutomatedAnalysis).toHaveBeenCalled();
    });
  });

  describe('analyzeTextContent', () => {
    it('should analyze text content and flag profanity', async () => {
      const text = 'This is a test message with inappropriate content';
      const contentType = 'message';

      const analysis = await moderationService.analyzeTextContent(text, contentType);

      expect(analysis).toBeDefined();
      expect(analysis).toHaveProperty('isFlagged');
      expect(analysis).toHaveProperty('riskScore');
    });

    it('should calculate risk score based on content', async () => {
      const text = 'Clean message content';
      const analysis = await moderationService.analyzeTextContent(text, 'message');

      expect(analysis.riskScore).toBeGreaterThanOrEqual(0);
      expect(analysis.riskScore).toBeLessThanOrEqual(1);
    });
  });

  describe('getPendingReports', () => {
    it('should return pending reports', async () => {
      const mockReports = {
        rows: [
          { id: 'r1', status: 'pending' },
          { id: 'r2', status: 'flagged' }
        ]
      };

      query.mockResolvedValueOnce(mockReports);

      const reports = await moderationService.getPendingReports(10, 0);

      expect(reports).toHaveLength(2);
      expect(query).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      const mockReports = {
        rows: [{ id: 'r1', status: 'escalated' }]
      };

      query.mockResolvedValueOnce(mockReports);

      const reports = await moderationService.getPendingReports(10, 0, 'escalated');

      expect(reports).toBeDefined();
    });
  });

  describe('takeModerationAction', () => {
    it('should take moderation action', async () => {
      const reportId = 'report-id';
      const action = 'warn_user';

      query.mockResolvedValueOnce({
        rows: [{
          id: reportId,
          reported_user_id: 'user-id',
          content_type: 'message',
          content_id: 'content-id'
        }]
      })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await moderationService.takeModerationAction(reportId, action);

      expect(query).toHaveBeenCalled();
    });

    it('should not take action if action is no_action', async () => {
      const reportId = 'report-id';
      const action = 'no_action';

      await moderationService.takeModerationAction(reportId, action);

      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('warnUser', () => {
    it('should warn a user', async () => {
      const userId = 'user-id';
      const reason = 'Test warning';

      query.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await moderationService.warnUser(userId, reason);

      expect(query).toHaveBeenCalledTimes(2);
    });
  });

  describe('suspendUser', () => {
    it('should suspend a user', async () => {
      const userId = 'user-id';
      const reason = 'Test suspension';

      query.mockResolvedValueOnce({ rows: [] });

      await moderationService.suspendUser(userId, reason, 7);

      expect(query).toHaveBeenCalled();
    });
  });

  describe('banUser', () => {
    it('should ban a user', async () => {
      const userId = 'user-id';
      const reason = 'Test ban';

      query.mockResolvedValueOnce({ rows: [] });

      await moderationService.banUser(userId, reason);

      expect(query).toHaveBeenCalled();
    });
  });

  describe('getModerationStats', () => {
    it('should return moderation statistics', async () => {
      const mockStats = {
        rows: [{
          total_reports: 10,
          pending_reports: 5,
          approved_reports: 3,
          rejected_reports: 2
        }]
      };

      query.mockResolvedValueOnce(mockStats);

      const stats = await moderationService.getModerationStats();

      expect(stats).toBeDefined();
      expect(query).toHaveBeenCalled();
    });
  });
});

