const express = require('express');
const { body, validationResult } = require('express-validator');
const asyncHandler = require('express-async-handler');

const { query } = require('../database/connection');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/streams:
 *   get:
 *     summary: Get live streams
 *     tags: [Streams]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Live streams retrieved
 */
router.get('/', asyncHandler(async (req, res) => {
  const { category, limit = 20, offset = 0 } = req.query;

  try {
    let whereClause = "WHERE s.status = 'live' AND s.deleted_at IS NULL";
    const values = [];
    let paramCount = 1;

    if (category) {
      whereClause += ` AND s.category = $${paramCount++}`;
      values.push(category);
    }

    const result = await query(`
      SELECT 
        s.id, s.host_id, u.display_name as host_name, s.title, s.description,
        s.category, s.tags, s.is_private, s.is_age_restricted, s.status,
        s.started_at, s.viewer_count, s.peak_viewer_count, s.total_tokens_received,
        s.thumbnail_url
      FROM streams s
      JOIN users u ON s.host_id = u.id
      ${whereClause}
      ORDER BY s.started_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `, [...values, parseInt(limit), parseInt(offset)]);

    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM streams s
      ${whereClause}
    `, values);

    res.json({
      streams: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    logger.error('Get streams error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve streams'
    });
  }
}));

/**
 * @swagger
 * /api/streams:
 *   post:
 *     summary: Create new stream
 *     tags: [Streams]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - category
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               category:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               is_private:
 *                 type: boolean
 *                 default: false
 *               tip_enabled:
 *                 type: boolean
 *                 default: true
 *               chat_enabled:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Stream created successfully
 */
router.post('/', [
  body('title').isLength({ min: 1, max: 200 }).trim(),
  body('description').optional().isLength({ max: 1000 }).trim(),
  body('category').notEmpty().trim(),
  body('tags').optional().isArray({ max: 10 }),
  body('is_private').optional().isBoolean(),
  body('tip_enabled').optional().isBoolean(),
  body('chat_enabled').optional().isBoolean()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request parameters',
      details: errors.array()
    });
  }

  const {
    title,
    description,
    category,
    tags = [],
    is_private = false,
    tip_enabled = true,
    chat_enabled = true
  } = req.body;

  try {
    const result = await query(`
      INSERT INTO streams (
        host_id, title, description, category, tags, is_private,
        tip_enabled, chat_enabled, status, sfu_room_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'created', $9)
      RETURNING id, host_id, title, description, category, tags, is_private,
                tip_enabled, chat_enabled, status, created_at
    `, [
      req.user.id,
      title,
      description,
      category,
      tags,
      is_private,
      tip_enabled,
      chat_enabled,
      `room_${Date.now()}_${req.user.id}`
    ]);

    const stream = result.rows[0];

    logger.info(`Stream created: ${stream.id} by user ${req.user.id}`);

    res.status(201).json({
      stream_id: stream.id,
      sfu_room_id: stream.sfu_room_id,
      status: stream.status,
      created_at: stream.created_at
    });

  } catch (error) {
    logger.error('Create stream error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to create stream'
    });
  }
}));

/**
 * @swagger
 * /api/streams/{streamId}:
 *   get:
 *     summary: Get stream details
 *     tags: [Streams]
 *     parameters:
 *       - in: path
 *         name: streamId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Stream details retrieved
 *       404:
 *         description: Stream not found
 */
router.get('/:streamId', asyncHandler(async (req, res) => {
  const { streamId } = req.params;

  try {
    const result = await query(`
      SELECT 
        s.id, s.host_id, u.display_name as host_name, s.title, s.description,
        s.category, s.tags, s.is_private, s.is_age_restricted, s.status,
        s.started_at, s.ended_at, s.viewer_count, s.peak_viewer_count,
        s.total_tokens_received, s.thumbnail_url, s.created_at
      FROM streams s
      JOIN users u ON s.host_id = u.id
      WHERE s.id = $1 AND s.deleted_at IS NULL
    `, [streamId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'STREAM_NOT_FOUND',
        message: 'Stream not found'
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Get stream details error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve stream details'
    });
  }
}));

/**
 * @swagger
 * /api/streams/{streamId}/start:
 *   post:
 *     summary: Start streaming
 *     tags: [Streams]
 *     parameters:
 *       - in: path
 *         name: streamId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Stream started successfully
 */
router.post('/:streamId/start', asyncHandler(async (req, res) => {
  const { streamId } = req.params;

  try {
    // Check if user owns this stream
    const streamResult = await query(
      'SELECT id, host_id, status FROM streams WHERE id = $1',
      [streamId]
    );

    if (streamResult.rows.length === 0) {
      return res.status(404).json({
        error: 'STREAM_NOT_FOUND',
        message: 'Stream not found'
      });
    }

    const stream = streamResult.rows[0];

    if (stream.host_id !== req.user.id) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You can only start your own streams'
      });
    }

    if (stream.status !== 'created') {
      return res.status(400).json({
        error: 'INVALID_STATUS',
        message: 'Stream can only be started from created status'
      });
    }

    // Update stream status
    const result = await query(`
      UPDATE streams 
      SET status = 'live', started_at = NOW()
      WHERE id = $1
      RETURNING id, status, started_at
    `, [streamId]);

    logger.info(`Stream started: ${streamId} by user ${req.user.id}`);

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Start stream error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to start stream'
    });
  }
}));

/**
 * @swagger
 * /api/streams/{streamId}:
 *   delete:
 *     summary: End stream
 *     tags: [Streams]
 *     parameters:
 *       - in: path
 *         name: streamId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Stream ended successfully
 */
router.delete('/:streamId', asyncHandler(async (req, res) => {
  const { streamId } = req.params;

  try {
    // Check if user owns this stream
    const streamResult = await query(
      'SELECT id, host_id, status, started_at FROM streams WHERE id = $1',
      [streamId]
    );

    if (streamResult.rows.length === 0) {
      return res.status(404).json({
        error: 'STREAM_NOT_FOUND',
        message: 'Stream not found'
      });
    }

    const stream = streamResult.rows[0];

    if (stream.host_id !== req.user.id) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You can only end your own streams'
      });
    }

    // Calculate duration
    const duration = stream.started_at ? 
      Math.floor((new Date() - new Date(stream.started_at)) / 1000) : 0;

    // Update stream status
    const result = await query(`
      UPDATE streams 
      SET status = 'ended', ended_at = NOW(), duration_seconds = $1
      WHERE id = $2
      RETURNING id, status, ended_at, duration_seconds
    `, [duration, streamId]);

    logger.info(`Stream ended: ${streamId} by user ${req.user.id}, duration: ${duration}s`);

    res.json({
      message: 'Stream ended successfully',
      duration_seconds: duration,
      ended_at: result.rows[0].ended_at
    });

  } catch (error) {
    logger.error('End stream error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to end stream'
    });
  }
}));

module.exports = router;
