const express = require('express');
const asyncHandler = require('express-async-handler');

const { query } = require('../database/connection');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/moderation/report:
 *   post:
 *     summary: Report content or user
 *     tags: [Moderation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - target_type
 *               - target_id
 *               - report_type
 *               - reason
 *             properties:
 *               target_type:
 *                 type: string
 *                 enum: [user, stream, message, tip]
 *               target_id:
 *                 type: string
 *                 format: uuid
 *               report_type:
 *                 type: string
 *                 enum: [inappropriate_content, harassment, spam, underage, fraud, payment_issue, other]
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 1000
 *     responses:
 *       201:
 *         description: Report submitted successfully
 */
router.post('/report', asyncHandler(async (req, res) => {
  const { target_type, target_id, report_type, reason } = req.body;

  try {
    const result = await query(`
      INSERT INTO reports (reporter_id, target_type, target_id, report_type, reason, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING id, created_at
    `, [req.user.id, target_type, target_id, report_type, reason]);

    logger.info(`Report submitted: ${report_type} for ${target_type} ${target_id} by user ${req.user.id}`);

    res.status(201).json({
      report_id: result.rows[0].id,
      message: 'Report submitted successfully',
      created_at: result.rows[0].created_at
    });

  } catch (error) {
    logger.error('Submit report error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to submit report'
    });
  }
}));

module.exports = router;
