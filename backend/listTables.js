require('dotenv').config();
const { pool } = require('./src/db');

pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`)
  .then((res) => {
    console.log(res.rows.map(r => r.table_name));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });