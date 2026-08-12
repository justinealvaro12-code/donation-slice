require('dotenv').config();
const { pool } = require('./src/db');

pool.query('SELECT id, organization_id, role FROM users LIMIT 5')
  .then((res) => {
    console.log(res.rows);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });