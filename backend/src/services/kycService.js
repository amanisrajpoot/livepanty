const { query } = require('../database/connection');
const logger = require('../utils/logger');
const AWS = require('aws-sdk');
const crypto = require('crypto');

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

class KYCService {
  constructor() {
    this.bucketName = process.env.S3_BUCKET_NAME || 'livepanty-kyc-documents';
    this.encryptionKey = process.env.DOCUMENT_ENCRYPTION_KEY || 'default-encryption-key';
  }

  // Upload document to S3 with encryption
  async uploadDocument(userId, documentType, fileBuffer, mimeType) {
    try {
      const documentId = crypto.randomUUID();
      const fileName = `${userId}/${documentType}/${documentId}.${this.getFileExtension(mimeType)}`;
      
      // Encrypt the document
      const encryptedBuffer = this.encryptDocument(fileBuffer);
      
      const uploadParams = {
        Bucket: this.bucketName,
        Key: fileName,
        Body: encryptedBuffer,
        ContentType: mimeType,
        ServerSideEncryption: 'AES256',
        Metadata: {
          userId: userId,
          documentType: documentType,
          originalName: `${documentType}_${documentId}`,
          uploadedAt: new Date().toISOString()
        }
      };

      const result = await s3.upload(uploadParams).promise();
      
      logger.info(`Document uploaded for user ${userId}: ${documentType}`);
      return {
        documentId,
        s3Key: fileName,
        s3Url: result.Location,
        uploadedAt: new Date()
      };
    } catch (error) {
      logger.error('Error uploading document:', error);
      throw new Error('Failed to upload document');
    }
  }

  // Download document from S3 and decrypt
  async downloadDocument(s3Key) {
    try {
      const downloadParams = {
        Bucket: this.bucketName,
        Key: s3Key
      };

      const result = await s3.getObject(downloadParams).promise();
      const decryptedBuffer = this.decryptDocument(result.Body);
      
      return decryptedBuffer;
    } catch (error) {
      logger.error('Error downloading document:', error);
      throw new Error('Failed to download document');
    }
  }

  // Create KYC verification record
  async createKYCVerification(userId, verificationData) {
    try {
      const { documentType, s3Key, s3Url, documentNumber, issuingCountry } = verificationData;
      
      const result = await query(`
        INSERT INTO kyc_verifications (
          user_id, document_type, document_number, issuing_country,
          s3_key, s3_url, status, submitted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
        RETURNING id
      `, [userId, documentType, documentNumber, issuingCountry, s3Key, s3Url]);

      const verificationId = result.rows[0].id;
      
      // Trigger automated verification if available
      await this.triggerAutomatedVerification(verificationId, verificationData);
      
      logger.info(`KYC verification created for user ${userId}: ${verificationId}`);
      return verificationId;
    } catch (error) {
      logger.error('Error creating KYC verification:', error);
      throw new Error('Failed to create KYC verification');
    }
  }

  // Trigger automated verification
  async triggerAutomatedVerification(verificationId, verificationData) {
    try {
      // Integration with age verification services
      const { documentType, documentNumber, issuingCountry } = verificationData;
      
      // For now, we'll implement a basic validation
      // In production, integrate with services like Jumio, Onfido, or Trulioo
      const isValid = await this.validateDocument(documentType, documentNumber, issuingCountry);
      
      if (isValid) {
        await this.updateVerificationStatus(verificationId, 'approved', 'Automated verification passed');
      } else {
        await this.updateVerificationStatus(verificationId, 'requires_review', 'Requires manual review');
      }
    } catch (error) {
      logger.error('Error in automated verification:', error);
      await this.updateVerificationStatus(verificationId, 'requires_review', 'Automated verification failed');
    }
  }

