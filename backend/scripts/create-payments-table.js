/**
 * Script to create payments table if it doesn't exist
 * Run: node backend/scripts/create-payments-table.js
 */

require('dotenv').config();
const { query } = require('../src/database/connection');
const fs = require('fs');
const path = require('path');

async function createPaymentsTable() {
  try {
    console.log('Creating payments table...');
    
    const sqlFile = path.join(__dirname, 'create-payments-table.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Execute SQL statements
    await query(sql);
    
    console.log('✅ Payments table created successfully!');
    process.exit(0);
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✅ Payments table already exists');
      process.exit(0);
    } else {
      console.error('❌ Error creating payments table:', error);
      process.exit(1);
    }
  }
}

createPaymentsTable();

