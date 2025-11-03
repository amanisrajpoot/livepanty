const express = require('express');
const router = express.Router();
const adminService = require('../services/adminService');
const kycService = require('../services/kycService');
const moderationService = require('../services/moderationService');
const notificationService = require('../services/notificationService');
const { validateJWT, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { query } = require('../database/connection');
const logger = require('../utils/logger');

// Get platform overview
router.get('/overview', validateJWT, requireRole(['admin']), asyncHandler(async (req, res) => {
  try {
    const overview = await adminService.getPlatformOverview();

    res.json({
      success: true,
      overview
    });
  } catch (error) {
    logger.error('Get platform overview error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get platform overview'
    });
  }
}));

// Get user management data
router.get('/users', validateJWT, requireRole(['admin']), asyncHandler(async (req, res) => {
  try {
    const { limit = 50, offset = 0, role, status, kyc_verified, search } = req.query;
    
    const filters = {};
    if (role) filters.role = role;
    if (status) filters.status = status;
    if (kyc_verified !== undefined) filters.kyc_verified = kyc_verified === 'true';
    if (search) filters.search = search;

    const result = await adminService.getUserManagementData(
      parseInt(limit),
      parseInt(offset),
      filters
    );

    // Get total count
    const totalResult = await adminService.getUserManagementDataCount(filters);

    res.json({
      success: true,
      users: result.users || result,
      total: totalResult
    });
  } catch (error) {
    logger.error('Get user management data error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get user management data'
    });
  }
}));

// Get user details
router.get('/users/:id', validateJWT, requireRole(['admin']), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT 
        u.*, w.token_balance,
        COUNT(DISTINCT cr.id) as report_count,
        COUNT(DISTINCT uw.id) as warning_count,
        COUNT(DISTINCT s.id) as stream_count,
        COUNT(DISTINCT kv.id) as kyc_count
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      LEFT JOIN content_reports cr ON u.id = cr.reported_user_id
      LEFT JOIN user_warnings uw ON u.id = uw.user_id
      LEFT JOIN streams s ON u.id = s.host_id
      LEFT JOIN kyc_verifications kv ON u.id = kv.user_id
      WHERE u.id = $1
      GROUP BY u.id, w.token_balance
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    logger.error('Get user details error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get user details'
    });
  }
}));

// Update user status
router.patch('/users/:id/status', validateJWT, requireRole(['admin']), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({
        error: 'INVALID_STATUS',
        message: 'Invalid status. Must be active, suspended, or banned'
      });
    }

    let updateQuery = 'UPDATE users SET status = $1';
    const params = [status, id];
    let paramCount = 1;

    if (status === 'suspended') {
      paramCount++;
      updateQuery += `, suspended_until = NOW() + INTERVAL '7 days', suspension_reason = $${paramCount}`;
      params.splice(1, 0, reason || 'Admin suspension');
    } else if (status === 'banned') {
      paramCount++;
      updateQuery += `, banned_at = NOW(), ban_reason = $${paramCount}`;
      params.splice(1, 0, reason || 'Admin ban');
    }

    paramCount++;
    updateQuery += ` WHERE id = $${paramCount}`;

    await query(updateQuery, params);

    // Send notification to user
    if (status === 'suspended') {
      await notificationService.sendSuspensionNotification(id, reason || 'Admin suspension', 7);
    } else if (status === 'banned') {
      await notificationService.sendBanNotification(id, reason || 'Admin ban');
    }

    logger.info(`Admin ${req.user.id} updated user ${id} status to ${status}`);

    res.json({
      success: true,
      message: 'User status updated successfully'
    });
  } catch (error) {
    logger.error('Update user status error:', error);
    res.status(500).json({
      error: 'UPDATE_FAILED',
      message: 'Failed to update user status'
    });
  }
}));

// Get recent activity
router.get('/activity', validateJWT, requireRole(['admin']), asyncHandler(async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const activity = await adminService.getRecentActivity(parseInt(limit));

    res.json({
      success: true,
      activity
    });
  } catch (error) {
    logger.error('Get recent activity error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get recent activity'
    });
  }
}));

// Get system health
router.get('/system/health', validateJWT, requireRole(['admin']), asyncHandler(async (req, res) => {
  try {
    const health = await adminService.getSystemHealth();

    res.json({
      success: true,
      health
    });
  } catch (error) {
    logger.error('Get system health error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get system health'
    });
  }
}));

// Get analytics data
router.get('/analytics', validateJWT, requireRole(['admin']), asyncHandler(async (req, res) => {
  try {
    const { period = '7d', type = 'users' } = req.query;
    const analytics = await adminService.getAnalyticsData(period, type);

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    logger.error('Get analytics error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get analytics data'
    });
  }
}));

// KYC Management
router.get('/kyc/pending', validateJWT, requireRole(['admin']), asyncHandler(async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const verifications = await kycService.getPendingVerifications(parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      verifications
    });
  } catch (error) {
    logger.error('Get pending KYC verifications error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get pending KYC verifications'
    });
  }
}));

router.get('/kyc/stats', validateJWT, requireRole(['admin']), asyncHandler(async (req, res) => {
  try {
    const stats = await kycService.getVerificationStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Get KYC stats error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get KYC statistics'
    });
  }
}));

// Moderation Management
router.get('/moderation/reports', validateJWT, requireRole(['admin', 'moderator']), asyncHandler(async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const reports = await moderationService.getPendingReports(parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      reports
    });
  } catch (error) {
    logger.error('Get moderation reports error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get moderation reports'
    });
  }
}));

router.get('/moderation/stats', validateJWT, requireRole(['admin', 'moderator']), asyncHandler(async (req, res) => {
  try {
    const stats = await moderationService.getModerationStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Get moderation stats error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get moderation statistics'
    });
  }
}));

// Clear cache
router.post('/cache/clear', validateJWT, requireRole(['admin']), asyncHandler(async (req, res) => {
  try {
    adminService.clearCache();

    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    logger.error('Clear cache error:', error);
    res.status(500).json({
      error: 'CLEAR_FAILED',
      message: 'Failed to clear cache'
    });
  }
}));

// Get system settings
router.get('/settings', validateJWT, requireRole(['admin']), asyncHandler(async (req, res) => {
  try {
    const result = await query(`
      SELECT key, value, description, updated_at
      FROM system_settings
      ORDER BY key
    `);

    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = {
        value: row.value,
        description: row.description,
        updatedAt: row.updated_at
      };
    });

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    logger.error('Get system settings error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get system settings'
    });
  }
}));

// Update system settings
router.patch('/settings', validateJWT, requireRole(['admin']), asyncHandler(async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        error: 'INVALID_DATA',
        message: 'Settings object is required'
      });
    }

    for (const [key, value] of Object.entries(settings)) {
      await query(`
        INSERT INTO system_settings (key, value, updated_by, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (key) 
        DO UPDATE SET 
          value = EXCLUDED.value,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
      `, [key, JSON.stringify(value), req.user.id]);
    }

    logger.info(`Admin ${req.user.id} updated system settings`);

    res.json({
      success: true,
      message: 'System settings updated successfully'
    });
  } catch (error) {
    logger.error('Update system settings error:', error);
    res.status(500).json({
      error: 'UPDATE_FAILED',
      message: 'Failed to update system settings'
    });
  }
}));

module.exports = router;