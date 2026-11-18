const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://authenticator:npg_LF1XpaWK5ADk@ep-little-shadow-azj0b69n.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
});

const sql = fs.readFileSync('migration.sql', 'utf8');

pool.query(sql)
  .then(() => {
    console.log('✅ Migration successful!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  });
