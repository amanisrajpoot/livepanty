const { query } = require('../database/connection');
const logger = require('../utils/logger');

const sendTip = async (tipData) => {
  try {
    // Support both naming conventions
    const fromUserId = tipData.from_user_id || tipData.fromUserId;
    const toUserId = tipData.to_user_id || tipData.toUserId;
    const streamId = tipData.stream_id || tipData.streamId;
    const tokens = tipData.tokens || tipData.amount;
    const message = tipData.message || 'Tip';
    const isPrivate = tipData.is_private || tipData.isPrivate || false;
    
    if (!fromUserId || !toUserId || !tokens || tokens <= 0) {
      throw new Error('Invalid tip data');
    }
    
    await query('BEGIN');
    
    try {
      // Get sender's balance before
      const senderWalletResult = await query(`
        SELECT token_balance FROM wallets WHERE user_id = $1
      `, [fromUserId]);
      
      if (senderWalletResult.rows.length === 0) {
        throw new Error('Sender wallet not found');
      }
      
      const senderBalanceBefore = senderWalletResult.rows[0].token_balance;
      
      if (senderBalanceBefore < tokens) {
        throw new Error('Insufficient balance');
      }
      
      // Get recipient's balance before
      const recipientWalletResult = await query(`
        SELECT token_balance FROM wallets WHERE user_id = $1
      `, [toUserId]);
      
      const recipientBalanceBefore = recipientWalletResult.rows.length > 0 
        ? recipientWalletResult.rows[0].token_balance 
        : 0;
      
      // Deduct from sender's wallet
      const senderBalanceAfter = senderBalanceBefore - tokens;
      await query(`
        UPDATE wallets 
        SET token_balance = $1, updated_at = NOW()
        WHERE user_id = $2
      `, [senderBalanceAfter, fromUserId]);

      // Calculate recipient balance after
      const recipientBalanceAfter = recipientBalanceBefore + tokens;
      
      // Create or update recipient's wallet
      if (recipientWalletResult.rows.length === 0) {
        await query(`
          INSERT INTO wallets (user_id, currency_code, token_balance, created_at, updated_at)
          VALUES ($1, 'USD', $2, NOW(), NOW())
        `, [toUserId, recipientBalanceAfter]);
      } else {
        // Add to receiver's wallet
        await query(`
          UPDATE wallets 
          SET token_balance = $1, updated_at = NOW()
          WHERE user_id = $2
        `, [recipientBalanceAfter, toUserId]);
      }

      // Insert tip record
      let tipRecord;
      if (streamId) {
        const tipResult = await query(`
          INSERT INTO tips (stream_id, from_user_id, to_user_id, tokens, message, is_private)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, created_at
        `, [streamId, fromUserId, toUserId, tokens, message, isPrivate]);
        tipRecord = tipResult.rows[0];
      }

      // Record transaction in ledger for sender (tip_sent)
      await query(`
        INSERT INTO ledger (
          user_id, counterparty_id, transaction_type, amount_tokens,
          balance_before, balance_after, reference_id, reference_type, description, created_at
        ) VALUES ($1, $2, 'tip_sent', $3, $4, $5, $6, 'tip', $7, NOW())
      `, [
        fromUserId, 
        toUserId, 
        -tokens, // Negative for debit
        senderBalanceBefore, 
        senderBalanceAfter,
        tipRecord?.id || streamId || null,
        message || 'Tip sent'
      ]);

      // Record transaction in ledger for recipient (tip_received)
      await query(`
        INSERT INTO ledger (
          user_id, counterparty_id, transaction_type, amount_tokens,
          balance_before, balance_after, reference_id, reference_type, description, created_at
        ) VALUES ($1, $2, 'tip_received', $3, $4, $5, $6, 'tip', $7, NOW())
      `, [
        toUserId,
        fromUserId,
        tokens, // Positive for credit
        recipientBalanceBefore,
        recipientBalanceAfter,
        tipRecord?.id || streamId || null,
        message || 'Tip received'
      ]);

      await query('COMMIT');
      
      return {
        id: tipRecord?.id || null,
        success: true,
        balance_after: senderBalanceAfter,
        created_at: tipRecord?.created_at || new Date().toISOString()
      };
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
