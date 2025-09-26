const express = require('express');
const asyncHandler = require('express-async-handler');

const { query } = require('../database/connection');
const logger = require('../utils/logger');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require admin role
router.use(requireAdmin);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Users retrieved
 */
router.get('/users', asyncHandler(async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;

  try {
    const result = await query(`
      SELECT 
        u.id, u.email, u.display_name, u.username, u.role, u.status, 
        u.country, u.email_verified, u.last_login_at, u.created_at,
        w.token_balance
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      WHERE u.deleted_at IS NULL
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), parseInt(offset)]);

    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM users 
      WHERE deleted_at IS NULL
    `);

    res.json({
      users: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve users'
    });
  }
}));

/**
 * @swagger
 * /api/admin/analytics/overview:
 *   get:
 *     summary: Get platform analytics (Admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Analytics retrieved
 */
router.get('/analytics/overview', asyncHandler(async (req, res) => {
  try {
    // Get basic platform statistics
    const [
      totalUsers,
      activeUsers,
      totalStreams,
      activeStreams,
      totalTips,
      totalTokens
    ] = await Promise.all([
      query('SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL'),
      query('SELECT COUNT(*) as count FROM users WHERE status = \'active\' AND deleted_at IS NULL'),
      query('SELECT COUNT(*) as count FROM streams'),
      query('SELECT COUNT(*) as count FROM streams WHERE status = \'live\''),
      query('SELECT COUNT(*) as count FROM tips'),
      query('SELECT SUM(tokens) as total FROM tips')
    ]);

    res.json({
      period: 'all_time',
      total_users: parseInt(totalUsers.rows[0].count),
      active_users: parseInt(activeUsers.rows[0].count),
      total_streams: parseInt(totalStreams.rows[0].count),
      active_streams: parseInt(activeStreams.rows[0].count),
      total_tips: parseInt(totalTips.rows[0].count),
      total_tokens: parseInt(totalTokens.rows[0].total) || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Get analytics error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve analytics'
    });
  }
}));

module.exports = router;
