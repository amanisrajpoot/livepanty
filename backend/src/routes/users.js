const express = require('express');
const { body, validationResult } = require('express-validator');
const asyncHandler = require('express-async-handler');

const { query } = require('../database/connection');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/users/{userId}:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User profile retrieved
 *       404:
 *         description: User not found
 */
router.get('/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  try {
    const userResult = await query(`
      SELECT 
        id, display_name, username, role, status, country, 
        profile_image_url, bio, is_public, created_at
      FROM users 
      WHERE id = $1 AND deleted_at IS NULL
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Only return public information
    res.json({
      id: user.id,
      display_name: user.display_name,
      username: user.username,
      country: user.country,
      profile_image_url: user.profile_image_url,
      bio: user.is_public ? user.bio : null,
      is_public: user.is_public,
      created_at: user.created_at
    });

  } catch (error) {
    logger.error('Get user profile error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve user profile'
    });
  }
}));

/**
 * @swagger
 * /api/users/{userId}:
 *   patch:
 *     summary: Update user profile
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               display_name:
 *                 type: string
 *               bio:
 *                 type: string
 *               is_public:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       403:
 *         description: Forbidden
 */
router.patch('/:userId', [
  body('display_name').optional().isLength({ min: 2, max: 100 }).trim(),
  body('bio').optional().isLength({ max: 500 }).trim(),
  body('is_public').optional().isBoolean()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request parameters',
      details: errors.array()
    });
  }

  const { userId } = req.params;

  // Check if user can update this profile
  if (req.user.id !== userId && req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'You can only update your own profile'
    });
  }

  const { display_name, bio, is_public } = req.body;

  try {
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (display_name !== undefined) {
      updateFields.push(`display_name = $${paramCount++}`);
      values.push(display_name);
    }

    if (bio !== undefined) {
      updateFields.push(`bio = $${paramCount++}`);
      values.push(bio);
    }

    if (is_public !== undefined) {
      updateFields.push(`is_public = $${paramCount++}`);
      values.push(is_public);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'No fields to update'
      });
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(userId);

    const result = await query(`
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, display_name, bio, is_public, updated_at
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    logger.info(`User profile updated: ${userId}`);

    res.json({
      id: result.rows[0].id,
      display_name: result.rows[0].display_name,
      bio: result.rows[0].bio,
      is_public: result.rows[0].is_public,
      updated_at: result.rows[0].updated_at
    });

  } catch (error) {
    logger.error('Update user profile error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to update user profile'
    });
  }
}));

/**
 * @swagger
 * /api/users/{userId}/preferences:
 *   get:
 *     summary: Get user preferences
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User preferences retrieved
 */
router.get('/:userId/preferences', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Check if user can access these preferences
  if (req.user.id !== userId && req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'You can only access your own preferences'
    });
  }

  try {
    const result = await query(`
      SELECT 
        notification_email, notification_push, notification_tips, 
        notification_followers, language, currency, timezone,
        privacy_level, allow_private_messages, allow_followers
      FROM user_preferences 
      WHERE user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'PREFERENCES_NOT_FOUND',
        message: 'User preferences not found'
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Get user preferences error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve user preferences'
    });
  }
}));

/**
 * @swagger
 * /api/users/{userId}/preferences:
 *   patch:
 *     summary: Update user preferences
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notification_email:
 *                 type: boolean
 *               notification_push:
 *                 type: boolean
 *               privacy_level:
 *                 type: string
 *                 enum: [strict, standard, open]
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 */
router.patch('/:userId/preferences', [
  body('notification_email').optional().isBoolean(),
  body('notification_push').optional().isBoolean(),
  body('notification_tips').optional().isBoolean(),
  body('notification_followers').optional().isBoolean(),
  body('language').optional().isLength({ min: 2, max: 5 }),
  body('currency').optional().isLength({ min: 3, max: 3 }),
  body('timezone').optional().isLength({ min: 3, max: 50 }),
  body('privacy_level').optional().isIn(['strict', 'standard', 'open']),
  body('allow_private_messages').optional().isBoolean(),
  body('allow_followers').optional().isBoolean()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request parameters',
      details: errors.array()
    });
  }

  const { userId } = req.params;

  // Check if user can update these preferences
  if (req.user.id !== userId && req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'You can only update your own preferences'
    });
  }

  const {
    notification_email, notification_push, notification_tips,
    notification_followers, language, currency, timezone,
    privacy_level, allow_private_messages, allow_followers
  } = req.body;

  try {
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    // Add all the preference fields
    const preferences = {
      notification_email, notification_push, notification_tips,
      notification_followers, language, currency, timezone,
      privacy_level, allow_private_messages, allow_followers
    };

    Object.entries(preferences).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = $${paramCount++}`);
        values.push(value);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'No fields to update'
      });
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(userId);

    const result = await query(`
      UPDATE user_preferences 
      SET ${updateFields.join(', ')}
      WHERE user_id = $${paramCount}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'PREFERENCES_NOT_FOUND',
        message: 'User preferences not found'
      });
    }

    logger.info(`User preferences updated: ${userId}`);

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Update user preferences error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to update user preferences'
    });
  }
}));

module.exports = router;
