const { query } = require('../database/connection');
const logger = require('../utils/logger');

const getUserById = async (userId) => {
  try {
    const result = await query(`
      SELECT id, email, display_name, username, role, status, country,
             email_verified, bio, profile_image_url, created_at, updated_at
      FROM users 
      WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    logger.error('Error getting user by ID:', error);
    throw error;
  }
};

const getUserByEmail = async (email) => {
  try {
    const result = await query(`
      SELECT id, email, display_name, username, role, status, country,
             email_verified, bio, profile_image_url, created_at, updated_at
      FROM users 
      WHERE email = $1
    `, [email]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    logger.error('Error getting user by email:', error);
    throw error;
  }
};

const updateUser = async (userId, updates) => {
  try {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    
    const result = await query(`
      UPDATE users 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [userId, ...values]);

    return result.rows[0];
  } catch (error) {
    logger.error('Error updating user:', error);
    throw error;
  }
};

module.exports = {
  getUserById,
  getUserByEmail,
  updateUser
};
