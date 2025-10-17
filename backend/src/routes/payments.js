const express = require('express');
const { body, validationResult } = require('express-validator');
const asyncHandler = require('express-async-handler');

const { query } = require('../database/connection');
const logger = require('../utils/logger');
const indianPaymentService = require('../services/indianPaymentService');

const router = express.Router();

/**
 * @swagger
 * /api/payments/methods:
 *   get:
 *     summary: Get available payment methods
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Payment methods retrieved
 */
router.get('/methods', asyncHandler(async (req, res) => {
  try {
    const methods = await indianPaymentService.getPaymentMethods(req.user.id);
    res.json(methods);
  } catch (error) {
    logger.error('Get payment methods error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve payment methods'
    });
  }
}));

/**
 * @swagger
 * /api/payments/token-packages:
 *   get:
 *     summary: Get available token packages
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Token packages retrieved
 */
router.get('/token-packages', asyncHandler(async (req, res) => {
  try {
    const packages = indianPaymentService.tokenPricing;
    res.json({
      packages: Object.entries(packages).map(([key, value]) => ({
        id: key,
        tokens: value.tokens,
        price: value.price,
        discount: value.discount,
        savings: Math.round((value.tokens * 0.1) - value.price)
      }))
    });
  } catch (error) {
    logger.error('Get token packages error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve token packages'
    });
  }
}));

/**
 * @swagger
 * /api/payments/create-order:
 *   post:
 *     summary: Create payment order for token purchase
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokenPackage
 *               - paymentMethod
 *             properties:
 *               tokenPackage:
 *                 type: string
 *                 enum: ['100', '500', '1000', '2500', '5000', '10000']
 *               paymentMethod:
 *                 type: string
 *                 enum: ['upi', 'netbanking', 'wallet', 'card', 'emi', 'paylater']
 *     responses:
 *       200:
 *         description: Payment order created
 *       400:
 *         description: Invalid request data
 */
router.post('/create-order', [
  body('tokenPackage').isIn(['100', '500', '1000', '2500', '5000', '10000']),
  body('paymentMethod').isIn(['upi', 'netbanking', 'wallet', 'card', 'emi', 'paylater'])
], asyncHandler(async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: errors.array()
      });
    }

    const { tokenPackage, paymentMethod } = req.body;
    
    const order = await indianPaymentService.createTokenPurchaseOrder(
      req.user.id,
      tokenPackage,
      paymentMethod
    );

    res.json({
      success: true,
      order: order
    });
  } catch (error) {
    logger.error('Create payment order error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error.message || 'Failed to create payment order'
    });
  }
}));

/**
 * @swagger
 * /api/payments/verify:
 *   post:
 *     summary: Verify payment and credit tokens
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentId
 *               - orderId
 *               - signature
 *             properties:
 *               paymentId:
 *                 type: string
 *               orderId:
 *                 type: string
 *               signature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment verified successfully
 *       400:
 *         description: Invalid payment data
 */
router.post('/verify', [
  body('paymentId').notEmpty(),
  body('orderId').notEmpty(),
  body('signature').notEmpty()
], asyncHandler(async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: errors.array()
      });
    }

    const { paymentId, orderId, signature } = req.body;
    
    const result = await indianPaymentService.verifyPayment(
      paymentId,
      orderId,
      signature
    );

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: result
    });
  } catch (error) {
    logger.error('Verify payment error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error.message || 'Failed to verify payment'
    });
  }
}));

/**
 * @swagger
 * /api/payments/upi-link:
 *   post:
 *     summary: Create UPI payment link
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokenPackage
 *               - upiApp
 *             properties:
 *               tokenPackage:
 *                 type: string
 *                 enum: ['100', '500', '1000', '2500', '5000', '10000']
 *               upiApp:
 *                 type: string
 *                 enum: ['googlepay', 'phonepe', 'paytm', 'bharatpe', 'mobikwik', 'freecharge', 'amazonpay']
 *     responses:
 *       200:
 *         description: UPI payment link created
 */
router.post('/upi-link', [
  body('tokenPackage').isIn(['100', '500', '1000', '2500', '5000', '10000']),
  body('upiApp').isIn(['googlepay', 'phonepe', 'paytm', 'bharatpe', 'mobikwik', 'freecharge', 'amazonpay'])
], asyncHandler(async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: errors.array()
      });
    }

    const { tokenPackage, upiApp } = req.body;
    
    const upiLink = await indianPaymentService.createUPIPaymentLink(
      req.user.id,
      tokenPackage,
      upiApp
    );

    res.json({
      success: true,
      upiLink: upiLink
    });
  } catch (error) {
    logger.error('Create UPI link error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error.message || 'Failed to create UPI payment link'
    });
  }
}));

/**
 * @swagger
 * /api/payments/history:
 *   get:
 *     summary: Get payment history
 *     tags: [Payments]
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
 *         description: Payment history retrieved
 */
router.get('/history', asyncHandler(async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const history = await indianPaymentService.getPaymentHistory(
      req.user.id,
      limit,
      offset
    );

    res.json({
      success: true,
      history: history
    });
  } catch (error) {
    logger.error('Get payment history error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve payment history'
    });
  }
}));

/**
 * @swagger
 * /api/payments/refund:
 *   post:
 *     summary: Request payment refund
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentId
 *             properties:
 *               paymentId:
 *                 type: string
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Refund processed
 */
router.post('/refund', [
  body('paymentId').notEmpty()
], asyncHandler(async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: errors.array()
      });
    }

    const { paymentId, amount } = req.body;
    
    // Check if user owns this payment
    const paymentResult = await query(`
      SELECT user_id FROM payment_transactions 
      WHERE payment_id = $1 AND user_id = $2
    `, [paymentId, req.user.id]);

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({
        error: 'PAYMENT_NOT_FOUND',
        message: 'Payment not found or not owned by user'
      });
    }

    const refund = await indianPaymentService.refundPayment(paymentId, amount);

    res.json({
      success: true,
      message: 'Refund processed successfully',
      refund: refund
    });
  } catch (error) {
    logger.error('Refund payment error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error.message || 'Failed to process refund'
    });
  }
}));

/**
 * @swagger
 * /api/payments/stats:
 *   get:
 *     summary: Get payment statistics (admin only)
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Payment statistics retrieved
 */
router.get('/stats', asyncHandler(async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Admin access required'
      });
    }

    const stats = await indianPaymentService.getPaymentStats();

    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    logger.error('Get payment stats error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve payment statistics'
    });
  }
}));

/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     summary: Handle payment webhooks
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed
 */
router.post('/webhook', asyncHandler(async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;

    const result = await indianPaymentService.handleWebhook(body, signature);

    res.json(result);
  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Webhook processing failed'
    });
  }
}));

module.exports = router;
