const { query } = require('../database/connection');
const logger = require('../utils/logger');

class ModerationService {
  constructor() {
    this.contentFilters = {
      // Basic text filters
      profanity: [
        'spam', 'scam', 'fake', 'bot', 'hack', 'cheat', 'illegal', 'drugs',
        'violence', 'hate', 'racist', 'sexist', 'harassment'
      ],
      
      // Adult content keywords
      adultContent: [
        'explicit', 'nsfw', 'adult', 'mature', 'sexual', 'pornographic'
      ],
      
      // Spam patterns
      spamPatterns: [
        /(.)\1{4,}/, // Repeated characters
        /https?:\/\/[^\s]+/g, // URLs
        /[A-Z]{5,}/, // Excessive caps
        /\d{10,}/ // Long numbers (phone numbers)
      ]
    };
  }

  // Analyze text content for violations
  async analyzeTextContent(text, contentType = 'message') {
    try {
      const violations = [];
      const lowerText = text.toLowerCase();

      // Check for profanity
      for (const word of this.contentFilters.profanity) {
        if (lowerText.includes(word.toLowerCase())) {
          violations.push({
            type: 'profanity',
            severity: 'medium',
            word: word,
            message: `Contains inappropriate language: ${word}`
          });
        }
      }

      // Check for adult content
      for (const word of this.contentFilters.adultContent) {
        if (lowerText.includes(word.toLowerCase())) {
          violations.push({
            type: 'adult_content',
            severity: 'high',
            word: word,
            message: `Contains adult content: ${word}`
          });
        }
      }

      // Check for spam patterns
      for (const pattern of this.contentFilters.spamPatterns) {
        if (pattern.test(text)) {
          violations.push({
            type: 'spam',
            severity: 'low',
            pattern: pattern.toString(),
            message: 'Content matches spam pattern'
          });
        }
      }

      // Calculate risk score
      const riskScore = this.calculateRiskScore(violations);
      
      return {
        violations,
        riskScore,
        isFlagged: riskScore > 0.5,
        contentType,
        analyzedAt: new Date()
      };
    } catch (error) {
      logger.error('Error analyzing text content:', error);
      throw new Error('Failed to analyze content');
    }
  }

  // Calculate risk score based on violations
  calculateRiskScore(violations) {
    let score = 0;
    
    violations.forEach(violation => {
      switch (violation.severity) {
        case 'low':
          score += 0.1;
          break;
        case 'medium':
          score += 0.3;
          break;
        case 'high':
          score += 0.6;
          break;
        case 'critical':
          score += 1.0;
          break;
      }
    });

    return Math.min(score, 1.0); // Cap at 1.0
  }

  // Create content report
  async createContentReport(reportData) {
    try {
      const {
        reporterId,
        reportedUserId,
        contentType,
        contentId,
        reason,
        description,
        evidence
      } = reportData;

      const result = await query(`
        INSERT INTO content_reports (
          reporter_id, reported_user_id, content_type, content_id,
          reason, description, evidence, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
        RETURNING id
      `, [reporterId, reportedUserId, contentType, contentId, reason, description, evidence]);

      const reportId = result.rows[0].id;

      // Trigger automated analysis
      await this.triggerAutomatedAnalysis(reportId, reportData);

      logger.info(`Content report created: ${reportId}`);
      return reportId;
    } catch (error) {
      logger.error('Error creating content report:', error);
      throw new Error('Failed to create content report');
    }
  }

  // Trigger automated analysis
  async triggerAutomatedAnalysis(reportId, reportData) {
    try {
      // Analyze the reported content
      let analysis = null;
      
      if (reportData.contentType === 'message' && reportData.content) {
        analysis = await this.analyzeTextContent(reportData.content, 'message');
      }

      // Update report with analysis
      if (analysis) {
        await query(`
          UPDATE content_reports 
          SET automated_analysis = $1, risk_score = $2, status = $3
          WHERE id = $4
        `, [
          JSON.stringify(analysis),
          analysis.riskScore,
          analysis.isFlagged ? 'flagged' : 'pending'
        ]);

        // If high risk, escalate immediately
        if (analysis.riskScore > 0.8) {
          await this.escalateReport(reportId, 'High risk content detected by automated analysis');
        }
      }
    } catch (error) {
      logger.error('Error in automated analysis:', error);
    }
  }

