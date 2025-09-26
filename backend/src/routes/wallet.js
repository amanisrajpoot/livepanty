const express = require('express');
const { body, validationResult } = require('express-validator');
const asyncHandler = require('express-async-handler');

const { query } = require('../database/connection');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/wallet/balance:
 *   get:
 *     summary: Get wallet balance
 *     tags: [Wallet]
 *     responses:
 *       200:
 *         description: Wallet balance retrieved
 */
router.get('/balance', asyncHandler(async (req, res) => {
  try {
    const result = await query(`
      SELECT token_balance, reserved_balance, currency_code, conversion_rate
      FROM wallets 
      WHERE user_id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'WALLET_NOT_FOUND',
        message: 'Wallet not found'
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Get wallet balance error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve wallet balance'
    });
  }
}));

/**
 * @swagger
 * /api/wallet/transactions:
 *   get:
 *     summary: Get transaction history
 *     tags: [Wallet]
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
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [token_purchase, tip_sent, tip_received, payout_request, payout_completed, refund]
 *     responses:
 *       200:
 *         description: Transaction history retrieved
 */
router.get('/transactions', asyncHandler(async (req, res) => {
  const { limit = 20, offset = 0, type } = req.query;

  try {
    let whereClause = "WHERE user_id = $1";
    const values = [req.user.id];
    let paramCount = 2;

    if (type) {
      whereClause += ` AND transaction_type = $${paramCount++}`;
      values.push(type);
    }

    const result = await query(`
      SELECT 
        id, transaction_type, amount_tokens, amount_currency, fee_tokens,
        balance_after, reference_id, reference_type, description, created_at
      FROM ledger 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `, [...values, parseInt(limit), parseInt(offset)]);

    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM ledger 
      ${whereClause}
    `, values);

    res.json({
      transactions: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    logger.error('Get transactions error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve transaction history'
    });
  }
}));

/**
 * @swagger
 * /api/wallet/transfer:
 *   post:
 *     summary: Send tip to performer
 *     tags: [Wallet]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - stream_id
 *               - to_user_id
 *               - tokens
 *             properties:
 *               stream_id:
 *                 type: string
 *                 format: uuid
 *               to_user_id:
 *                 type: string
 *                 format: uuid
 *               tokens:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10000
 *               message:
 *                 type: string
 *                 maxLength: 200
 *               is_private:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Tip sent successfully
 *       400:
 *         description: Bad request
 *       402:
 *         description: Insufficient balance
 */
router.post('/transfer', [
  body('stream_id').isUUID(),
  body('to_user_id').isUUID(),
  body('tokens').isInt({ min: 1, max: 10000 }),
  body('message').optional().isLength({ max: 200 }).trim(),
  body('is_private').optional().isBoolean()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request parameters',
      details: errors.array()
    });
  }

  const { stream_id, to_user_id, tokens, message, is_private = false } = req.body;

  // Don't allow tipping yourself
  if (req.user.id === to_user_id) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      message: 'Cannot send tips to yourself'
    });
  }

  try {
    // Check if stream exists and is active
    const streamResult = await query(
      'SELECT id, status, host_id FROM streams WHERE id = $1',
      [stream_id]
    );

    if (streamResult.rows.length === 0) {
      return res.status(404).json({
        error: 'STREAM_NOT_FOUND',
        message: 'Stream not found'
      });
    }

    const stream = streamResult.rows[0];

    if (stream.status !== 'live') {
      return res.status(400).json({
        error: 'STREAM_NOT_ACTIVE',
        message: 'Stream is not currently active'
      });
    }

    if (stream.host_id !== to_user_id) {
      return res.status(400).json({
        error: 'INVALID_RECIPIENT',
        message: 'Can only tip the stream host'
      });
    }

    // Check user's token balance
    const walletResult = await query(
      'SELECT token_balance FROM wallets WHERE user_id = $1',
      [req.user.id]
    );

    if (walletResult.rows.length === 0) {
      return res.status(404).json({
        error: 'WALLET_NOT_FOUND',
        message: 'Wallet not found'
      });
    }

    const currentBalance = walletResult.rows[0].token_balance;

    if (currentBalance < tokens) {
      return res.status(402).json({
        error: 'INSUFFICIENT_BALANCE',
        message: 'Insufficient token balance',
        current_balance: currentBalance,
        required_tokens: tokens
      });
    }

    // Process tip in transaction
    const tipResult = await query(`
      WITH tip_insert AS (
        INSERT INTO tips (stream_id, from_user_id, to_user_id, tokens, message, is_private)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at
      ),
      wallet_update AS (
        UPDATE wallets 
        SET token_balance = token_balance - $4
        WHERE user_id = $2
        RETURNING token_balance
      ),
      stream_update AS (
        UPDATE streams 
        SET total_tips_received = total_tips_received + 1,
            total_tokens_received = total_tokens_received + $4
        WHERE id = $1
      )
      SELECT t.id, t.created_at, w.token_balance
      FROM tip_insert t, wallet_update w
    `, [stream_id, req.user.id, to_user_id, tokens, message, is_private]);

    const tip = tipResult.rows[0];

    // Create ledger entry for sender
    await query(`
      INSERT INTO ledger (user_id, counterparty_id, transaction_type, amount_tokens, balance_after, reference_type, reference_id, description)
      VALUES ($1, $2, 'tip_sent', $3, $4, 'tip', $5, 'Tip sent to performer')
    `, [req.user.id, to_user_id, -tokens, tip.token_balance, tip.id]);

    // Create ledger entry for recipient
    await query(`
      INSERT INTO ledger (user_id, counterparty_id, transaction_type, amount_tokens, reference_type, reference_id, description)
      VALUES ($1, $2, 'tip_received', $3, 'tip', $4, 'Tip received from viewer')
    `, [to_user_id, req.user.id, tokens, tip.id]);

    logger.info(`Tip sent: ${tokens} tokens from ${req.user.id} to ${to_user_id} in stream ${stream_id}`);

    res.json({
      tip_id: tip.id,
      tokens: tokens,
      balance_after: tip.token_balance,
      message: message,
      is_private: is_private,
      created_at: tip.created_at
    });

  } catch (error) {
    logger.error('Send tip error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to send tip'
    });
  }
}));

