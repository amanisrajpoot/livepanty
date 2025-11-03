require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require') 
    ? { rejectUnauthorized: false } 
    : false
});

async function addBalanceBeforeColumn() {
  try {
    console.log('Checking if balance_before column exists...');
    
    // Check if column exists
    const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ledger' AND column_name = 'balance_before'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ balance_before column already exists');
      pool.end();
      return;
    }
    
    console.log('Adding balance_before column to ledger table...');
    
    // Add balance_before column (NOT NULL but allow NULL initially, then set defaults)
    await pool.query(`
      ALTER TABLE ledger 
      ADD COLUMN balance_before INTEGER
    `);
    
    console.log('✅ balance_before column added successfully');
    
    // Update existing rows to set balance_before = balance_after - amount_tokens
    // For rows where balance_after exists, calculate balance_before
    // For rows where balance_after doesn't exist, set to 0
    console.log('Updating existing rows...');
    const updateResult1 = await pool.query(`
      UPDATE ledger 
      SET balance_before = balance_after - amount_tokens
      WHERE balance_before IS NULL AND balance_after IS NOT NULL
    `);
    
    // For rows without balance_after, set balance_before to 0
    const updateResult2 = await pool.query(`
      UPDATE ledger 
      SET balance_before = 0
      WHERE balance_before IS NULL
    `);
    
    console.log(`✅ Updated ${updateResult1.rowCount + updateResult2.rowCount} existing ledger entries`);
    
    // Verify no NULLs remain
    const checkNulls = await pool.query(`
      SELECT COUNT(*) as null_count
      FROM ledger 
      WHERE balance_before IS NULL
    `);
    
    if (parseInt(checkNulls.rows[0].null_count) > 0) {
      console.warn(`⚠️  Warning: ${checkNulls.rows[0].null_count} rows still have NULL balance_before`);
      // Set them all to 0 as fallback
      await pool.query(`
        UPDATE ledger 
        SET balance_before = 0
        WHERE balance_before IS NULL
      `);
    }
    
    // Now make it NOT NULL
    console.log('Making balance_before NOT NULL...');
    await pool.query(`
      ALTER TABLE ledger 
      ALTER COLUMN balance_before SET NOT NULL
    `);
    
    console.log('✅ balance_before column is now NOT NULL');
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error adding balance_before column:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

addBalanceBeforeColumn()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

