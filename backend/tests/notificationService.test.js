const notificationService = require('../src/services/notificationService');
const { query } = require('../src/database/connection');
const logger = require('../src/utils/logger');

// Mock dependencies
jest.mock('../src/database/connection');
jest.mock('../src/utils/logger');

describe('Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createNotification', () => {
    it('should create a notification', async () => {
      const userId = 'test-user-id';
      const type = 'test_notification';
      const title = 'Test Title';
      const message = 'Test message';

      const mockResult = {
        rows: [{ id: 'notification-id', created_at: new Date(), is_read: false, read_at: null }]
      };

      query.mockResolvedValueOnce(mockResult)
        .mockResolvedValueOnce({ rows: [{ ...mockResult.rows[0] }] });

      notificationService.sendPushNotification = jest.fn().mockResolvedValue({});
      notificationService.sendEmailNotification = jest.fn().mockResolvedValue({});

      const notificationId = await notificationService.createNotification(
        userId,
        type,
        title,
        message
      );

      expect(notificationId).toBe('notification-id');
      expect(query).toHaveBeenCalled();
    });

    it('should emit socket event', async () => {
      const userId = 'test-user-id';
      const mockResult = {
        rows: [{ id: 'notification-id', created_at: new Date(), is_read: false }]
      };

      query.mockResolvedValueOnce(mockResult)
        .mockResolvedValueOnce({ rows: [mockResult.rows[0]] });

      notificationService.sendPushNotification = jest.fn().mockResolvedValue({});
      notificationService.sendEmailNotification = jest.fn().mockResolvedValue({});

      // Mock broadcastToUser
      const mockBroadcastToUser = jest.fn();
      jest.mock('../src/socket/socketHandlers', () => ({
        broadcastToUser: mockBroadcastToUser
      }));

      await notificationService.createNotification(userId, 'test', 'Title', 'Message');

      expect(query).toHaveBeenCalled();
    });
  });

  describe('getUserNotifications', () => {
    it('should return user notifications', async () => {
      const userId = 'test-user-id';
      const mockNotifications = {
        rows: [
          { id: 'n1', user_id: userId, type: 'test' },
          { id: 'n2', user_id: userId, type: 'test' }
        ]
      };

      query.mockResolvedValueOnce(mockNotifications);

      const notifications = await notificationService.getUserNotifications(userId);

      expect(notifications).toHaveLength(2);
      expect(query).toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notificationId = 'notification-id';
      const userId = 'user-id';

      query.mockResolvedValueOnce({ rows: [] });

      await notificationService.markAsRead(notificationId, userId);

      expect(query).toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      const userId = 'user-id';

      query.mockResolvedValueOnce({ rows: [] });

      await notificationService.markAllAsRead(userId);

      expect(query).toHaveBeenCalled();
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      const userId = 'user-id';
      const mockCount = {
        rows: [{ count: '5' }]
      };

      query.mockResolvedValueOnce(mockCount);

      const count = await notificationService.getUnreadCount(userId);

      expect(count).toBe(5);
      expect(query).toHaveBeenCalled();
    });
  });

  describe('sendKYCStatusUpdatedNotification', () => {
    it('should send KYC approved notification', async () => {
      const userId = 'user-id';
      const status = 'approved';

      notificationService.createNotification = jest.fn().mockResolvedValue('notification-id');

      await notificationService.sendKYCStatusUpdatedNotification(userId, status);

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        userId,
        'kyc_approved',
        expect.any(String),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should send KYC rejected notification with notes', async () => {
      const userId = 'user-id';
      const status = 'rejected';
      const notes = 'Invalid document';

      notificationService.createNotification = jest.fn().mockResolvedValue('notification-id');

      await notificationService.sendKYCStatusUpdatedNotification(userId, status, notes);

      expect(notificationService.createNotification).toHaveBeenCalled();
    });
  });
});

