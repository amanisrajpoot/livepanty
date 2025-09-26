const jwt = require('jsonwebtoken');
const { query } = require('../database/connection');
const logger = require('../utils/logger');

/**
 * JWT Authentication Middleware
 * Validates JWT tokens and attaches user information to request
 */
const validateJWT = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authorization token required'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authorization token required'
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired'
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: 'INVALID_TOKEN',
          message: 'Invalid authentication token'
        });
      } else {
        throw jwtError;
      }
    }

    // Get user from database
    const userResult = await query(`
      SELECT 
        id, email, display_name, username, role, status, country,
        email_verified, two_factor_enabled, last_login_at
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

    // Check if user account is active
    if (user.status === 'banned') {
      return res.status(403).json({
        error: 'ACCOUNT_BANNED',
        message: 'Account has been banned'
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        error: 'ACCOUNT_SUSPENDED',
        message: 'Account has been suspended'
      });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      username: user.username,
      role: user.role,
      status: user.status,
      country: user.country,
      email_verified: user.email_verified,
      two_factor_enabled: user.two_factor_enabled,
      last_login_at: user.last_login_at
    };

    // Log API access for audit
    if (process.env.NODE_ENV === 'production') {
      await query(`
        INSERT INTO audit_logs (user_id, action, resource_type, ip_address, user_agent, metadata)
        VALUES ($1, 'api_access', 'api', $2, $3, $4)
      `, [
        user.id,
        req.ip,
        req.get('User-Agent'),
        JSON.stringify({
          method: req.method,
          path: req.path,
          timestamp: new Date().toISOString()
        })
      ]);
    }

    next();

  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Authentication failed'
    });
  }
};

/**
 * Role-based access control middleware
 * @param {string|string[]} allowedRoles - Role or array of roles allowed to access
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
    }

    const userRole = req.user.role;
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(userRole)) {
      logger.warn(`Access denied for user ${req.user.id} with role ${userRole} to ${req.path}`);
      return res.status(403).json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Insufficient permissions to access this resource'
      });
    }

    next();
  };
};

/**
 * Admin-only access middleware
 */
const requireAdmin = requireRole(['admin']);

/**
 * Performer or Admin access middleware
 */
const requirePerformerOrAdmin = requireRole(['performer', 'admin']);

/**
 * Email verification required middleware
 */
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required'
    });
  }

  if (!req.user.email_verified) {
    return res.status(403).json({
      error: 'EMAIL_NOT_VERIFIED',
      message: 'Email verification required'
    });
  }

  next();
};

/**
 * Account status check middleware
 * @param {string[]} allowedStatuses - Array of allowed account statuses
 */
const requireStatus = (allowedStatuses) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
    }

    if (!allowedStatuses.includes(req.user.status)) {
      return res.status(403).json({
        error: 'ACCOUNT_STATUS_ERROR',
        message: `Account status '${req.user.status}' not allowed`
      });
    }

    next();
  };
};

/**
 * Active account required middleware
 */
const requireActiveAccount = requireStatus(['active', 'pending_verification']);

/**
 * Rate limiting middleware for authenticated users
 */
const rateLimitByUser = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    if (requests.has(userId)) {
      const userRequests = requests.get(userId).filter(time => time > windowStart);
      requests.set(userId, userRequests);
    } else {
      requests.set(userId, []);
    }

    const userRequests = requests.get(userId);

    if (userRequests.length >= maxRequests) {
      logger.warn(`Rate limit exceeded for user ${userId}`);
      return res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later'
      });
    }

    userRequests.push(now);
    next();
  };
};

/**
 * Optional JWT authentication middleware
 * Similar to validateJWT but doesn't fail if no token is provided
 */
const optionalJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // No token provided, continue without user
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return next(); // No token provided, continue without user
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const userResult = await query(`
      SELECT 
        id, email, display_name, username, role, status, country,
        email_verified, two_factor_enabled, last_login_at
      FROM users 
      WHERE id = $1 AND deleted_at IS NULL AND status IN ('active', 'pending_verification')
    `, [decoded.userId]);

    if (userResult.rows.length > 0) {
      req.user = userResult.rows[0];
    }

    next();

  } catch (error) {
    // Token is invalid, but we continue without user
    next();
  }
};

module.exports = {
  validateJWT,
  requireRole,
  requireAdmin,
  requirePerformerOrAdmin,
  requireEmailVerification,
  requireStatus,
  requireActiveAccount,
  rateLimitByUser,
  optionalJWT
};