/**
 * @swagger
 * /api/wallet/buy:
 *   post:
 *     summary: Initiate token purchase
 *     tags: [Wallet]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount_tokens
 *             properties:
 *               amount_tokens:
 *                 type: integer
 *                 minimum: 100
 *                 maximum: 10000
 *               currency_code:
 *                 type: string
 *                 default: USD
 *     responses:
 *       200:
 *         description: Payment session created
 *       400:
 *         description: Bad request
 */
router.post('/buy', [
  body('amount_tokens').isInt({ min: 100, max: 10000 }),
  body('currency_code').optional().isLength({ min: 3, max: 3 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request parameters',
      details: errors.array()
    });
  }

  const { amount_tokens, currency_code = 'USD' } = req.body;

  try {
    // Calculate cost (100 tokens = $1 USD)
    const cost_per_token = 0.01; // $0.01 per token
    const amount_currency = amount_tokens * cost_per_token;

    // For now, return a mock payment session
    // In production, integrate with Stripe or other payment processor
    const payment_session = {
      session_id: `pay_${Date.now()}_${req.user.id}`,
      amount_tokens: amount_tokens,
      amount_currency: amount_currency,
      currency_code: currency_code,
      status: 'pending',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
    };

    logger.info(`Token purchase initiated: ${amount_tokens} tokens for $${amount_currency} by user ${req.user.id}`);

    res.json(payment_session);

  } catch (error) {
    logger.error('Buy tokens error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to initiate token purchase'
    });
  }
}));

module.exports = router;
