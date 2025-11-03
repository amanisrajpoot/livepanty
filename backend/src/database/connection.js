const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool;

const connectDatabase = async () => {
  try {
    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Neon and most cloud databases require SSL
    // If DATABASE_URL contains 'neon' or 'vercel' or has sslmode=require, use SSL
    const requiresSSL = process.env.DATABASE_URL.includes('neon') || 
                        process.env.DATABASE_URL.includes('vercel') ||
                        process.env.DATABASE_URL.includes('sslmode=require') ||
                        process.env.NODE_ENV === 'production';

    const config = {
      connectionString: process.env.DATABASE_URL,
      ssl: requiresSSL ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Increased to 10 seconds for cloud databases
      query_timeout: 30000, // Query timeout in milliseconds
      statement_timeout: 30000, // Statement timeout in milliseconds
    };

    pool = new Pool(config);

    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    // Set global database connection
    global.db = pool;

    logger.info('✅ Database connected successfully');
    
    // Handle pool errors
    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
      process.exit(-1);
    });

    return pool;
  } catch (error) {
    logger.error('❌ Database connection failed:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack
    });
    throw error;
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error('Database not connected. Call connectDatabase() first.');
  }
  return pool;
};

const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      logger.warn(`Slow query detected: ${duration}ms - ${text.substring(0, 100)}...`);
    }
    
    return result;
  } catch (error) {
    logger.error('Database query error:', {
      query: text.substring(0, 200),
      error: error.message,
      duration: Date.now() - start
    });
    throw error;
  }
};

const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const closeDatabase = async () => {
  if (pool) {
    await pool.end();
    logger.info('Database connection closed');
  }
};

module.exports = {
  connectDatabase,
  getPool,
  query,
  transaction,
  closeDatabase
};
