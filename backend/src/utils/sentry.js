const logger = require('./logger');

let Sentry = null;

// Initialize Sentry
function initializeSentry() {
  try {
    if (process.env.SENTRY_DSN) {
      Sentry = require('@sentry/node');
      
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0
      });

      logger.info('Sentry initialized for error tracking');
      return true;
    } else {
      logger.info('Sentry DSN not configured, error tracking disabled');
      return false;
    }
  } catch (error) {
    logger.warn('Failed to initialize Sentry:', error.message);
    return false;
  }
}

// Capture exception
function captureException(error, context = {}) {
  if (Sentry) {
    Sentry.withScope((scope) => {
      Object.keys(context).forEach(key => {
        scope.setContext(key, context[key]);
      });
      Sentry.captureException(error);
    });
  }
  logger.error('Error captured:', error);
}

// Capture message
function captureMessage(message, level = 'info', context = {}) {
  if (Sentry) {
    Sentry.withScope((scope) => {
      Object.keys(context).forEach(key => {
        scope.setContext(key, context[key]);
      });
      Sentry.captureMessage(message, level);
    });
  }
  logger.log(level, message);
}

// Set user context
function setUser(user) {
  if (Sentry) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username
    });
  }
}

// Clear user context
function clearUser() {
  if (Sentry) {
    Sentry.setUser(null);
  }
}

module.exports = {
  initializeSentry,
  captureException,
  captureMessage,
  setUser,
  clearUser,
  Sentry
};

