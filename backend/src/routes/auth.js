const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');

const { query, transaction } = require('../database/connection');
const logger = require('../utils/logger');
const { validateJWT } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         email:
 *           type: string
 *           format: email
 *         display_name:
 *           type: string
 *         username:
 *           type: string
 *         role:
 *           type: string
 *           enum: [viewer, performer, admin]
 *         status:
 *           type: string
 *           enum: [active, suspended, banned, pending_verification]
 *         created_at:
 *           type: string
 *           format: date-time
 *     AuthResponse:
 *       type: object
 *       properties:
 *         access_token:
 *           type: string
 *         refresh_token:
 *           type: string
 *         expires_in:
 *           type: integer
 *         user:
 *           $ref: '#/components/schemas/User'
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - display_name
 *               - date_of_birth
 *               - country
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               display_name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *               country:
 *                 type: string
 *                 pattern: "^[A-Z]{2}$"
 *               role:
 *                 type: string
 *                 enum: [viewer, performer]
 *                 default: viewer
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already exists
 */
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('display_name').isLength({ min: 2, max: 100 }).trim(),
  body('username').optional().isLength({ min: 3, max: 50 }).matches(/^[a-zA-Z0-9_]+$/),
  body('date_of_birth').isISO8601().toDate(),
  body('country').isLength({ min: 2, max: 2 }).matches(/^[A-Z]{2}$/),
  body('role').optional().isIn(['viewer', 'performer'])
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
    email,
    password,
    display_name,
    username,
    date_of_birth,
    country,
    role = 'viewer'
  } = req.body;

  // Check if user already exists
  const existingUser = await query(
    'SELECT id FROM users WHERE email = $1 OR username = $2',
    [email, username]
  );

  if (existingUser.rows.length > 0) {
    return res.status(409).json({
      error: 'USER_EXISTS',
      message: 'User with this email or username already exists'
    });
  }

  // Validate age (must be 18+)
  const age = Math.floor((new Date() - new Date(date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 18) {
    return res.status(400).json({
      error: 'AGE_RESTRICTION',
      message: 'You must be at least 18 years old to register'
    });
  }

  try {
    // Hash password
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: uuidv4(), email, role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { userId: uuidv4(), email, type: 'refresh' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Create user in transaction
    const result = await transaction(async (client) => {
      // Insert user
      const userResult = await client.query(`
        INSERT INTO users (email, password_hash, display_name, username, role, status, country, date_of_birth)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, email, display_name, username, role, status, country, created_at
      `, [email, password_hash, display_name, username, role, 'pending_verification', country, date_of_birth]);

      const user = userResult.rows[0];

      // Create wallet
      await client.query(`
        INSERT INTO wallets (user_id, token_balance, conversion_rate)
        VALUES ($1, 0, 100.0)
      `, [user.id]);

      // Create user preferences
      await client.query(`
        INSERT INTO user_preferences (user_id)
        VALUES ($1)
      `, [user.id]);

      // Log registration
      await client.query(`
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent)
        VALUES ($1, 'user_registered', 'user', $1, $2, $3)
      `, [user.id, req.ip, req.get('User-Agent')]);

      return user;
    });

    logger.info(`New user registered: ${email} (${role})`);

    res.status(201).json({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      token_type: 'Bearer',
      user: result
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Registration failed'
    });
  }
}));

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request parameters',
      details: errors.array()
    });
  }

  const { email, password } = req.body;

  try {
    // Find user
    const userResult = await query(`
      SELECT id, email, password_hash, display_name, username, role, status, country, last_login_at
      FROM users 
      WHERE email = $1 AND deleted_at IS NULL
    `, [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    const user = userResult.rows[0];

    // Check if account is active
    if (user.status !== 'active' && user.status !== 'pending_verification') {
      return res.status(401).json({
        error: 'ACCOUNT_SUSPENDED',
        message: 'Account is suspended or banned'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email, type: 'refresh' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Update last login
    await query(`
      UPDATE users 
      SET last_login_at = NOW(), last_login_ip = $1
      WHERE id = $2
    `, [req.ip, user.id]);

    // Log login
    await query(`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent)
      VALUES ($1, 'user_login', 'user', $1, $2, $3)
    `, [user.id, req.ip, req.get('User-Agent')]);

    logger.info(`User logged in: ${email}`);

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      token_type: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        username: user.username,
        role: user.role,
        status: user.status,
        country: user.country,
        last_login_at: user.last_login_at
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Login failed'
    });
  }
}));

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh JWT token
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(401).json({
      error: 'MISSING_TOKEN',
      message: 'Refresh token is required'
    });
  }

  try {
    const decoded = jwt.verify(refresh_token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid refresh token'
      });
    }

    // Get user
    const userResult = await query(`
      SELECT id, email, display_name, username, role, status, country
      FROM users 
      WHERE id = $1 AND deleted_at IS NULL
    `, [decoded.userId]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Generate new tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const newRefreshToken = jwt.sign(
      { userId: user.id, email: user.email, type: 'refresh' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      access_token: accessToken,
      refresh_token: newRefreshToken,
      expires_in: 3600,
      token_type: 'Bearer',
      user
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid refresh token'
      });
    }
    
    logger.error('Token refresh error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Token refresh failed'
    });
  }
}));

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: User logout
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', validateJWT, asyncHandler(async (req, res) => {
  try {
    // Log logout
    await query(`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent)
      VALUES ($1, 'user_logout', 'user', $1, $2, $3)
    `, [req.user.id, req.ip, req.get('User-Agent')]);

    logger.info(`User logged out: ${req.user.email}`);

    res.json({
      message: 'Logged out successfully'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Logout failed'
    });
  }
}));

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
router.get('/me', validateJWT, asyncHandler(async (req, res) => {
  try {
    const userResult = await query(`
      SELECT 
        u.id, u.email, u.display_name, u.username, u.role, u.status, 
        u.country, u.timezone, u.date_of_birth, u.profile_image_url, 
        u.bio, u.is_public, u.email_verified, u.two_factor_enabled, 
        u.last_login_at, u.created_at, u.updated_at,
        w.token_balance, w.reserved_balance
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      WHERE u.id = $1 AND u.deleted_at IS NULL
    `, [req.user.id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    res.json({
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      username: user.username,
      role: user.role,
      status: user.status,
      country: user.country,
      timezone: user.timezone,
      date_of_birth: user.date_of_birth,
      profile_image_url: user.profile_image_url,
      bio: user.bio,
      is_public: user.is_public,
      email_verified: user.email_verified,
      two_factor_enabled: user.two_factor_enabled,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
      wallet: {
        token_balance: user.token_balance || 0,
        reserved_balance: user.reserved_balance || 0
      }
    });

  } catch (error) {
    logger.error('Get user profile error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve user profile'
    });
  }
}));

module.exports = router;
