const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const { validateJWT } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Get user's notifications
router.get('/', validateJWT, asyncHandler(async (req, res) => {
  try {
    const { limit = 50, offset = 0, unread_only = false } = req.query;
    const userId = req.user.id;

    let notifications;
    if (unread_only === 'true') {
      notifications = await notificationService.getUnreadNotifications(userId, parseInt(limit), parseInt(offset));
    } else {
      notifications = await notificationService.getUserNotifications(userId, parseInt(limit), parseInt(offset));
    }

    res.json({
      success: true,
      notifications: notifications
    });
  } catch (error) {
    logger.error('Get notifications error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get notifications'
    });
  }
}));

// Get unread notifications count
router.get('/unread/count', validateJWT, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      count: count
    });
  } catch (error) {
    logger.error('Get unread count error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get unread count'
    });
  }
}));

// Mark notification as read
router.patch('/:id/read', validateJWT, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await notificationService.markAsRead(id, userId);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    logger.error('Mark notification as read error:', error);
    res.status(500).json({
      error: 'UPDATE_FAILED',
      message: 'Failed to mark notification as read'
    });
  }
}));

// Mark all notifications as read
router.patch('/read-all', validateJWT, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;

    await notificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error('Mark all notifications as read error:', error);
    res.status(500).json({
      error: 'UPDATE_FAILED',
      message: 'Failed to mark all notifications as read'
    });
  }
}));

// Delete notification
router.delete('/:id', validateJWT, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await notificationService.deleteNotification(id, userId);

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    logger.error('Delete notification error:', error);
    res.status(500).json({
      error: 'DELETE_FAILED',
      message: 'Failed to delete notification'
    });
  }
}));

module.exports = router;

