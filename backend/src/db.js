const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set in environment. Check your .env file.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = { pool };