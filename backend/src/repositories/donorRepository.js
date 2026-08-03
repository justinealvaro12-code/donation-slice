const { pool } = require('../db');

// Every function REQUIRES organizationId as an argument. There is no code
// path in this repository that queries `donors` without a tenant filter —
// this makes cross-tenant leakage a compile-time-shaped mistake to make, not
// something a handler can silently forget.

async function create(organizationId, userId, { donor_type, display_name, email, phone, address }) {
  const result = await pool.query(
    `INSERT INTO donors (organization_id, donor_type, display_name, email, phone, address, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
     RETURNING *`,
    [organizationId, donor_type, display_name, email || null, phone || null, address || null, userId]
  );
  return result.rows[0];
}

async function findById(organizationId, donorId) {
  const result = await pool.query(
    `SELECT * FROM donors WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
    [donorId, organizationId]
  );
  return result.rows[0] || null;
}

async function list(organizationId, { page = 1, pageSize = 20 } = {}) {
  const offset = (page - 1) * pageSize;
  const result = await pool.query(
    `SELECT * FROM donors WHERE organization_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [organizationId, pageSize, offset]
  );
  return result.rows;
}

module.exports = { create, findById, list };
