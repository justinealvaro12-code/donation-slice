const { pool } = require('../db');

async function findById(organizationId) {
  const result = await pool.query(
    `SELECT * FROM organizations WHERE id = $1`,
    [organizationId]
  );
  return result.rows[0] || null;
}

async function update(organizationId, name) {
  const result = await pool.query(
    `UPDATE organizations SET name = $1 WHERE id = $2 RETURNING *`,
    [name, organizationId]
  );
  return result.rows[0] || null;
}

module.exports = { findById, update };