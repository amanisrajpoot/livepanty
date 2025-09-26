const express = require('express');
const asyncHandler = require('express-async-handler');

const { query } = require('../database/connection');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/kyc/verifications:
 *   get:
 *     summary: Get user's KYC verifications
 *     tags: [KYC]
 *     responses:
 *       200:
 *         description: KYC verifications retrieved
 */
router.get('/verifications', asyncHandler(async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        id, status, verification_type, document_type, verification_score,
        rejection_reason, reviewed_at, expires_at, created_at
      FROM kyc_verifications 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [req.user.id]);

    res.json({
      verifications: result.rows
    });

  } catch (error) {
    logger.error('Get KYC verifications error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve KYC verifications'
    });
  }
}));

module.exports = router;
