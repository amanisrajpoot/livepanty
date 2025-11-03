const logger = require('../utils/logger');
const { query } = require('../database/connection');

class PushNotificationService {
  constructor() {
    this.fcmAdmin = null;
    this.apnsProvider = null;
    this.initialize();
  }

  // Initialize FCM and APNs
  async initialize() {
    try {
      // Initialize FCM Admin SDK if credentials available
      if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
        try {
          const admin = require('firebase-admin');
          
          // Check if already initialized
          if (!admin.apps.length) {
            const serviceAccount = {
              projectId: process.env.FIREBASE_PROJECT_ID,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL
            };

            this.fcmAdmin = admin.initializeApp({
              credential: admin.credential.cert(serviceAccount)
            });
            logger.info('Firebase Admin SDK initialized for push notifications');
          } else {
            this.fcmAdmin = admin.app();
          }
        } catch (error) {
          logger.warn('Firebase Admin SDK initialization failed:', error.message);
        }
      }

      // Initialize APNs if credentials available
      if (process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_KEY_PATH) {
        try {
          const apn = require('apn');
          const options = {
            token: {
              key: process.env.APNS_KEY_PATH,
              keyId: process.env.APNS_KEY_ID,
              teamId: process.env.APNS_TEAM_ID
            },
            production: process.env.NODE_ENV === 'production'
          };
          this.apnsProvider = new apn.Provider(options);
          logger.info('APNs provider initialized for push notifications');
        } catch (error) {
          logger.warn('APNs provider initialization failed:', error.message);
        }
      }
    } catch (error) {
      logger.warn('Push notification service initialization failed:', error.message);
    }
  }

  // Send push notification
  async sendPushNotification(userId, notificationData) {
    try {
      // Get user's push tokens
      const user = await this.getUserPushTokens(userId);
      if (!user || !user.push_tokens || user.push_tokens.length === 0) {
        return { sent: false, reason: 'No push tokens available' };
      }

      const results = {
        android: [],
        ios: [],
        errors: []
      };

      // Send to each device
      for (const tokenData of user.push_tokens) {
        try {
          if (tokenData.platform === 'android' && this.fcmAdmin) {
            const result = await this.sendFCMNotification(tokenData.token, notificationData);
            results.android.push({ token: tokenData.token, success: result.success });
          } else if (tokenData.platform === 'ios' && this.apnsProvider) {
            const result = await this.sendAPNSNotification(tokenData.token, notificationData);
            results.ios.push({ token: tokenData.token, success: result.success });
          }
        } catch (error) {
          results.errors.push({ token: tokenData.token, error: error.message });
          logger.error(`Failed to send push to token ${tokenData.token}:`, error);
        }
      }

      // Update notification as push sent
      await query(`
        UPDATE notifications 
        SET push_sent = true 
        WHERE user_id = $1 AND type = $2 AND created_at > NOW() - INTERVAL '1 minute'
      `, [userId, notificationData.type]);

      logger.info(`Push notifications sent to user ${userId}: ${results.android.length + results.ios.length} successful`);

      return {
        sent: true,
        android: results.android.length,
        ios: results.ios.length,
        errors: results.errors.length
      };
    } catch (error) {
      logger.error('Error sending push notification:', error);
      return { sent: false, error: error.message };
    }
  }

  // Send FCM notification
  async sendFCMNotification(token, notificationData) {
    try {
      if (!this.fcmAdmin) {
        return { success: false, error: 'FCM not initialized' };
      }

      const message = {
        notification: {
          title: notificationData.title,
          body: notificationData.message
        },
        data: {
          type: notificationData.type,
          ...notificationData.data
        },
        token: token,
        android: {
          priority: 'high'
        }
      };

      const response = await this.fcmAdmin.messaging().send(message);

      return { success: true, messageId: response };
    } catch (error) {
      logger.error('FCM send error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send APNs notification
  async sendAPNSNotification(token, notificationData) {
    try {
      if (!this.apnsProvider) {
        return { success: false, error: 'APNs not initialized' };
      }

      const notification = new (require('apn').Notification)();
      notification.alert = {
        title: notificationData.title,
        body: notificationData.message
      };
      notification.sound = 'default';
      notification.badge = 1;
      notification.payload = {
        type: notificationData.type,
        ...notificationData.data
      };
      notification.topic = process.env.APNS_BUNDLE_ID || 'com.livepanty.app';

      const response = await this.apnsProvider.send(notification, token);

      if (response.sent.length > 0) {
        return { success: true, sent: response.sent.length };
      } else {
        return { success: false, error: response.failed[0]?.error || 'Unknown error' };
      }
    } catch (error) {
      logger.error('APNs send error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get user push tokens
  async getUserPushTokens(userId) {
    try {
      const result = await query(`
        SELECT id, push_tokens FROM users WHERE id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      // Parse push_tokens JSON if it's a string
      if (user.push_tokens && typeof user.push_tokens === 'string') {
        try {
          user.push_tokens = JSON.parse(user.push_tokens);
        } catch (parseError) {
          user.push_tokens = [];
        }
      }

      return user;
    } catch (error) {
      logger.error('Error getting user push tokens:', error);
      return null;
    }
  }

  // Register push token for user
  async registerPushToken(userId, token, platform) {
    try {
      const user = await this.getUserPushTokens(userId);
      let tokens = user?.push_tokens || [];

      // Remove existing token if present
      tokens = tokens.filter(t => t.token !== token);

      // Add new token
      tokens.push({
        token,
        platform,
        registered_at: new Date().toISOString()
      });

      await query(`
        UPDATE users 
        SET push_tokens = $1, push_tokens_updated_at = NOW()
        WHERE id = $2
      `, [JSON.stringify(tokens), userId]);

      logger.info(`Push token registered for user ${userId} (${platform})`);
      return true;
    } catch (error) {
      logger.error('Error registering push token:', error);
      return false;
    }
  }

  // Unregister push token
  async unregisterPushToken(userId, token) {
    try {
      const user = await this.getUserPushTokens(userId);
      if (!user || !user.push_tokens) {
        return false;
      }

      let tokens = user.push_tokens;
      if (typeof tokens === 'string') {
        tokens = JSON.parse(tokens);
      }

      tokens = tokens.filter(t => t.token !== token);

      await query(`
        UPDATE users 
        SET push_tokens = $1, push_tokens_updated_at = NOW()
        WHERE id = $2
      `, [JSON.stringify(tokens), userId]);

      logger.info(`Push token unregistered for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error unregistering push token:', error);
      return false;
    }
  }
}

module.exports = new PushNotificationService();

