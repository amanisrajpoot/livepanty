const express = require('express');
const multer = require('multer');
const router = express.Router();
const kycService = require('../services/kycService');
const { validateJWT, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { query } = require('../database/connection');
const logger = require('../utils/logger');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only specific file types
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, PDF, and WebP files are allowed.'), false);
    }
  }
});

// Upload KYC document
router.post('/upload', validateJWT, upload.single('document'), asyncHandler(async (req, res) => {
  try {
    const { documentType, documentNumber, issuingCountry } = req.body;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        error: 'MISSING_FILE',
        message: 'Document file is required'
      });
    }

    if (!documentType || !documentNumber || !issuingCountry) {
      return res.status(400).json({
        error: 'MISSING_DATA',
        message: 'Document type, number, and issuing country are required'
      });
    }

    // Upload document to S3
    const uploadResult = await kycService.uploadDocument(
      userId,
      documentType,
      req.file.buffer,
      req.file.mimetype
    );

    // Create KYC verification record
    const verificationId = await kycService.createKYCVerification(userId, {
      documentType,
      documentNumber,
      issuingCountry,
      s3Key: uploadResult.s3Key,
      s3Url: uploadResult.s3Url
    });

    logger.info(`KYC document uploaded by user ${userId}: ${verificationId}`);

    res.json({
      success: true,
      verificationId,
      message: 'Document uploaded successfully and submitted for verification'
    });
  } catch (error) {
    logger.error('KYC upload error:', error);
    res.status(500).json({
      error: 'UPLOAD_FAILED',
      message: 'Failed to upload document'
    });
  }
}));

// Get user's KYC status
router.get('/status', validateJWT, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const status = await kycService.getUserKYCStatus(userId);

    res.json({
      success: true,
      kyc: status
    });
  } catch (error) {
    logger.error('Get KYC status error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get KYC status'
    });
  }
}));

// Get user's verification history
router.get('/history', validateJWT, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(`
      SELECT 
        id, document_type, document_number, issuing_country,
        status, submitted_at, reviewed_at, notes
      FROM kyc_verifications
      WHERE user_id = $1
      ORDER BY submitted_at DESC
    `, [userId]);

    res.json({
      success: true,
      verifications: result.rows
    });
  } catch (error) {
    logger.error('Get KYC history error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get verification history'
    });
  }
}));

// Admin: Get all pending verifications
router.get('/admin/pending', validateJWT, requireRole(['admin']), asyncHandler(async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const verifications = await kycService.getPendingVerifications(parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      verifications
    });
  } catch (error) {
    logger.error('Get pending verifications error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get pending verifications'
    });
  }
}));

// Admin: Get verification by ID
router.get('/admin/verification/:id', validateJWT, requireRole(['admin']), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const verification = await kycService.getVerificationById(id);

    if (!verification) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Verification not found'
      });
    }

    res.json({
      success: true,
      verification
    });
  } catch (error) {
    logger.error('Get verification by ID error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get verification'
    });
  }
}));

// Admin: Update verification status
router.patch('/admin/verification/:id/status', validateJWT, requireRole(['admin']), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['approved', 'rejected', 'requires_review'].includes(status)) {
      return res.status(400).json({
        error: 'INVALID_STATUS',
        message: 'Invalid status. Must be approved, rejected, or requires_review'
      });
    }

    // Update status with admin ID for tracking
    await kycService.updateVerificationStatus(id, status, notes, req.user.id);

    logger.info(`Admin ${req.user.id} updated verification ${id} status to ${status}`);

    res.json({
      success: true,
      message: 'Verification status updated successfully'
    });
  } catch (error) {
    logger.error('Update verification status error:', error);
    res.status(500).json({
      error: 'UPDATE_FAILED',
      message: 'Failed to update verification status'
    });
  }
}));

// Admin: Download document
router.get('/admin/verification/:id/document', validateJWT, requireRole(['admin']), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const verification = await kycService.getVerificationById(id);

    if (!verification) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Verification not found'
      });
    }

    const documentBuffer = await kycService.downloadDocument(verification.s3_key);
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${verification.document_type}_${id}.${kycService.getFileExtension(verification.document_type)}"`);
    res.send(documentBuffer);
  } catch (error) {
    logger.error('Download document error:', error);
    res.status(500).json({
      error: 'DOWNLOAD_FAILED',
      message: 'Failed to download document'
    });
  }
}));

// Admin: Get verification statistics
router.get('/admin/stats', validateJWT, requireRole(['admin']), asyncHandler(async (req, res) => {
  try {
    const stats = await kycService.getVerificationStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Get verification stats error:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get verification statistics'
    });
  }
}));

// Admin: Delete verification
router.delete('/admin/verification/:id', validateJWT, requireRole(['admin']), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const verification = await kycService.getVerificationById(id);

    if (!verification) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Verification not found'
      });
    }

    // Delete document from S3
    await kycService.deleteDocument(verification.s3_key);

    // Delete verification record
    await query('DELETE FROM kyc_verifications WHERE id = $1', [id]);

    logger.info(`Admin ${req.user.id} deleted verification ${id}`);

    res.json({
      success: true,
      message: 'Verification deleted successfully'
    });
  } catch (error) {
    logger.error('Delete verification error:', error);
    res.status(500).json({
      error: 'DELETE_FAILED',
      message: 'Failed to delete verification'
    });
  }
}));

module.exports = router;