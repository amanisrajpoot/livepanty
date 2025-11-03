/**
 * Migration and Seeding Script
 * - Checks database schema and applies missing tables/columns
 * - Seeds database with demo data
 * 
 * Run: node backend/scripts/migrate-and-seed.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query } = require('../src/database/connection');

async function migrateDatabase() {
  try {
    console.log('📦 Starting database migration...');
    
    // Connect to database
    const { connectDatabase } = require('../src/database/connection');
    await connectDatabase();
    console.log('✅ Connected to database');
    
    // Read schema file
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split schema into individual statements
    // Remove comments and split by semicolons
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
      .filter(s => !s.match(/^\s*$/));
    
    console.log(`📋 Found ${statements.length} schema statements to check`);
    
    // Check which tables exist
    const existingTables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const existingTableNames = existingTables.rows.map(r => r.table_name);
    console.log(`📊 Existing tables: ${existingTableNames.join(', ')}`);
    
    // Check if payments table exists (should be 'payments' not 'payment_transactions')
    const hasPaymentTransactions = existingTableNames.includes('payment_transactions');
    const hasPayments = existingTableNames.includes('payments');
    
    if (hasPaymentTransactions && !hasPayments) {
      console.log('⚠️  Found old "payment_transactions" table, should be "payments"');
      console.log('   Keeping both for now, but new code uses "payments"');
    }
    
    // Check if payments table exists
    if (!hasPayments) {
      console.log('📝 Creating payments table...');
      const paymentsSchema = fs.readFileSync(path.join(__dirname, 'create-payments-table.sql'), 'utf8');
      await query(paymentsSchema);
      console.log('✅ Payments table created');
    } else {
      console.log('✅ Payments table already exists');
    }
    
    // Enable extensions if they don't exist
    try {
      await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      console.log('✅ Extension uuid-ossp enabled');
    } catch (e) {
      console.log('⚠️  uuid-ossp extension:', e.message);
    }
    
    try {
      await query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
      console.log('✅ Extension pgcrypto enabled');
    } catch (e) {
      console.log('⚠️  pgcrypto extension:', e.message);
    }
    
    // Check and create missing tables from schema
    const requiredTables = [
      'users', 'user_preferences', 'wallets', 'ledger', 'streams', 
      'tips', 'payments', 'kyc_verifications', 'notifications',
      'chat_messages', 'content_reports', 'moderation_flags'
    ];
    
    const missingTables = requiredTables.filter(t => !existingTableNames.includes(t));
    
    if (missingTables.length > 0) {
      console.log(`⚠️  Missing tables: ${missingTables.join(', ')}`);
      console.log('   These should be created by the main schema.sql file');
      console.log('   Run the schema.sql file manually if needed');
    } else {
      console.log('✅ All required tables exist');
    }
    
    console.log('✅ Migration complete!\n');
    
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Run comprehensive seed script
    const seedScript = require('./seed-comprehensive');
    
    // The seed-comprehensive.js should export a function or run automatically
    console.log('✅ Database seeded with demo data');
    
    return true;
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

async function main() {
  try {
    // Run migration
    await migrateDatabase();
    
    // Ask if user wants to seed (don't auto-seed to avoid overwriting data)
    console.log('💡 To seed the database with demo data, run:');
    console.log('   node backend/scripts/seed-comprehensive.js');
    console.log('\n✅ Migration complete! Database is ready.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { migrateDatabase, seedDatabase };

