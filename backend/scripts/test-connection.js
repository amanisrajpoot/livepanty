#!/usr/bin/env node

/**
 * Database Connection Test Script
 * This script tests the connection to Neon DB
 */

const { Pool } = require('pg');
require('dotenv').config();

const testConnection = async () => {
  let pool;
  
  try {
    console.log('🔗 Testing Neon DB connection...');
    console.log('📍 Connection string:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL not found in .env file');
      console.log('💡 Please add your Neon DB connection string to the .env file');
      process.exit(1);
    }
    
    // Create database connection
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Test connection
    const client = await pool.connect();
    console.log('✅ Connected to Neon DB successfully!');
    
    // Test a simple query
    const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
    console.log('🕐 Current time:', result.rows[0].current_time);
    console.log('🐘 PostgreSQL version:', result.rows[0].postgres_version);
    
    // Check if we can create a test table
    await client.query('CREATE TABLE IF NOT EXISTS connection_test (id SERIAL PRIMARY KEY, test_data TEXT)');
    console.log('✅ Can create tables');
    
    // Clean up test table
    await client.query('DROP TABLE IF EXISTS connection_test');
    console.log('✅ Can drop tables');
    
    client.release();
    console.log('🎉 Database connection test passed!');
    console.log('🚀 Ready to run: node scripts/setup-database.js');
    
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.error('💡 Check your Neon DB connection string - host not found');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('💡 Check your Neon DB connection string - connection refused');
    } else if (error.code === '28P01') {
      console.error('💡 Check your Neon DB credentials - authentication failed');
    } else if (error.code === '3D000') {
      console.error('💡 Check your Neon DB database name - database does not exist');
    }
    
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
};

// Run the test
if (require.main === module) {
  testConnection();
}

module.exports = testConnection;
