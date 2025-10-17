const { query } = require('../database/connection');
const logger = require('../utils/logger');

const sendTip = async (tipData) => {
  try {
    const { from_user_id, to_user_id, stream_id, amount, message, is_private = false } = tipData;
    
    await query('BEGIN');
    
    try {
      // Deduct from sender's wallet
      await query(`
        UPDATE wallets 
        SET token_balance = token_balance - $1, updated_at = NOW()
        WHERE user_id = $2
      `, [amount, from_user_id]);

      // Add to receiver's wallet
      await query(`
        UPDATE wallets 
        SET token_balance = token_balance + $1, updated_at = NOW()
        WHERE user_id = $2
      `, [amount, to_user_id]);

      // Record transaction
      await query(`
        INSERT INTO ledger (
          user_id, counterparty_id, amount_tokens, transaction_type, 
          description, reference_id, reference_type, created_at
        ) VALUES ($1, $2, $3, 'tip', $4, $5, 'stream', NOW())
      `, [from_user_id, to_user_id, amount, message || 'Tip', stream_id]);

      await query('COMMIT');
      
      return { success: true };
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('Error sending tip:', error);
    throw error;
  }
};

const getStreamTips = async (streamId, limit = 50) => {
  try {
    const result = await query(`
      SELECT 
        l.id,
        l.amount_tokens as amount,
        l.description,
        l.created_at,
        u.display_name as from_display_name,
        u.profile_image_url as from_avatar
      FROM ledger l
      JOIN users u ON l.user_id = u.id
      WHERE l.reference_id = $1 AND l.reference_type = 'stream'
      ORDER BY l.created_at DESC
      LIMIT $2
    `, [streamId, limit]);

    return result.rows;
  } catch (error) {
    logger.error('Error getting stream tips:', error);
    throw error;
  }
};

const getTotalTipsForStream = async (streamId) => {
  try {
    const result = await query(`
      SELECT COALESCE(SUM(amount_tokens), 0) as total_tips
      FROM ledger 
      WHERE reference_id = $1 AND reference_type = 'stream'
    `, [streamId]);

    return result.rows[0].total_tips;
  } catch (error) {
    logger.error('Error getting total tips for stream:', error);
    throw error;
  }
};

module.exports = {
  sendTip,
  getStreamTips,
  getTotalTipsForStream
};
