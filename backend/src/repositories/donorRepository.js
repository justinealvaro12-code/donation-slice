const { pool } = require('../db');

async function create(organizationId, userId, data) {
  const result = await pool.query(
    `INSERT INTO donation_donors (organization_id, donor_type, display_name, email, phone, address, status, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $7)
     RETURNING *`,
    [organizationId, data.donor_type, data.display_name, data.email || null, data.phone || null, data.address || null, userId]
  );
  return result.rows[0];
}

async function findById(organizationId, donorId) {
  const result = await pool.query(
    `SELECT * FROM donation_donors WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
    [donorId, organizationId]
  );
  return result.rows[0] || null;
}

async function list(organizationId, { page = 1, pageSize = 20, search } = {}) {
  const offset = (page - 1) * pageSize;
  const conditions = ['organization_id = $1', 'deleted_at IS NULL'];
  const params = [organizationId];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(display_name ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }

  params.push(pageSize, offset);
  const result = await pool.query(
    `SELECT * FROM donation_donors WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
}

async function update(organizationId, userId, donorId, data) {
  const fields = [];
  const values = [];
  let idx = 1;
  
  if (data.display_name !== undefined) {
    fields.push(`display_name = $${idx++}`);
    values.push(data.display_name);
  }
  if (data.email !== undefined) {
    fields.push(`email = $${idx++}`);
    values.push(data.email);
  }
  if (data.phone !== undefined) {
    fields.push(`phone = $${idx++}`);
    values.push(data.phone);
  }
  if (data.address !== undefined) {
    fields.push(`address = $${idx++}`);
    values.push(data.address);
  }
  
  if (fields.length === 0) return null;
  
  fields.push(`updated_by = $${idx++}`);
  fields.push(`updated_at = now()`);
  values.push(userId);
  
  values.push(donorId, organizationId);
  
  const result = await pool.query(
    `UPDATE donation_donors SET ${fields.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx++} AND deleted_at IS NULL RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

async function softDelete(organizationId, userId, donorId) {
  const result = await pool.query(
    `UPDATE donation_donors SET deleted_at = now(), updated_by = $1, updated_at = now()
     WHERE id = $2 AND organization_id = $3 AND deleted_at IS NULL
     RETURNING *`,
    [userId, donorId, organizationId]
  );
  return result.rows[0] || null;
}

module.exports = { create, findById, list, update, softDelete };