  // Basic document validation (replace with real service integration)
  async validateDocument(documentType, documentNumber, issuingCountry) {
    // This is a placeholder - integrate with real verification services
    // For demo purposes, we'll do basic validation
    
    if (!documentNumber || documentNumber.length < 5) {
      return false;
    }
    
    // Check if document type is valid
    const validTypes = ['passport', 'drivers_license', 'national_id', 'birth_certificate'];
    if (!validTypes.includes(documentType)) {
      return false;
    }
    
    // Check if country is valid
    const validCountries = ['US', 'CA', 'GB', 'AU', 'IN', 'DE', 'FR', 'ES', 'IT', 'NL'];
    if (!validCountries.includes(issuingCountry)) {
      return false;
    }
    
    return true;
  }

  // Update verification status
  async updateVerificationStatus(verificationId, status, notes = null) {
    try {
      await query(`
        UPDATE kyc_verifications 
        SET status = $1, reviewed_at = NOW(), notes = $2
        WHERE id = $3
      `, [status, notes, verificationId]);

      // If approved, update user status
      if (status === 'approved') {
        const verification = await this.getVerificationById(verificationId);
        await query(`
          UPDATE users 
          SET kyc_verified = true, kyc_verified_at = NOW()
          WHERE id = $1
        `, [verification.user_id]);
      }

      logger.info(`KYC verification ${verificationId} status updated to ${status}`);
    } catch (error) {
      logger.error('Error updating verification status:', error);
      throw new Error('Failed to update verification status');
    }
  }

  // Get verification by ID
  async getVerificationById(verificationId) {
    try {
      const result = await query(`
        SELECT k.*, u.email, u.display_name, u.username
        FROM kyc_verifications k
        JOIN users u ON k.user_id = u.id
        WHERE k.id = $1
      `, [verificationId]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting verification by ID:', error);
      throw new Error('Failed to get verification');
    }
  }

  // Get all pending verifications for admin review
  async getPendingVerifications(limit = 50, offset = 0) {
    try {
      const result = await query(`
        SELECT k.*, u.email, u.display_name, u.username, u.created_at as user_created_at
        FROM kyc_verifications k
        JOIN users u ON k.user_id = u.id
        WHERE k.status IN ('pending', 'requires_review')
        ORDER BY k.submitted_at ASC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      return result.rows;
    } catch (error) {
      logger.error('Error getting pending verifications:', error);
      throw new Error('Failed to get pending verifications');
    }
  }

  // Get user's KYC status
  async getUserKYCStatus(userId) {
    try {
      const result = await query(`
        SELECT 
          u.kyc_verified,
          u.kyc_verified_at,
          k.status as latest_verification_status,
          k.submitted_at as latest_submission_date,
          k.notes as latest_notes
        FROM users u
        LEFT JOIN kyc_verifications k ON u.id = k.user_id
        WHERE u.id = $1
        ORDER BY k.submitted_at DESC
        LIMIT 1
      `, [userId]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting user KYC status:', error);
      throw new Error('Failed to get KYC status');
    }
  }

  // Get verification statistics
  async getVerificationStats() {
    try {
      const result = await query(`
        SELECT 
          status,
          COUNT(*) as count
        FROM kyc_verifications
        GROUP BY status
      `);

      const stats = {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        requires_review: 0
      };

      result.rows.forEach(row => {
        stats[row.status] = parseInt(row.count);
        stats.total += parseInt(row.count);
      });

      return stats;
    } catch (error) {
      logger.error('Error getting verification stats:', error);
      throw new Error('Failed to get verification statistics');
    }
  }

  // Encrypt document
  encryptDocument(buffer) {
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(buffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted;
  }

  // Decrypt document
  decryptDocument(encryptedBuffer) {
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encryptedBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
  }

  // Get file extension from MIME type
  getFileExtension(mimeType) {
    const extensions = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'application/pdf': 'pdf',
      'image/webp': 'webp'
    };
    return extensions[mimeType] || 'bin';
  }

  // Delete document from S3
  async deleteDocument(s3Key) {
    try {
      await s3.deleteObject({
        Bucket: this.bucketName,
        Key: s3Key
      }).promise();
      
      logger.info(`Document deleted from S3: ${s3Key}`);
    } catch (error) {
      logger.error('Error deleting document:', error);
      throw new Error('Failed to delete document');
    }
  }
}

module.exports = new KYCService();
