require('dotenv').config();
const { pool } = require('./src/db');

pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'donation_donors' ORDER BY ordinal_position`)
  .then((res) => {
    console.log(res.rows);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });