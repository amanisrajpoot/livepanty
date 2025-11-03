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
      // Allow payment service to work even without Razorpay credentials (for demo/testing)
      // Just log a warning instead of throwing error
      if (!this.isInitialized) {
        logger.warn('Payment service not fully initialized (missing Razorpay credentials), creating demo order');
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
      // Include userId in orderId for demo mode verification
      const orderId = this.isInitialized 
        ? `order_${Date.now()}_${userId}` 
        : `order_demo_${Date.now()}_${userId}`;

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

      let razorpayOrder;
      
      if (this.isInitialized && this.razorpay) {
        razorpayOrder = await this.razorpay.orders.create(orderOptions);
      } else {
        // Create a demo order object when Razorpay is not initialized
        razorpayOrder = {
          id: `order_demo_${Date.now()}_${userId}`,
          amount: packageInfo.price * 100,
          currency: 'INR',
          receipt: orderId,
          status: 'created'
        };
        logger.info('Created demo payment order (Razorpay not configured)');
      }

      // Store order in database
      try {
        await query(`
          INSERT INTO payments (
            id, user_id, payment_provider, provider_transaction_id,
            amount_currency, amount_tokens, currency_code, 
            status, payment_method, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        `, [
          razorpayOrder.id,
          userId,
          this.isInitialized ? 'razorpay' : 'demo',
          razorpayOrder.id,
          packageInfo.price,
          packageInfo.tokens,
          'INR',
          'pending',
          paymentMethod
        ]);
      } catch (dbError) {
        // If payments table doesn't exist, log error but continue
        logger.error('Failed to store payment in database (table may not exist):', dbError);
        logger.warn('Payment will proceed but transaction won\'t be stored. Please create payments table.');
      }

      return {
        orderId: razorpayOrder.id,
        amount: packageInfo.price,
        currency: 'INR',
        tokens: packageInfo.tokens,
        discount: packageInfo.discount,
        paymentMethod: paymentMethod,
        upiApps: paymentMethod === 'upi' ? this.upiApps : null,
        order: razorpayOrder,
        isDemo: !this.isInitialized
      };
    } catch (error) {
      logger.error('Error creating token purchase order:', error);
      throw error;
    }
  }

  // Verify payment and process token credit
  async verifyPayment(paymentId, orderId, signature, userIdFromRequest = null) {
    try {
      let payment, order, userId, tokenPackage, tokens, orderAmount, orderCurrency;
      
      if (this.isInitialized && this.razorpay) {
        // Real Razorpay verification
        // Verify signature
        const expectedSignature = crypto.HmacSHA256(
          `${orderId}|${paymentId}`,
          process.env.RAZORPAY_KEY_SECRET
        ).toString();

        if (signature !== expectedSignature) {
          throw new Error('Invalid payment signature');
        }

        // Get payment details from Razorpay
        payment = await this.razorpay.payments.fetch(paymentId);
        
        if (payment.status !== 'captured') {
          throw new Error('Payment not captured');
        }

        // Get order details
        order = await this.razorpay.orders.fetch(orderId);
        userId = order.notes.userId;
        tokenPackage = order.notes.tokenPackage;
        tokens = parseInt(order.notes.tokens);
        orderAmount = order.amount / 100;
        orderCurrency = order.currency;
      } else {
        // Demo mode - get order from database or use defaults
        logger.warn('Payment service not initialized, using demo verification');
        
        try {
          const orderResult = await query(`
            SELECT user_id, amount_tokens, amount_currency, currency_code
            FROM payments 
            WHERE provider_transaction_id = $1
          `, [orderId]);
          
          if (orderResult.rows.length > 0) {
            const orderData = orderResult.rows[0];
            userId = orderData.user_id;
            tokens = orderData.amount_tokens;
            orderAmount = parseFloat(orderData.amount_currency);
            orderCurrency = orderData.currency_code || 'INR';
            tokenPackage = 'demo';
          } else {
            // Fallback: try to get from orderId format
            // orderId format: order_demo_TIMESTAMP_USERID
            const match = orderId.match(/order_demo_\d+_(.+)/);
            if (match && match[1]) {
              userId = match[1];
            } else {
              throw new Error('Cannot determine user ID from order');
            }
            
            // Use default package
            const defaultPackage = '1000';
            const pkgInfo = this.tokenPricing[defaultPackage];
            tokens = pkgInfo.tokens;
            orderAmount = pkgInfo.price;
            orderCurrency = 'INR';
            tokenPackage = defaultPackage;
            logger.warn(`Using default package ${defaultPackage} for demo payment`);
          }
        } catch (dbError) {
          logger.warn('Payments table may not exist, using fallback:', dbError);
          // Try multiple methods to get user ID
          if (userIdFromRequest) {
            userId = userIdFromRequest;
          } else {
            // Try to extract user ID from orderId
            const match = orderId.match(/order_demo_\d+_(.+)/);
            if (match && match[1]) {
              userId = match[1];
            } else {
              throw new Error('Cannot determine user ID. Please ensure you are logged in.');
            }
          }
          
          const defaultPackage = '1000';
          const pkgInfo = this.tokenPricing[defaultPackage];
          tokens = pkgInfo.tokens;
          orderAmount = pkgInfo.price;
          orderCurrency = 'INR';
          tokenPackage = defaultPackage;
        }
        
        payment = { status: 'captured', id: paymentId }; // Mock payment
      }

      // Check if payment already processed
      let existingTransaction;
      try {
        existingTransaction = await query(`
          SELECT id, status FROM payments 
          WHERE provider_transaction_id = $1 AND status = 'completed'
        `, [orderId]);
      } catch (dbError) {
        logger.warn('Payments table may not exist, proceeding without duplicate check:', dbError);
        existingTransaction = { rows: [] };
      }

      if (existingTransaction.rows.length > 0) {
        return { success: true, message: 'Payment already processed' };
      }

      // Process payment in database transaction
      await query('BEGIN');

      try {
        // Get current balance before transaction
        const balanceResult = await query(`
          SELECT token_balance FROM wallets WHERE user_id = $1
        `, [userId]);

        if (balanceResult.rows.length === 0) {
          // Create wallet if it doesn't exist
          await query(`
            INSERT INTO wallets (user_id, currency_code, token_balance, created_at, updated_at)
            VALUES ($1, 'INR', 0, NOW(), NOW())
          `, [userId]);
          var balanceBefore = 0;
        } else {
          var balanceBefore = balanceResult.rows[0].token_balance;
        }

        // Update payment transaction status
        try {
          await query(`
            UPDATE payments 
            SET status = 'completed', provider_transaction_id = $1, updated_at = NOW()
            WHERE provider_transaction_id = $2
          `, [paymentId, orderId]);
        } catch (dbError) {
          logger.warn('Failed to update payment status (table may not exist):', dbError);
        }

        // Credit tokens to user's wallet
        const balanceAfter = balanceBefore + tokens;
        await query(`
          UPDATE wallets 
          SET token_balance = $1, updated_at = NOW()
          WHERE user_id = $2
        `, [balanceAfter, userId]);

        // Record transaction in ledger with correct schema
        try {
          await query(`
            INSERT INTO ledger (
              user_id, counterparty_id, transaction_type, amount_tokens,
              amount_currency, balance_before, balance_after,
              reference_id, reference_type, description, created_at
            ) VALUES ($1, $2, 'token_purchase', $3, $4, $5, $6, $7, 'payment', $8, NOW())
          `, [
            userId,
            userId,
            tokens,
            orderAmount,
            balanceBefore,
            balanceAfter,
            paymentId,
            `Token purchase - ${tokenPackage} tokens`
          ]);
        } catch (ledgerError) {
          logger.error('Failed to record ledger entry:', ledgerError);
          // Continue even if ledger fails - wallet was already updated
        }

        await query('COMMIT');

        // Emit real-time balance update via Socket.IO
        try {
          const { io } = require('../server');
          if (io) {
            io.to(`user:${userId}`).emit('wallet_balance_updated', {
              tokenBalance: balanceAfter,
              reservedBalance: 0,
              transaction: {
                type: 'token_purchase',
                tokens: tokens,
                amount: orderAmount,
                currency: orderCurrency
              }
            });
          }
        } catch (socketError) {
          logger.warn('Failed to emit wallet balance update:', socketError);
        }

        logger.info(`Payment verified and tokens credited: ${tokens} tokens to user ${userId}`);

        return {
          success: true,
          tokens: tokens,
          amount: orderAmount,
          currency: orderCurrency,
          balance: balanceAfter,
          isDemo: !this.isInitialized
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

      // Use demo order format if not initialized
      const orderId = this.isInitialized 
        ? `upi_${Date.now()}_${userId}` 
        : `order_demo_${Date.now()}_${userId}`;
      const amount = packageInfo.price;

      // Create UPI deep link
      // For demo mode, use a placeholder UPI ID
      const upiId = process.env.UPI_MERCHANT_ID && process.env.UPI_MERCHANT_NAME
        ? `${process.env.UPI_MERCHANT_ID}@${process.env.UPI_MERCHANT_NAME}`
        : `demo@livepanty`;
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
      try {
        await query(`
          INSERT INTO payments (
            id, user_id, payment_provider, provider_transaction_id,
            amount_currency, amount_tokens, currency_code, 
            status, payment_method, webhook_data, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        `, [
          orderId,
          userId,
          this.isInitialized ? 'razorpay' : 'demo',
          orderId,
          amount,
          packageInfo.tokens,
          'INR',
          'pending',
          'upi',
          JSON.stringify({ upi_app: upiApp })
        ]);
      } catch (dbError) {
        logger.warn('Failed to store UPI payment (table may not exist):', dbError);
        // Continue without storing - payment can still be processed
      }

      return {
        upiLink: upiLink,
        orderId: orderId,
        amount: amount,
        tokens: packageInfo.tokens,
        upiApp: upiApp,
        qrCode: this.generateQRCode(upiLink),
        isDemo: !this.isInitialized
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
      let preferredMethods = [];
      
      // Get user's payment history to suggest methods
      try {
        const historyResult = await query(`
          SELECT payment_method, COUNT(*) as usage_count
          FROM payments 
          WHERE user_id = $1 AND status = 'completed'
          GROUP BY payment_method
          ORDER BY usage_count DESC
        `, [userId]);

        preferredMethods = historyResult.rows.map(row => row.payment_method);
      } catch (dbError) {
        logger.warn('Payments table may not exist, using default methods:', dbError);
      }

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
          id, amount_currency, currency_code, status, payment_method, 
          amount_tokens, created_at, updated_at
        FROM payments 
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
        UPDATE payments 
        SET status = 'refunded', updated_at = NOW()
        WHERE provider_transaction_id = $1
      `, [paymentId]);

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
          SUM(amount_currency) as total_amount,
          AVG(amount_currency) as average_amount,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_transactions,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions,
          COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_transactions
        FROM payments
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
