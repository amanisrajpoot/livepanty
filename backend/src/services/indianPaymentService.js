const Razorpay = require('razorpay');
const crypto = require('crypto-js');
const logger = require('../utils/logger');
const { query } = require('../database/connection');

class IndianPaymentService {
  constructor() {
    this.razorpay = null;
    this.isInitialized = false;
    
    // Payment methods supported in India
    this.supportedMethods = [
      'upi',
      'netbanking',
      'wallet',
      'card',
      'emi',
      'paylater'
    ];

    // UPI apps supported
    this.upiApps = [
      'googlepay',
      'phonepe',
      'paytm',
      'bharatpe',
      'mobikwik',
      'freecharge',
      'amazonpay'
    ];

    // Token pricing in INR
    this.tokenPricing = {
      '100': { tokens: 100, price: 10, discount: 0 },
      '500': { tokens: 500, price: 45, discount: 10 },
      '1000': { tokens: 1000, price: 80, discount: 20 },
      '2500': { tokens: 2500, price: 180, discount: 28 },
      '5000': { tokens: 5000, price: 350, discount: 30 },
      '10000': { tokens: 10000, price: 650, discount: 35 }
    };
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
      const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

      if (!razorpayKeyId || !razorpayKeySecret) {
        logger.warn('Razorpay credentials not found, payment service will be disabled');
        return;
      }

      this.razorpay = new Razorpay({
        key_id: razorpayKeyId,
        key_secret: razorpayKeySecret
      });

      this.isInitialized = true;
      logger.info('Indian Payment Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Indian Payment Service:', error);
      throw error;
    }
  }

  // Create payment order for token purchase
  async createTokenPurchaseOrder(userId, tokenPackage, paymentMethod = 'upi') {
    try {
      if (!this.isInitialized) {
        throw new Error('Payment service not initialized');
      }

      const packageInfo = this.tokenPricing[tokenPackage];
      if (!packageInfo) {
        throw new Error('Invalid token package');
      }

      if (!this.supportedMethods.includes(paymentMethod)) {
        throw new Error('Unsupported payment method');
      }

      // Get user info
      const userResult = await query(`
        SELECT id, display_name, email FROM users WHERE id = $1
      `, [userId]);

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];
      const orderId = `order_${Date.now()}_${userId}`;

      // Create Razorpay order
      const orderOptions = {
        amount: packageInfo.price * 100, // Amount in paise
        currency: 'INR',
        receipt: orderId,
        notes: {
          userId: userId,
          tokenPackage: tokenPackage,
          tokens: packageInfo.tokens,
          paymentMethod: paymentMethod
        },
        payment_capture: 1
      };

      // Add payment method specific options
      if (paymentMethod === 'upi') {
        orderOptions.method = 'upi';
        orderOptions.upi = {
          flow: 'collect',
          vpa: user.email // Use email as VPA for UPI
        };
      } else if (paymentMethod === 'netbanking') {
        orderOptions.method = 'netbanking';
      } else if (paymentMethod === 'wallet') {
        orderOptions.method = 'wallet';
      } else if (paymentMethod === 'card') {
        orderOptions.method = 'card';
      }

      const order = await this.razorpay.orders.create(orderOptions);

      // Store order in database
      await query(`
        INSERT INTO payment_transactions (
          id, user_id, amount, currency, status, payment_method, 
          token_amount, order_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        order.id,
        userId,
        packageInfo.price,
        'INR',
        'created',
        paymentMethod,
        packageInfo.tokens,
        orderId
      ]);

      return {
        orderId: order.id,
        amount: packageInfo.price,
        currency: 'INR',
        tokens: packageInfo.tokens,
        discount: packageInfo.discount,
        paymentMethod: paymentMethod,
        upiApps: paymentMethod === 'upi' ? this.upiApps : null,
        order: order
      };
    } catch (error) {
      logger.error('Error creating token purchase order:', error);
      throw error;
    }
  }

  // Verify payment and process token credit
  async verifyPayment(paymentId, orderId, signature) {
    try {
      if (!this.isInitialized) {
        throw new Error('Payment service not initialized');
      }

      // Verify signature
      const expectedSignature = crypto.HmacSHA256(
        `${orderId}|${paymentId}`,
        process.env.RAZORPAY_KEY_SECRET
      ).toString();

      if (signature !== expectedSignature) {
        throw new Error('Invalid payment signature');
      }

      // Get payment details from Razorpay
      const payment = await this.razorpay.payments.fetch(paymentId);
      
      if (payment.status !== 'captured') {
        throw new Error('Payment not captured');
      }

      // Get order details
      const order = await this.razorpay.orders.fetch(orderId);
      const userId = order.notes.userId;
      const tokenPackage = order.notes.tokenPackage;
      const tokens = parseInt(order.notes.tokens);

      // Check if payment already processed
      const existingTransaction = await query(`
        SELECT id, status FROM payment_transactions 
        WHERE id = $1 AND status = 'completed'
      `, [orderId]);

      if (existingTransaction.rows.length > 0) {
        return { success: true, message: 'Payment already processed' };
      }

      // Process payment in database transaction
      await query('BEGIN');

      try {
        // Update payment transaction status
        await query(`
          UPDATE payment_transactions 
          SET status = 'completed', payment_id = $1, completed_at = NOW()
          WHERE id = $2
        `, [paymentId, orderId]);

        // Credit tokens to user's wallet
        await query(`
          UPDATE wallets 
          SET token_balance = token_balance + $1, updated_at = NOW()
          WHERE user_id = $2
        `, [tokens, userId]);

        // Record transaction in ledger
        await query(`
          INSERT INTO ledger (
            from_user_id, to_user_id, amount, transaction_type, 
            description, payment_id, created_at
          ) VALUES ($1, $2, $3, 'purchase', $4, $5, NOW())
        `, [userId, userId, tokens, `Token purchase - ${tokenPackage}`, paymentId]);

        await query('COMMIT');

        logger.info(`Payment verified and tokens credited: ${tokens} tokens to user ${userId}`);

        return {
          success: true,
          tokens: tokens,
          amount: order.amount / 100,
          currency: order.currency
        };
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      logger.error('Error verifying payment:', error);
      throw error;
    }
  }

  // Create UPI payment link
  async createUPIPaymentLink(userId, tokenPackage, upiApp = 'googlepay') {
    try {
      const packageInfo = this.tokenPricing[tokenPackage];
      if (!packageInfo) {
        throw new Error('Invalid token package');
      }

      const orderId = `upi_${Date.now()}_${userId}`;
      const amount = packageInfo.price;

      // Create UPI deep link
      const upiId = `${process.env.UPI_MERCHANT_ID}@${process.env.UPI_MERCHANT_NAME}`;
      const transactionId = orderId;
      const merchantName = 'LivePanty';
      const transactionNote = `Token purchase - ${packageInfo.tokens} tokens`;

      // Generate UPI deep link based on app
      let upiLink = '';
      
      switch (upiApp) {
        case 'googlepay':
          upiLink = `tez://upi/pay?pa=${upiId}&pn=${merchantName}&tr=${transactionId}&am=${amount}&cu=INR&tn=${transactionNote}`;
          break;
        case 'phonepe':
          upiLink = `phonepe://pay?pa=${upiId}&pn=${merchantName}&tr=${transactionId}&am=${amount}&cu=INR&tn=${transactionNote}`;
          break;
        case 'paytm':
          upiLink = `paytmmp://pay?pa=${upiId}&pn=${merchantName}&tr=${transactionId}&am=${amount}&cu=INR&tn=${transactionNote}`;
          break;
        default:
          upiLink = `upi://pay?pa=${upiId}&pn=${merchantName}&tr=${transactionId}&am=${amount}&cu=INR&tn=${transactionNote}`;
      }

      // Store UPI payment request
      await query(`
        INSERT INTO payment_transactions (
          id, user_id, amount, currency, status, payment_method, 
          token_amount, order_id, upi_app, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        orderId,
        userId,
        amount,
        'INR',
        'pending',
        'upi',
        packageInfo.tokens,
        orderId,
        upiApp
      ]);

      return {
        upiLink: upiLink,
        orderId: orderId,
        amount: amount,
        tokens: packageInfo.tokens,
        upiApp: upiApp,
        qrCode: this.generateQRCode(upiLink)
      };
    } catch (error) {
      logger.error('Error creating UPI payment link:', error);
      throw error;
    }
  }

  // Generate QR code for UPI payments
  generateQRCode(upiLink) {
    // In production, use a QR code library like 'qrcode'
    // For now, return the UPI link as QR code data
    return {
      data: upiLink,
      format: 'upi'
    };
  }

  // Get payment methods available for user
  async getPaymentMethods(userId) {
    try {
      // Get user's payment history to suggest methods
      const historyResult = await query(`
        SELECT payment_method, COUNT(*) as usage_count
        FROM payment_transactions 
        WHERE user_id = $1 AND status = 'completed'
        GROUP BY payment_method
        ORDER BY usage_count DESC
      `, [userId]);

      const preferredMethods = historyResult.rows.map(row => row.payment_method);

      return {
        supportedMethods: this.supportedMethods,
        upiApps: this.upiApps,
        preferredMethods: preferredMethods,
        tokenPricing: this.tokenPricing
      };
    } catch (error) {
      logger.error('Error getting payment methods:', error);
      throw error;
    }
  }

  // Get payment history for user
  async getPaymentHistory(userId, limit = 20, offset = 0) {
    try {
      const result = await query(`
        SELECT 
          id, amount, currency, status, payment_method, 
          token_amount, created_at, completed_at
        FROM payment_transactions 
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);

      return result.rows;
    } catch (error) {
      logger.error('Error getting payment history:', error);
      throw error;
    }
  }

  // Refund payment
  async refundPayment(paymentId, amount = null) {
    try {
      if (!this.isInitialized) {
        throw new Error('Payment service not initialized');
      }

      const refundOptions = {
        payment_id: paymentId,
        amount: amount ? amount * 100 : null, // Amount in paise
        notes: {
          reason: 'User requested refund'
        }
      };

      const refund = await this.razorpay.payments.refund(paymentId, refundOptions);

      // Update transaction status in database
      await query(`
        UPDATE payment_transactions 
        SET status = 'refunded', refund_id = $1, refunded_at = NOW()
        WHERE payment_id = $2
      `, [refund.id, paymentId]);

      logger.info(`Payment refunded: ${paymentId}, refund ID: ${refund.id}`);

      return refund;
    } catch (error) {
      logger.error('Error refunding payment:', error);
      throw error;
    }
  }

  // Get payment statistics
  async getPaymentStats() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_transactions,
          SUM(amount) as total_amount,
          AVG(amount) as average_amount,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_transactions,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions,
          COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_transactions
        FROM payment_transactions
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `);

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting payment stats:', error);
      throw error;
    }
  }

  // Webhook handler for Razorpay events
  async handleWebhook(body, signature) {
    try {
      if (!this.isInitialized) {
        throw new Error('Payment service not initialized');
      }

      // Verify webhook signature
      const expectedSignature = crypto.HmacSHA256(
        JSON.stringify(body),
        process.env.RAZORPAY_WEBHOOK_SECRET
      ).toString();

      if (signature !== expectedSignature) {
        throw new Error('Invalid webhook signature');
      }

      const event = body.event;
      const payment = body.payload.payment.entity;

      switch (event) {
        case 'payment.captured':
          await this.handlePaymentCaptured(payment);
          break;
        case 'payment.failed':
          await this.handlePaymentFailed(payment);
          break;
        case 'refund.created':
          await this.handleRefundCreated(payment);
          break;
        default:
          logger.info(`Unhandled webhook event: ${event}`);
      }

      return { success: true };
    } catch (error) {
      logger.error('Error handling webhook:', error);
      throw error;
    }
  }

  async handlePaymentCaptured(payment) {
    // Payment captured logic
    logger.info(`Payment captured: ${payment.id}`);
  }

  async handlePaymentFailed(payment) {
    // Payment failed logic
    logger.info(`Payment failed: ${payment.id}`);
  }

  async handleRefundCreated(payment) {
    // Refund created logic
    logger.info(`Refund created: ${payment.id}`);
  }
}

module.exports = new IndianPaymentService();
