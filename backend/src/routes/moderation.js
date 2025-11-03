const express = require('express');
const router = express.Router();
const moderationService = require('../services/moderationService');
const { validateJWT, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Report content
router.post('/report', validateJWT, asyncHandler(async (req, res) => {
  try {
    const {
      reportedUserId,
      contentType,
      contentId,
      reason,
      description,
      evidence
    } = req.body;

    if (!reportedUserId || !contentType || !reason) {
      return res.status(400).json({
        error: 'MISSING_DATA',
        message: 'Reported user ID, content type, and reason are required'
      });
    }

    const reportData = {
      reporterId: req.user.id,
      reportedUserId,
      contentType,
      contentId,
      reason,
      description,
      evidence
    };

    const reportId = await moderationService.createContentReport(reportData);

    logger.info(`Content report created by user ${req.user.id}: ${reportId}`);

    res.json({
      success: true,
      reportId,
      message: 'Content reported successfully'
    });
  } catch (error) {
    logger.error('Create report error:', error);
    res.status(500).json({
      error: 'REPORT_FAILED',
      message: 'Failed to create report'
    });
  }
}));

// Analyze text content
router.post('/analyze', validateJWT, asyncHandler(async (req, res) => {
  try {
    const { text, contentType = 'message' } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'MISSING_DATA',
        message: 'Text content is required'
      });
    }

    const analysis = await moderationService.analyzeTextContent(text, contentType);

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    logger.error('Content analysis error:', error);
    res.status(500).json({
      error: 'ANALYSIS_FAILED',
      message: 'Failed to analyze content'
    });
  }
}));

// Get user's moderation history
router.get('/history', validateJWT, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const history = await moderationService.getUserModerationHistory(userId);

    res.json({
      success: true,
      history
    });
  } catch (error) {
    logger.error('Get moderation history error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get moderation history'
    });
  }
}));

// Admin: Get pending reports
router.get('/admin/reports', validateJWT, requireRole(['admin', 'moderator']), asyncHandler(async (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;
    const reports = await moderationService.getPendingReports(parseInt(limit), parseInt(offset), status || null);

    res.json({
      success: true,
      reports
    });
  } catch (error) {
    logger.error('Get pending reports error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get pending reports'
    });
  }
}));

// Admin: Get report by ID
router.get('/admin/reports/:id', validateJWT, requireRole(['admin', 'moderator']), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const report = await moderationService.getReportById(id);

    if (!report) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Report not found'
      });
    }

    res.json({
      success: true,
      report
    });
  } catch (error) {
    logger.error('Get report by ID error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get report'
    });
  }
}));

// Admin: Update report status
router.patch('/admin/reports/:id/status', validateJWT, requireRole(['admin', 'moderator']), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { status, action, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        error: 'MISSING_DATA',
        message: 'Status is required'
      });
    }

    await moderationService.updateReportStatus(id, status, req.user.id, action, notes);

    logger.info(`Moderator ${req.user.id} updated report ${id} status to ${status}`);

    res.json({
      success: true,
      message: 'Report status updated successfully'
    });
  } catch (error) {
    logger.error('Update report status error:', error);
    res.status(500).json({
      error: 'UPDATE_FAILED',
      message: 'Failed to update report status'
    });
  }
}));

// Admin: Escalate report
router.post('/admin/reports/:id/escalate', validateJWT, requireRole(['admin', 'moderator']), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await moderationService.escalateReport(id, reason);

    logger.info(`Moderator ${req.user.id} escalated report ${id}: ${reason}`);

    res.json({
      success: true,
      message: 'Report escalated successfully'
    });
  } catch (error) {
    logger.error('Escalate report error:', error);
    res.status(500).json({
      error: 'ESCALATE_FAILED',
      message: 'Failed to escalate report'
    });
  }
}));

// Admin: Get moderation statistics
router.get('/admin/stats', validateJWT, requireRole(['admin', 'moderator']), asyncHandler(async (req, res) => {
  try {
    const stats = await moderationService.getModerationStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Get moderation stats error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get moderation statistics'
    });
  }
}));

// Admin: Warn user
router.post('/admin/users/:id/warn', validateJWT, requireRole(['admin', 'moderator']), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        error: 'MISSING_DATA',
        message: 'Warning reason is required'
      });
    }

    await moderationService.warnUser(id, reason);

    logger.info(`Moderator ${req.user.id} warned user ${id}: ${reason}`);

    res.json({
      success: true,
      message: 'User warned successfully'
    });
  } catch (error) {
    logger.error('Warn user error:', error);
    res.status(500).json({
      error: 'WARN_FAILED',
      message: 'Failed to warn user'
    });
  }
}));

// Admin: Suspend user
router.post('/admin/users/:id/suspend', validateJWT, requireRole(['admin', 'moderator']), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, duration = 7 } = req.body;

    if (!reason) {
      return res.status(400).json({
        error: 'MISSING_DATA',
        message: 'Suspension reason is required'
      });
    }

    await moderationService.suspendUser(id, reason, duration);

    logger.info(`Moderator ${req.user.id} suspended user ${id} for ${duration} days: ${reason}`);

    res.json({
      success: true,
      message: `User suspended for ${duration} days`
    });
  } catch (error) {
    logger.error('Suspend user error:', error);
    res.status(500).json({
      error: 'SUSPEND_FAILED',
      message: 'Failed to suspend user'
    });
  }
}));

// Admin: Ban user
router.post('/admin/users/:id/ban', validateJWT, requireRole(['admin']), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        error: 'MISSING_DATA',
        message: 'Ban reason is required'
      });
    }

    await moderationService.banUser(id, reason);

    logger.info(`Admin ${req.user.id} banned user ${id}: ${reason}`);

    res.json({
      success: true,
      message: 'User banned successfully'
    });
  } catch (error) {
    logger.error('Ban user error:', error);
    res.status(500).json({
      error: 'BAN_FAILED',
      message: 'Failed to ban user'
    });
  }
}));

// Admin: Delete content
router.delete('/admin/content/:type/:id', validateJWT, requireRole(['admin', 'moderator']), asyncHandler(async (req, res) => {
  try {
    const { type, id } = req.params;

    await moderationService.deleteContent(type, id);

    logger.info(`Moderator ${req.user.id} deleted content: ${type} ${id}`);

    res.json({
      success: true,
      message: 'Content deleted successfully'
    });
  } catch (error) {
    logger.error('Delete content error:', error);
    res.status(500).json({
      error: 'DELETE_FAILED',
      message: 'Failed to delete content'
    });
  }
}));

// Admin: Hide content
router.patch('/admin/content/:type/:id/hide', validateJWT, requireRole(['admin', 'moderator']), asyncHandler(async (req, res) => {
  try {
    const { type, id } = req.params;

    await moderationService.hideContent(type, id);

    logger.info(`Moderator ${req.user.id} hid content: ${type} ${id}`);

    res.json({
      success: true,
      message: 'Content hidden successfully'
    });
  } catch (error) {
    logger.error('Hide content error:', error);
    res.status(500).json({
      error: 'HIDE_FAILED',
      message: 'Failed to hide content'
    });
  }
}));

module.exports = router;