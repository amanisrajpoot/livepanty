const express = require('express');
const router = express.Router();
const pushNotificationService = require('../services/pushNotificationService');
const { validateJWT } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Register push token
router.post('/register', validateJWT, asyncHandler(async (req, res) => {
  try {
    const { token, platform } = req.body;
    const userId = req.user.id;

    if (!token || !platform) {
      return res.status(400).json({
        error: 'INVALID_DATA',
        message: 'Token and platform are required'
      });
    }

    if (!['android', 'ios'].includes(platform)) {
      return res.status(400).json({
        error: 'INVALID_DATA',
        message: 'Platform must be android or ios'
      });
    }

    const success = await pushNotificationService.registerPushToken(userId, token, platform);

    if (success) {
      res.json({
        success: true,
        message: 'Push token registered successfully'
      });
    } else {
      res.status(500).json({
        error: 'REGISTRATION_FAILED',
        message: 'Failed to register push token'
      });
    }
  } catch (error) {
    logger.error('Register push token error:', error);
    res.status(500).json({
      error: 'REGISTRATION_FAILED',
      message: 'Failed to register push token'
    });
  }
}));

// Unregister push token
router.post('/unregister', validateJWT, asyncHandler(async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) {
      return res.status(400).json({
        error: 'INVALID_DATA',
        message: 'Token is required'
      });
    }

    const success = await pushNotificationService.unregisterPushToken(userId, token);

    if (success) {
      res.json({
        success: true,
        message: 'Push token unregistered successfully'
      });
    } else {
      res.status(500).json({
        error: 'UNREGISTRATION_FAILED',
        message: 'Failed to unregister push token'
      });
    }
  } catch (error) {
    logger.error('Unregister push token error:', error);
    res.status(500).json({
      error: 'UNREGISTRATION_FAILED',
      message: 'Failed to unregister push token'
    });
  }
}));

module.exports = router;

