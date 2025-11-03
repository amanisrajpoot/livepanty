const { query } = require('../database/connection');
const logger = require('../utils/logger');
const nodemailer = require('nodemailer');
const pushNotificationService = require('./pushNotificationService');

class NotificationService {
  constructor() {
    this.emailTransporter = null;
    this.initializeEmailTransporter();
  }

  // Initialize email transporter
  initializeEmailTransporter() {
    try {
      this.emailTransporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      logger.info('Email transporter initialized');
    } catch (error) {
      logger.warn('Email transporter not configured:', error.message);
    }
  }

  // Create notification
  async createNotification(userId, type, title, message, data = null) {
    try {
      const result = await query(`
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at, is_read, read_at
      `, [userId, type, title, message, JSON.stringify(data)]);

      const notificationId = result.rows[0].id;

      // Get full notification data for socket emission
      const notification = await this.getNotificationById(notificationId);

      // Emit real-time notification to user
      try {
        const { broadcastToUser } = require('../socket/socketHandlers');
        if (notification) {
          broadcastToUser(userId, 'notification_created', notification);
          logger.info(`Notification event emitted for user ${userId}: ${type}`);
        }
      } catch (socketError) {
        // Don't fail if socket emission fails
        logger.warn('Failed to emit notification event:', socketError);
      }

      // Send push notification
      await this.sendPushNotification(userId, { type, title, message, data });

      // Send email for important notifications
      if (this.shouldSendEmail(type)) {
        await this.sendEmailNotification(userId, type, title, message, data);
      }

      logger.info(`Notification created for user ${userId}: ${type}`);
      return notificationId;
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw new Error('Failed to create notification');
    }
  }

  // Get notification by ID
  async getNotificationById(notificationId) {
    try {
      const result = await query(`
        SELECT 
          id, user_id, type, title, message, data, is_read, read_at, created_at
        FROM notifications
        WHERE id = $1
      `, [notificationId]);

      if (result.rows.length === 0) {
        return null;
      }

      const notification = result.rows[0];
      // Parse JSON data if exists
      if (notification.data) {
        try {
          notification.data = typeof notification.data === 'string' 
            ? JSON.parse(notification.data) 
            : notification.data;
        } catch (parseError) {
          notification.data = null;
        }
      }

      return notification;
    } catch (error) {
      logger.error('Error getting notification by ID:', error);
      return null;
    }
  }

  // Send push notification
  async sendPushNotification(userId, notificationData) {
    try {
      // Use push notification service for FCM/APNs
      const result = await pushNotificationService.sendPushNotification(userId, notificationData);
      
      if (result.sent) {
        logger.info(`Push notification sent to user ${userId}: ${result.android + result.ios} devices`);
      } else {
        logger.info(`Push notification skipped for user ${userId}: ${result.reason || 'No tokens'}`);
      }

      return result;
    } catch (error) {
      logger.error('Error sending push notification:', error);
      // Don't throw - push notifications are optional
      return { sent: false, error: error.message };
    }
  }

  // Send email notification
  async sendEmailNotification(userId, type, title, message, data) {
    try {
      if (!this.emailTransporter) {
        logger.warn('Email transporter not configured');
        return;
      }

      const user = await this.getUserEmail(userId);
      if (!user || !user.email) {
        return;
      }

      const emailContent = this.generateEmailContent(type, title, message, data);
      
      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@livepanty.com',
        to: user.email,
        subject: title,
        html: emailContent
      });

      // Update notification as email sent
      await query(`
        UPDATE notifications 
        SET email_sent = true 
        WHERE user_id = $1 AND type = $2 AND created_at > NOW() - INTERVAL '1 minute'
      `, [userId, type]);

