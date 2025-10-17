const { query } = require('../database/connection');
const logger = require('../utils/logger');

const createStream = async (streamData) => {
  try {
    const { host_id, title, description, category, tags, is_private = false } = streamData;
    
    const result = await query(`
      INSERT INTO streams (
        host_id, title, description, category, tags, 
        status, is_private, sfu_room_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `, [
      host_id, 
      title, 
      description, 
      category, 
      tags, 
      'created',
      is_private,
      `room_${host_id}_${Date.now()}`
    ]);

    return result.rows[0];
  } catch (error) {
    logger.error('Error creating stream:', error);
    throw error;
  }
};

const updateStreamStatus = async (streamId, status) => {
  try {
    const result = await query(`
      UPDATE streams 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [status, streamId]);

    return result.rows[0];
  } catch (error) {
    logger.error('Error updating stream status:', error);
    throw error;
  }
};

const getStreamById = async (streamId) => {
  try {
    const result = await query(`
      SELECT s.*, u.display_name as host_name, u.profile_image_url as host_avatar
      FROM streams s
      JOIN users u ON s.host_id = u.id
      WHERE s.id = $1
    `, [streamId]);

    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error getting stream by ID:', error);
    throw error;
  }
};

const getStreams = async (filters = {}) => {
  try {
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (filters.status) {
      paramCount++;
      whereClause += ` AND s.status = $${paramCount}`;
      params.push(filters.status);
    }

    if (filters.category) {
      paramCount++;
      whereClause += ` AND s.category = $${paramCount}`;
      params.push(filters.category);
    }

    if (filters.host_id) {
      paramCount++;
      whereClause += ` AND s.host_id = $${paramCount}`;
      params.push(filters.host_id);
    }

    const result = await query(`
      SELECT s.*, u.display_name as host_name, u.profile_image_url as host_avatar
      FROM streams s
      JOIN users u ON s.host_id = u.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...params, filters.limit || 20, filters.offset || 0]);

    return result.rows;
  } catch (error) {
    logger.error('Error getting streams:', error);
    throw error;
  }
};

module.exports = {
  createStream,
  updateStreamStatus,
  getStreamById,
  getStreams
};
