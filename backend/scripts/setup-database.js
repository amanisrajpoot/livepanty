#!/usr/bin/env node

/**
 * Database Setup Script for LivePanty Platform
 * This script initializes the database with the complete schema
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const setupDatabase = async () => {
  let pool;
  
  try {
    console.log('🔗 Connecting to Neon DB...');
    
    // Create database connection
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Test connection
    const client = await pool.connect();
    console.log('✅ Connected to Neon DB successfully!');
    
    // Read the schema file
    const schemaPath = path.join(__dirname, '../database/init-simple.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📄 Reading database schema...');
    
    // Execute the schema
    console.log('🚀 Creating tables and indexes...');
    await client.query(schema);
    
    console.log('✅ Database schema created successfully!');
    
    // Test some basic queries
    console.log('🧪 Testing database...');
    
    // Check if tables were created
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📊 Created tables:', tablesResult.rows.map(row => row.table_name));
    
    // Check if admin user was created
    const adminResult = await client.query(`
      SELECT id, email, display_name, role 
      FROM users 
      WHERE email = 'admin@livepanty.com'
    `);
    
    if (adminResult.rows.length > 0) {
      console.log('👤 Admin user created:', adminResult.rows[0]);
    }
    
    client.release();
    console.log('🎉 Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
};

// Run the setup
if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;
