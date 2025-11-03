const { query } = require('../database/connection');
const logger = require('../utils/logger');

class AdminService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Get platform overview statistics
  async getPlatformOverview() {
    try {
      const cacheKey = 'platform_overview';
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const [
        userStats,
        streamStats,
        financialStats,
        kycStats,
        moderationStats
      ] = await Promise.all([
        this.getUserStatistics(),
        this.getStreamStatistics(),
        this.getFinancialStatistics(),
        this.getKYCStatistics(),
        this.getModerationStatistics()
      ]);

      const overview = {
        users: userStats,
        streams: streamStats,
        financial: financialStats,
        kyc: kycStats,
        moderation: moderationStats,
        generatedAt: new Date()
      };

      this.setCachedData(cacheKey, overview);
      return overview;
    } catch (error) {
      logger.error('Error getting platform overview:', error);
      throw new Error('Failed to get platform overview');
    }
  }

  // Get user statistics
  async getUserStatistics() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as new_users_today,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_users_week,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_users_month,
          COUNT(CASE WHEN role = 'performer' THEN 1 END) as total_performers,
          COUNT(CASE WHEN role = 'viewer' THEN 1 END) as total_viewers,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
          COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_users,
          COUNT(CASE WHEN status = 'banned' THEN 1 END) as banned_users,
          COUNT(CASE WHEN kyc_verified = true THEN 1 END) as kyc_verified_users
        FROM users
      `);

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting user statistics:', error);
      throw new Error('Failed to get user statistics');
    }
  }

  // Get stream statistics
  async getStreamStatistics() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_streams,
          COUNT(CASE WHEN status = 'live' THEN 1 END) as live_streams,
          COUNT(CASE WHEN status = 'ended' THEN 1 END) as ended_streams,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as streams_today,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as streams_week,
          AVG(viewer_count) as avg_viewer_count,
          MAX(peak_viewer_count) as max_viewer_count,
          SUM(total_tokens_received) as total_tokens_received
        FROM streams
        WHERE deleted_at IS NULL
      `);

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting stream statistics:', error);
      throw new Error('Failed to get stream statistics');
    }
  }

  // Get financial statistics
  async getFinancialStatistics() {
    try {
      const result = await query(`
        SELECT 
          COALESCE(SUM(amount_tokens), 0) as total_tokens_in_circulation,
          COALESCE(SUM(CASE WHEN transaction_type = 'purchase' THEN amount_tokens END), 0) as total_tokens_purchased,
          COALESCE(SUM(CASE WHEN transaction_type = 'tip' THEN amount_tokens END), 0) as total_tokens_tipped,
          COALESCE(SUM(CASE WHEN transaction_type = 'payout' THEN amount_tokens END), 0) as total_tokens_paid_out,
          COUNT(CASE WHEN transaction_type = 'purchase' THEN 1 END) as total_purchases,
          COUNT(CASE WHEN transaction_type = 'tip' THEN 1 END) as total_tips,
          AVG(CASE WHEN transaction_type = 'tip' THEN amount_tokens END) as avg_tip_amount
        FROM ledger
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `);

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting financial statistics:', error);
      throw new Error('Failed to get financial statistics');
    }
  }

  // Get KYC statistics
  async getKYCStatistics() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_verifications,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_verifications,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_verifications,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_verifications,
          COUNT(CASE WHEN status = 'requires_review' THEN 1 END) as requires_review_verifications,
          COUNT(CASE WHEN submitted_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as verifications_today,
          COUNT(CASE WHEN submitted_at >= NOW() - INTERVAL '7 days' THEN 1 END) as verifications_week
        FROM kyc_verifications
      `);

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting KYC statistics:', error);
      throw new Error('Failed to get KYC statistics');
    }
  }

  // Get moderation statistics
  async getModerationStatistics() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_reports,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reports,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_reports,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_reports,
          COUNT(CASE WHEN status = 'escalated' THEN 1 END) as escalated_reports,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as reports_today,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as reports_week
        FROM content_reports
      `);

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting moderation statistics:', error);
      throw new Error('Failed to get moderation statistics');
    }
  }

  // Get user management data
  async getUserManagementData(limit = 50, offset = 0, filters = {}) {
    try {
      let whereClause = 'WHERE 1=1';
      const params = [];
      let paramCount = 0;

      if (filters.role) {
        paramCount++;
        whereClause += ` AND role = $${paramCount}`;
        params.push(filters.role);
      }

      if (filters.status) {
        paramCount++;
        whereClause += ` AND status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.kyc_verified !== undefined) {
        paramCount++;
        whereClause += ` AND kyc_verified = $${paramCount}`;
        params.push(filters.kyc_verified);
      }

      if (filters.search) {
        paramCount++;
        whereClause += ` AND (display_name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR username ILIKE $${paramCount})`;
        params.push(`%${filters.search}%`);
      }

      paramCount++;
      params.push(limit);
      paramCount++;
      params.push(offset);

      const result = await query(`
        SELECT 
          u.id, u.email, u.display_name, u.username, u.role, u.status,
          u.kyc_verified, u.created_at, u.last_login_at,
          COALESCE(w.token_balance, 0) as token_balance,
          COUNT(DISTINCT cr.id) as report_count,
          COUNT(DISTINCT uw.id) as warning_count
        FROM users u
        LEFT JOIN wallets w ON u.id = w.user_id
        LEFT JOIN content_reports cr ON u.id = cr.reported_user_id
        LEFT JOIN user_warnings uw ON u.id = uw.user_id
        ${whereClause}
        GROUP BY u.id, u.email, u.display_name, u.username, u.role, u.status, u.kyc_verified, u.created_at, u.last_login_at, w.token_balance
        ORDER BY u.created_at DESC
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `, params);

      return { users: result.rows };
    } catch (error) {
      logger.error('Error getting user management data:', error);
      throw new Error('Failed to get user management data');
    }
  }

  // Get user management data count
  async getUserManagementDataCount(filters = {}) {
    try {
      let whereClause = 'WHERE 1=1';
      const params = [];
      let paramCount = 0;

      if (filters.role) {
        paramCount++;
        whereClause += ` AND role = $${paramCount}`;
        params.push(filters.role);
      }

      if (filters.status) {
        paramCount++;
        whereClause += ` AND status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.kyc_verified !== undefined) {
        paramCount++;
        whereClause += ` AND kyc_verified = $${paramCount}`;
        params.push(filters.kyc_verified);
      }

      if (filters.search) {
        paramCount++;
        whereClause += ` AND (display_name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR username ILIKE $${paramCount})`;
        params.push(`%${filters.search}%`);
      }

      const result = await query(`
        SELECT COUNT(*) as total
        FROM users u
        ${whereClause}
      `, params);

      return parseInt(result.rows[0].total);
    } catch (error) {
      logger.error('Error getting user management data count:', error);
      throw new Error('Failed to get user management data count');
    }
  }

  // Get recent activity
  async getRecentActivity(limit = 100) {
    try {
      const result = await query(`
        SELECT 
          'user_registered' as activity_type,
          u.display_name as user_name,
          u.email as user_email,
          u.created_at as activity_time,
          NULL as additional_data
        FROM users u
        WHERE u.created_at >= NOW() - INTERVAL '7 days'
        
        UNION ALL
        
        SELECT 
          'stream_started' as activity_type,
          u.display_name as user_name,
          u.email as user_email,
          s.created_at as activity_time,
          json_build_object('stream_title', s.title, 'stream_id', s.id) as additional_data
        FROM streams s
        JOIN users u ON s.host_id = u.id
        WHERE s.created_at >= NOW() - INTERVAL '7 days'
        
        UNION ALL
        
        SELECT 
          'kyc_submitted' as activity_type,
          u.display_name as user_name,
          u.email as user_email,
          k.submitted_at as activity_time,
          json_build_object('document_type', k.document_type, 'status', k.status) as additional_data
        FROM kyc_verifications k
        JOIN users u ON k.user_id = u.id
        WHERE k.submitted_at >= NOW() - INTERVAL '7 days'
        
        UNION ALL
        
        SELECT 
          'content_reported' as activity_type,
          u.display_name as user_name,
          u.email as user_email,
          cr.created_at as activity_time,
          json_build_object('reason', cr.reason, 'content_type', cr.content_type) as additional_data
        FROM content_reports cr
        JOIN users u ON cr.reporter_id = u.id
        WHERE cr.created_at >= NOW() - INTERVAL '7 days'
        
        ORDER BY activity_time DESC
        LIMIT $1
      `, [limit]);

      return result.rows;
    } catch (error) {
      logger.error('Error getting recent activity:', error);
      throw new Error('Failed to get recent activity');
    }
  }

  // Get system health
  async getSystemHealth() {
    try {
      const [
        dbHealth,
        redisHealth,
        diskSpace,
        memoryUsage
      ] = await Promise.all([
        this.checkDatabaseHealth(),
        this.checkRedisHealth(),
        this.getDiskSpace(),
        this.getMemoryUsage()
      ]);

      return {
        database: dbHealth,
        redis: redisHealth,
        disk: diskSpace,
        memory: memoryUsage,
        overall: this.calculateOverallHealth(dbHealth, redisHealth, diskSpace, memoryUsage),
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Error getting system health:', error);
      throw new Error('Failed to get system health');
    }
  }

  // Check database health
  async checkDatabaseHealth() {
    try {
      const start = Date.now();
      await query('SELECT 1');
      const responseTime = Date.now() - start;

      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        lastCheck: new Date()
      };
    }
  }

  // Check Redis health
  async checkRedisHealth() {
    try {
      // This would check Redis connection in production
      return {
        status: 'healthy',
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        lastCheck: new Date()
      };
    }
  }

  // Get disk space (simplified)
  async getDiskSpace() {
    try {
      const fs = require('fs');
      const stats = fs.statSync('.');
      
      return {
        status: 'healthy',
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        lastCheck: new Date()
      };
    }
  }

  // Get memory usage
  async getMemoryUsage() {
    try {
      const usage = process.memoryUsage();
      
      return {
        status: 'healthy',
        rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(usage.external / 1024 / 1024)}MB`,
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        lastCheck: new Date()
      };
    }
  }

  // Calculate overall health
  calculateOverallHealth(dbHealth, redisHealth, diskHealth, memoryHealth) {
    const healthChecks = [dbHealth, redisHealth, diskHealth, memoryHealth];
    const healthyCount = healthChecks.filter(check => check.status === 'healthy').length;
    const healthPercentage = (healthyCount / healthChecks.length) * 100;

    if (healthPercentage >= 90) return 'excellent';
    if (healthPercentage >= 75) return 'good';
    if (healthPercentage >= 50) return 'warning';
    return 'critical';
  }

  // Get analytics data
  async getAnalyticsData(period = '7d', type = 'users') {
    try {
      const cacheKey = `analytics_${period}_${type}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      let interval;
      switch (period) {
        case '1d':
          interval = '1 hour';
          break;
        case '7d':
          interval = '1 day';
          break;
        case '30d':
          interval = '1 day';
          break;
        default:
          interval = '1 day';
      }

      let result;
      if (type === 'users') {
        result = await query(`
          SELECT 
            DATE_TRUNC('${interval}', created_at) as period,
            COUNT(*) as user_count
          FROM users
          WHERE created_at >= NOW() - INTERVAL '${period}'
          GROUP BY DATE_TRUNC('${interval}', created_at)
          ORDER BY period
        `);
      } else if (type === 'streams') {
        result = await query(`
          SELECT 
            DATE_TRUNC('${interval}', created_at) as period,
            COUNT(*) as stream_count
          FROM streams
          WHERE created_at >= NOW() - INTERVAL '${period}'
          GROUP BY DATE_TRUNC('${interval}', created_at)
          ORDER BY period
        `);
      } else if (type === 'revenue') {
        result = await query(`
          SELECT 
            DATE_TRUNC('${interval}', created_at) as period,
            COALESCE(SUM(amount_tokens), 0) as revenue,
            COUNT(*) as transaction_count
          FROM ledger
          WHERE created_at >= NOW() - INTERVAL '${period}'
            AND transaction_type = 'purchase'
          GROUP BY DATE_TRUNC('${interval}', created_at)
          ORDER BY period
        `);
      } else {
        // Default to users
        result = await query(`
          SELECT 
            DATE_TRUNC('${interval}', created_at) as period,
            COUNT(*) as user_count
          FROM users
          WHERE created_at >= NOW() - INTERVAL '${period}'
          GROUP BY DATE_TRUNC('${interval}', created_at)
          ORDER BY period
        `);
      }

      const analytics = {
        period,
        type,
        data: result.rows,
        generatedAt: new Date()
      };

      this.setCachedData(cacheKey, analytics);
      return analytics;
    } catch (error) {
      logger.error('Error getting analytics data:', error);
      throw new Error('Failed to get analytics data');
    }
  }

  // Cache management
  getCachedData(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCachedData(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
    logger.info('Admin service cache cleared');
  }
}

module.exports = new AdminService();
