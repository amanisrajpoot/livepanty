const logger = require('../utils/logger');

/**
 * Global error handling middleware
 * Handles all errors that occur in the application
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  // PostgreSQL errors
  if (err.code) {
    switch (err.code) {
      case '23505': // Unique violation
        error = { message: 'Duplicate entry', statusCode: 409 };
        break;
      case '23503': // Foreign key violation
        error = { message: 'Referenced resource not found', statusCode: 404 };
        break;
      case '23502': // Not null violation
        error = { message: 'Required field missing', statusCode: 400 };
        break;
      case '23514': // Check constraint violation
        error = { message: 'Invalid data provided', statusCode: 400 };
        break;
      case '42P01': // Undefined table
        error = { message: 'Database error', statusCode: 500 };
        break;
      case '42703': // Undefined column
        error = { message: 'Database error', statusCode: 500 };
        break;
      default:
        error = { message: 'Database error', statusCode: 500 };
    }
  }

  // Rate limiting errors
  if (err.statusCode === 429) {
    error = { message: 'Too many requests, please try again later', statusCode: 429 };
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = { message: 'File too large', statusCode: 413 };
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    error = { message: 'Too many files', statusCode: 413 };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = { message: 'Unexpected file field', statusCode: 400 };
  }

  // AWS S3 errors
  if (err.code === 'NoSuchBucket') {
    error = { message: 'Storage bucket not found', statusCode: 500 };
  }

  if (err.code === 'AccessDenied') {
    error = { message: 'Storage access denied', statusCode: 500 };
  }

  // Payment processing errors
  if (err.type === 'StripeCardError') {
    error = { message: err.message, statusCode: 402 };
  }

  if (err.type === 'StripeInvalidRequestError') {
    error = { message: 'Invalid payment request', statusCode: 400 };
  }

  // WebRTC/Socket.IO errors
  if (err.message && err.message.includes('socket')) {
    error = { message: 'Connection error', statusCode: 503 };
  }

  // Age verification errors
  if (err.message && err.message.includes('age')) {
    error = { message: 'Age verification required', statusCode: 403 };
  }

  // KYC errors
  if (err.message && err.message.includes('kyc')) {
    error = { message: 'Identity verification required', statusCode: 403 };
  }

  // Content moderation errors
  if (err.message && err.message.includes('moderation')) {
    error = { message: 'Content violates platform policies', statusCode: 403 };
  }

  // Default to 500 server error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Don't leak error details in production
  const response = {
    error: getErrorCode(statusCode),
    message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  // Add request ID if available
  if (req.id) {
    response.requestId = req.id;
  }

  res.status(statusCode).json(response);
};

/**
 * Get standardized error code based on status code
 */
const getErrorCode = (statusCode) => {
  const codes = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    402: 'PAYMENT_REQUIRED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    413: 'PAYLOAD_TOO_LARGE',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_SERVER_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
    504: 'GATEWAY_TIMEOUT'
  };

  return codes[statusCode] || 'INTERNAL_SERVER_ERROR';
};

/**
 * Handle async errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Custom error class
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle unhandled promise rejections
 */
const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (err, promise) => {
    logger.error('Unhandled Promise Rejection:', {
      message: err.message,
      stack: err.stack,
      promise
    });
    
    // Close server & exit process
    process.exit(1);
  });
};

/**
 * Handle uncaught exceptions
 */
const handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', {
      message: err.message,
      stack: err.stack
    });
    
    // Close server & exit process
    process.exit(1);
  });
};

module.exports = {
  errorHandler,
  asyncHandler,
  AppError,
  handleUnhandledRejection,
  handleUncaughtException
};
