require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./src/db');

const migrationPath = path.join(__dirname, 'migrations', '005_create_pledges.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

pool.query(sql)
  .then(() => {
    console.log('Migration applied successfully: 005_create_pledges.sql');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:');
    console.error(err);
    process.exit(1);
  });