      logger.info(`Email notification sent to user ${userId}: ${title}`);
    } catch (error) {
      logger.error('Error sending email notification:', error);
    }
  }

  // Get user's push token (deprecated - use pushNotificationService)
  async getUserPushToken(userId) {
    try {
      const result = await query(`
        SELECT push_tokens FROM users WHERE id = $1
      `, [userId]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error getting user push token:', error);
      return null;
    }
  }

  // Get user's email
  async getUserEmail(userId) {
    try {
      const result = await query(`
        SELECT email, display_name FROM users WHERE id = $1
      `, [userId]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error getting user email:', error);
      return null;
    }
  }

  // Generate email content
  generateEmailContent(type, title, message, data) {
    const baseTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; }
          .button { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>LivePanty</h1>
          </div>
          <div class="content">
            <h2>${title}</h2>
            <p>${message}</p>
            ${this.getEmailActionButton(type, data)}
          </div>
          <div class="footer">
            <p>This is an automated message from LivePanty. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return baseTemplate;
  }

  // Get email action button based on notification type
  getEmailActionButton(type, data) {
    switch (type) {
      case 'tip_received':
        return '<a href="https://livepanty.com/wallet" class="button">View Wallet</a>';
      case 'stream_started':
        return '<a href="https://livepanty.com/stream/' + (data?.streamId || '') + '" class="button">Watch Stream</a>';
      case 'kyc_approved':
        return '<a href="https://livepanty.com/dashboard" class="button">Go to Dashboard</a>';
      case 'kyc_rejected':
        return '<a href="https://livepanty.com/kyc" class="button">Resubmit Documents</a>';
      default:
        return '<a href="https://livepanty.com/dashboard" class="button">Go to Dashboard</a>';
    }
  }

  // Check if email should be sent for this notification type
  shouldSendEmail(type) {
    const emailTypes = [
      'kyc_approved',
      'kyc_rejected',
      'kyc_status_updated',
      'kyc_requires_review',
      'warning',
      'suspension',
      'ban',
      'tip_received'
    ];
    return emailTypes.includes(type);
  }

  // Send KYC status updated notification
  async sendKYCStatusUpdatedNotification(userId, status, notes = null) {
    let title, message, type;
    
    switch (status) {
      case 'approved':
        title = 'KYC Verification Approved';
        message = 'Your identity verification has been approved. You can now access all platform features.';
        type = 'kyc_approved';
        break;
      case 'rejected':
        title = 'KYC Verification Rejected';
        message = notes 
          ? `Your identity verification was rejected. Reason: ${notes}. Please resubmit your documents.`
          : 'Your identity verification was rejected. Please resubmit your documents.';
        type = 'kyc_rejected';
        break;
      case 'requires_review':
        title = 'KYC Verification Under Review';
        message = 'Your identity verification is being reviewed by our team. You will be notified once the review is complete.';
        type = 'kyc_requires_review';
        break;
      default:
        title = 'KYC Status Updated';
        message = `Your KYC verification status has been updated to: ${status}.`;
        type = 'kyc_status_updated';
    }
    
    return await this.createNotification(
      userId,
      type,
      title,
      message,
      { status, notes }
    );
  }

  // Get user notifications
  async getUserNotifications(userId, limit = 50, offset = 0) {
    try {
      const result = await query(`
        SELECT 
          id, type, title, message, data, is_read, read_at, created_at
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);

      return result.rows;
    } catch (error) {
      logger.error('Error getting user notifications:', error);
      throw new Error('Failed to get notifications');
    }
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    try {
      await query(`
        UPDATE notifications 
        SET is_read = true, read_at = NOW()
        WHERE id = $1 AND user_id = $2
      `, [notificationId, userId]);

      logger.info(`Notification ${notificationId} marked as read by user ${userId}`);
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw new Error('Failed to mark notification as read');
    }
  }

  // Mark all notifications as read for user
  async markAllAsRead(userId) {
    try {
      await query(`
        UPDATE notifications 
        SET is_read = true, read_at = NOW()
        WHERE user_id = $1 AND is_read = false
      `, [userId]);

      logger.info(`All notifications marked as read for user ${userId}`);
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw new Error('Failed to mark all notifications as read');
    }
  }

  // Get unread notifications
  async getUnreadNotifications(userId, limit = 50, offset = 0) {
    try {
      const result = await query(`
        SELECT 
          id, type, title, message, data, is_read, read_at, created_at
        FROM notifications
        WHERE user_id = $1 AND is_read = false
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);

      return result.rows;
    } catch (error) {
      logger.error('Error getting unread notifications:', error);
      throw new Error('Failed to get unread notifications');
    }
  }

  // Get unread notification count
  async getUnreadCount(userId) {
    try {
      const result = await query(`
        SELECT COUNT(*) as count
        FROM notifications
        WHERE user_id = $1 AND is_read = false
      `, [userId]);

      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Error getting unread count:', error);
      throw new Error('Failed to get unread count');
    }
  }

  // Send tip received notification
  async sendTipReceivedNotification(recipientId, senderName, amount, message) {
    const title = `You received ${amount} tokens!`;
    const notificationMessage = `${senderName} sent you ${amount} tokens${message ? ` with message: "${message}"` : ''}`;
    
    return await this.createNotification(
      recipientId,
      'tip_received',
      title,
      notificationMessage,
      { amount, senderName, message }
    );
  }

  // Send stream started notification
  async sendStreamStartedNotification(userId, streamTitle, streamId) {
    const title = 'Stream Started';
    const message = `Your stream "${streamTitle}" is now live!`;
    
    return await this.createNotification(
      userId,
      'stream_started',
      title,
      message,
      { streamId, streamTitle }
    );
  }

  // Send KYC approved notification
  async sendKYCApprovedNotification(userId) {
    const title = 'KYC Verification Approved';
    const message = 'Your identity verification has been approved. You can now access all platform features.';
    
    return await this.createNotification(
      userId,
      'kyc_approved',
      title,
      message
    );
  }

  // Send KYC rejected notification
  async sendKYCRejectedNotification(userId, reason) {
    const title = 'KYC Verification Rejected';
    const message = `Your identity verification was rejected. Reason: ${reason}. Please resubmit your documents.`;
    
    return await this.createNotification(
      userId,
      'kyc_rejected',
      title,
      message,
      { reason }
    );
  }

  // Send warning notification
  async sendWarningNotification(userId, reason) {
    const title = 'Content Warning';
    const message = `You have received a warning for: ${reason}`;
    
    return await this.createNotification(
      userId,
      'warning',
      title,
      message,
      { reason }
    );
  }

  // Send suspension notification
  async sendSuspensionNotification(userId, reason, duration) {
    const title = 'Account Suspended';
    const message = `Your account has been suspended for ${duration} days. Reason: ${reason}`;
    
    return await this.createNotification(
      userId,
      'suspension',
      title,
      message,
      { reason, duration }
    );
  }

  // Send ban notification
  async sendBanNotification(userId, reason) {
    const title = 'Account Banned';
    const message = `Your account has been permanently banned. Reason: ${reason}`;
    
    return await this.createNotification(
      userId,
      'ban',
      title,
      message,
      { reason }
    );
  }

  // Delete notification
  async deleteNotification(notificationId, userId) {
    try {
      const result = await query(`
        DELETE FROM notifications 
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `, [notificationId, userId]);

      if (result.rows.length === 0) {
        throw new Error('Notification not found or unauthorized');
      }

      logger.info(`Notification ${notificationId} deleted by user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting notification:', error);
      throw new Error('Failed to delete notification');
    }
  }

  // Clean up old notifications
  async cleanupOldNotifications(daysOld = 30) {
    try {
      const result = await query(`
        DELETE FROM notifications 
        WHERE created_at < NOW() - INTERVAL '${daysOld} days'
      `);

      logger.info(`Cleaned up ${result.rowCount} old notifications`);
      return result.rowCount;
    } catch (error) {
      logger.error('Error cleaning up old notifications:', error);
      throw new Error('Failed to cleanup old notifications');
    }
  }
}

module.exports = new NotificationService();