  // Escalate report
  async escalateReport(reportId, reason) {
    try {
      await query(`
        UPDATE content_reports 
        SET status = 'escalated', escalated_at = NOW(), escalation_reason = $1
        WHERE id = $2
      `, [reason, reportId]);

      logger.info(`Report ${reportId} escalated: ${reason}`);
    } catch (error) {
      logger.error('Error escalating report:', error);
      throw new Error('Failed to escalate report');
    }
  }

  // Get pending reports for moderation
  async getPendingReports(limit = 50, offset = 0) {
    try {
      const result = await query(`
        SELECT 
          cr.*,
          u1.display_name as reporter_name,
          u1.email as reporter_email,
          u2.display_name as reported_user_name,
          u2.email as reported_user_email
        FROM content_reports cr
        JOIN users u1 ON cr.reporter_id = u1.id
        JOIN users u2 ON cr.reported_user_id = u2.id
        WHERE cr.status IN ('pending', 'flagged', 'escalated')
        ORDER BY 
          CASE WHEN cr.status = 'escalated' THEN 1 ELSE 2 END,
          cr.created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      return result.rows;
    } catch (error) {
      logger.error('Error getting pending reports:', error);
      throw new Error('Failed to get pending reports');
    }
  }

  // Update report status
  async updateReportStatus(reportId, status, moderatorId, action, notes = null) {
    try {
      const validStatuses = ['pending', 'flagged', 'escalated', 'approved', 'rejected', 'resolved'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid status');
      }

      await query(`
        UPDATE content_reports 
        SET status = $1, moderator_id = $2, action_taken = $3, 
            moderator_notes = $4, reviewed_at = NOW()
        WHERE id = $5
      `, [status, moderatorId, action, notes, reportId]);

      // If content is approved, take action on the reported user/content
      if (status === 'approved') {
        await this.takeModerationAction(reportId, action);
      }

      logger.info(`Report ${reportId} status updated to ${status} by moderator ${moderatorId}`);
    } catch (error) {
      logger.error('Error updating report status:', error);
      throw new Error('Failed to update report status');
    }
  }

  // Take moderation action
  async takeModerationAction(reportId, action) {
    try {
      const report = await this.getReportById(reportId);
      
      switch (action) {
        case 'warn_user':
          await this.warnUser(report.reported_user_id, 'Content violation warning');
          break;
        case 'suspend_user':
          await this.suspendUser(report.reported_user_id, 'Content violation suspension');
          break;
        case 'ban_user':
          await this.banUser(report.reported_user_id, 'Content violation ban');
          break;
        case 'delete_content':
          await this.deleteContent(report.content_type, report.content_id);
          break;
        case 'hide_content':
          await this.hideContent(report.content_type, report.content_id);
          break;
      }
    } catch (error) {
      logger.error('Error taking moderation action:', error);
      throw new Error('Failed to take moderation action');
    }
  }

  // Warn user
  async warnUser(userId, reason) {
    try {
      await query(`
        INSERT INTO user_warnings (user_id, reason, created_at)
        VALUES ($1, $2, NOW())
      `, [userId, reason]);

      // Update user warning count
      await query(`
        UPDATE users 
        SET warning_count = warning_count + 1
        WHERE id = $1
      `, [userId]);

      logger.info(`User ${userId} warned: ${reason}`);
    } catch (error) {
      logger.error('Error warning user:', error);
      throw new Error('Failed to warn user');
    }
  }

  // Suspend user
  async suspendUser(userId, reason, duration = 7) {
    try {
      const suspendedUntil = new Date();
      suspendedUntil.setDate(suspendedUntil.getDate() + duration);

      await query(`
        UPDATE users 
        SET status = 'suspended', suspended_until = $1, suspension_reason = $2
        WHERE id = $3
      `, [suspendedUntil, reason, userId]);

      logger.info(`User ${userId} suspended until ${suspendedUntil}: ${reason}`);
    } catch (error) {
      logger.error('Error suspending user:', error);
      throw new Error('Failed to suspend user');
    }
  }

  // Ban user
  async banUser(userId, reason) {
    try {
      await query(`
        UPDATE users 
        SET status = 'banned', banned_at = NOW(), ban_reason = $1
        WHERE id = $2
      `, [reason, userId]);

      logger.info(`User ${userId} banned: ${reason}`);
    } catch (error) {
      logger.error('Error banning user:', error);
      throw new Error('Failed to ban user');
    }
  }

  // Delete content
  async deleteContent(contentType, contentId) {
    try {
      switch (contentType) {
        case 'message':
          await query('UPDATE chat_messages SET deleted_at = NOW() WHERE id = $1', [contentId]);
          break;
        case 'stream':
          await query('UPDATE streams SET deleted_at = NOW() WHERE id = $1', [contentId]);
          break;
        case 'profile':
          // Handle profile content deletion
          break;
      }

      logger.info(`Content deleted: ${contentType} ${contentId}`);
    } catch (error) {
      logger.error('Error deleting content:', error);
      throw new Error('Failed to delete content');
    }
  }

  // Hide content
  async hideContent(contentType, contentId) {
    try {
      switch (contentType) {
        case 'message':
          await query('UPDATE chat_messages SET is_hidden = true WHERE id = $1', [contentId]);
          break;
        case 'stream':
          await query('UPDATE streams SET is_hidden = true WHERE id = $1', [contentId]);
          break;
      }

      logger.info(`Content hidden: ${contentType} ${contentId}`);
    } catch (error) {
      logger.error('Error hiding content:', error);
      throw new Error('Failed to hide content');
    }
  }

  // Get report by ID
  async getReportById(reportId) {
    try {
      const result = await query(`
        SELECT 
          cr.*,
          u1.display_name as reporter_name,
          u1.email as reporter_email,
          u2.display_name as reported_user_name,
          u2.email as reported_user_email
        FROM content_reports cr
        JOIN users u1 ON cr.reporter_id = u1.id
        JOIN users u2 ON cr.reported_user_id = u2.id
        WHERE cr.id = $1
      `, [reportId]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting report by ID:', error);
      throw new Error('Failed to get report');
    }
  }

  // Get moderation statistics
  async getModerationStats() {
    try {
      const result = await query(`
        SELECT 
          status,
          COUNT(*) as count
        FROM content_reports
        GROUP BY status
      `);

      const stats = {
        total: 0,
        pending: 0,
        flagged: 0,
        escalated: 0,
        approved: 0,
        rejected: 0,
        resolved: 0
      };

      result.rows.forEach(row => {
        stats[row.status] = parseInt(row.count);
        stats.total += parseInt(row.count);
      });

      return stats;
    } catch (error) {
      logger.error('Error getting moderation stats:', error);
      throw new Error('Failed to get moderation statistics');
    }
  }

  // Get user moderation history
  async getUserModerationHistory(userId) {
    try {
      const result = await query(`
        SELECT 
          cr.*,
          u.display_name as reporter_name
        FROM content_reports cr
        JOIN users u ON cr.reporter_id = u.id
        WHERE cr.reported_user_id = $1
        ORDER BY cr.created_at DESC
      `, [userId]);

      return result.rows;
    } catch (error) {
      logger.error('Error getting user moderation history:', error);
      throw new Error('Failed to get moderation history');
    }
  }
}

module.exports = new ModerationService();
