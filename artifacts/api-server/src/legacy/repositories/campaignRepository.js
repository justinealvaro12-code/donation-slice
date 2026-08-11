const { pool } = require('../db');

async function create(organizationId, userId, { name, description, goal_amount, start_date, end_date, status }) {
  const result = await pool.query(
    `INSERT INTO donation_campaigns
       (organization_id, name, description, goal_amount, start_date, end_date, status, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
     RETURNING *`,
    [organizationId, name, description || null, goal_amount, start_date, end_date, status || 'draft', userId]
  );
  return result.rows[0];
}

async function findById(organizationId, campaignId) {
  const result = await pool.query(
    `SELECT * FROM donation_campaigns WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
    [campaignId, organizationId]
  );
  return result.rows[0] || null;
}

// Returns campaigns with a computed `raised` total from confirmed donations
// linked via donation_donations.campaign_id. Campaigns with no linked
// donations yet correctly show raised = 0 (LEFT JOIN + COALESCE).
async function list(organizationId, { page = 1, pageSize = 20, status, search } = {}) {
  const offset = (page - 1) * pageSize;
  const conditions = ['c.organization_id = $1', 'c.deleted_at IS NULL'];
  const params = [organizationId];

  if (status) {
    params.push(status);
    conditions.push(`c.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`c.name ILIKE $${params.length}`);
  }

  params.push(pageSize, offset);
  const result = await pool.query(
    `SELECT c.*,
            COALESCE(SUM(d.amount) FILTER (WHERE d.status = 'confirmed'), 0) AS raised_amount
     FROM donation_campaigns c
     LEFT JOIN donation_donations d ON d.campaign_id = c.id AND d.deleted_at IS NULL
     WHERE ${conditions.join(' AND ')}
     GROUP BY c.id
     ORDER BY c.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
}

async function update(organizationId, userId, campaignId, data) {
  const fields = [];
  const values = [];
  let idx = 1;

  for (const key of ['name', 'description', 'goal_amount', 'start_date', 'end_date', 'status']) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(data[key]);
    }
  }

  if (fields.length === 0) return null;

  fields.push(`updated_by = $${idx++}`);
  fields.push(`updated_at = now()`);
  values.push(userId);

  values.push(campaignId, organizationId);

  const result = await pool.query(
    `UPDATE donation_campaigns SET ${fields.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx++} AND deleted_at IS NULL RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

async function softDelete(organizationId, userId, campaignId) {
  const result = await pool.query(
    `UPDATE donation_campaigns SET deleted_at = now(), updated_by = $1, updated_at = now()
     WHERE id = $2 AND organization_id = $3 AND deleted_at IS NULL
     RETURNING *`,
    [userId, campaignId, organizationId]
  );
  return result.rows[0] || null;
}

module.exports = { create, findById, list, update, softDelete };
