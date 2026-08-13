const { pool } = require('../db');

// Helper: compute status dynamically
function statusExpr(alias = 'p') {
  return `CASE
    WHEN ${alias}.amount_fulfilled >= ${alias}.amount_pledged THEN 'fulfilled'
    WHEN ${alias}.amount_fulfilled > 0 THEN 'partially_fulfilled'
    ELSE 'pledged'
  END`;
}

// PostgreSQL NUMERIC/DECIMAL values are returned as strings by node-postgres.
// Normalize pledge amounts so the API returns actual JavaScript numbers.
function normalizePledge(row) {
  if (!row) return row;

  return {
    ...row,
    amount_pledged: Number(row.amount_pledged),
    amount_fulfilled: Number(row.amount_fulfilled),
  };
}

async function create(
  organizationId,
  userId,
  { donor_id, campaign_id, amount_pledged, pledge_date, due_date }
) {
  // Tenant isolation:
  // The donor must belong to the same organization as the pledge.
  const donorResult = await pool.query(
    `SELECT id
     FROM donation_donors
     WHERE id = $1
       AND organization_id = $2
       AND deleted_at IS NULL`,
    [donor_id, organizationId]
  );

  if (donorResult.rows.length === 0) {
    return null;
  }

  // If a campaign was supplied, make sure it also belongs
  // to the same organization.
  if (campaign_id) {
    const campaignResult = await pool.query(
      `SELECT id
       FROM donation_campaigns
       WHERE id = $1
         AND organization_id = $2
         AND deleted_at IS NULL`,
      [campaign_id, organizationId]
    );

    if (campaignResult.rows.length === 0) {
      return null;
    }
  }

  const result = await pool.query(
    `INSERT INTO donation_pledges
       (
         organization_id,
         donor_id,
         campaign_id,
         amount_pledged,
         pledge_date,
         due_date,
         created_by,
         updated_by
       )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
     RETURNING *,
       ${statusExpr('donation_pledges')} AS status`,
    [
      organizationId,
      donor_id,
      campaign_id || null,
      amount_pledged,
      pledge_date,
      due_date || null,
      userId,
    ]
  );

  return normalizePledge(result.rows[0]);
}

async function findById(organizationId, pledgeId) {
  const result = await pool.query(
    `SELECT
       p.*,
       d.display_name AS donor_name,
       c.name AS campaign_name,
       ${statusExpr('p')} AS status,
       (
         p.due_date IS NOT NULL
         AND p.due_date < CURRENT_DATE
         AND ${statusExpr('p')} != 'fulfilled'
       ) AS is_overdue
     FROM donation_pledges p
     JOIN donation_donors d
       ON d.id = p.donor_id
      AND d.organization_id = p.organization_id
     LEFT JOIN donation_campaigns c
       ON c.id = p.campaign_id
      AND c.organization_id = p.organization_id
     WHERE p.id = $1
       AND p.organization_id = $2
       AND p.deleted_at IS NULL`,
    [pledgeId, organizationId]
  );

  return normalizePledge(result.rows[0] || null);
}

async function list(
  organizationId,
  {
    page = 1,
    pageSize = 20,
    status,
    campaign_id,
    search,
    overdue,
  } = {}
) {
  const offset = (page - 1) * pageSize;

  const conditions = [
    'p.organization_id = $1',
    'p.deleted_at IS NULL',
  ];

  const params = [organizationId];

  if (status) {
    params.push(status);
    conditions.push(`${statusExpr('p')} = $${params.length}`);
  }

  if (campaign_id) {
    params.push(campaign_id);
    conditions.push(`p.campaign_id = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`d.display_name ILIKE $${params.length}`);
  }

  if (overdue) {
    conditions.push(`
      p.due_date IS NOT NULL
      AND p.due_date < CURRENT_DATE
      AND ${statusExpr('p')} != 'fulfilled'
    `);
  }

  params.push(pageSize, offset);

  const result = await pool.query(
    `SELECT
       p.*,
       d.display_name AS donor_name,
       c.name AS campaign_name,
       ${statusExpr('p')} AS status,
       (
         p.due_date IS NOT NULL
         AND p.due_date < CURRENT_DATE
         AND ${statusExpr('p')} != 'fulfilled'
       ) AS is_overdue
     FROM donation_pledges p
     JOIN donation_donors d
       ON d.id = p.donor_id
      AND d.organization_id = p.organization_id
     LEFT JOIN donation_campaigns c
       ON c.id = p.campaign_id
      AND c.organization_id = p.organization_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY p.created_at DESC
     LIMIT $${params.length - 1}
     OFFSET $${params.length}`,
    params
  );

  return result.rows.map(normalizePledge);
}

async function summary(organizationId) {
  const result = await pool.query(
    `SELECT
       COALESCE(
         SUM(p.amount_pledged - p.amount_fulfilled)
         FILTER (
           WHERE ${statusExpr('p')} != 'fulfilled'
         ),
         0
       ) AS total_outstanding,

       COUNT(*)
       FILTER (
         WHERE p.due_date IS NOT NULL
           AND p.due_date < CURRENT_DATE
           AND ${statusExpr('p')} != 'fulfilled'
       ) AS overdue_count,

       COALESCE(
         SUM(p.amount_fulfilled),
         0
       ) AS total_fulfilled

     FROM donation_pledges p
     WHERE p.organization_id = $1
       AND p.deleted_at IS NULL`,
    [organizationId]
  );

  const row = result.rows[0];

  return {
    total_outstanding: Number(row.total_outstanding),
    overdue_count: Number(row.overdue_count),
    total_fulfilled: Number(row.total_fulfilled),
  };
}

async function update(organizationId, userId, pledgeId, data) {
  const fields = [];
  const values = [];
  let idx = 1;

  for (const key of [
    'donor_id',
    'campaign_id',
    'amount_pledged',
    'pledge_date',
    'due_date',
  ]) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(data[key]);
    }
  }

  if (fields.length === 0) {
    return null;
  }

  // If changing donor, verify the new donor belongs to this organization.
  if (data.donor_id !== undefined) {
    const donorResult = await pool.query(
      `SELECT id
       FROM donation_donors
       WHERE id = $1
         AND organization_id = $2
         AND deleted_at IS NULL`,
      [data.donor_id, organizationId]
    );

    if (donorResult.rows.length === 0) {
      return null;
    }
  }

  // If changing campaign, verify the campaign belongs to this organization.
  if (data.campaign_id !== undefined && data.campaign_id !== null) {
    const campaignResult = await pool.query(
      `SELECT id
       FROM donation_campaigns
       WHERE id = $1
         AND organization_id = $2
         AND deleted_at IS NULL`,
      [data.campaign_id, organizationId]
    );

    if (campaignResult.rows.length === 0) {
      return null;
    }
  }

  fields.push(`updated_by = $${idx++}`);
  fields.push(`updated_at = now()`);

  values.push(userId);
  values.push(pledgeId, organizationId);

  const result = await pool.query(
    `UPDATE donation_pledges
     SET ${fields.join(', ')}
     WHERE id = $${idx++}
       AND organization_id = $${idx++}
       AND deleted_at IS NULL
     RETURNING *,
       ${statusExpr('donation_pledges')} AS status`,
    values
  );

  return normalizePledge(result.rows[0] || null);
}

async function recordFulfillment(organizationId, pledgeId, delta) {
  const result = await pool.query(
    `UPDATE donation_pledges
     SET
       amount_fulfilled = GREATEST(amount_fulfilled + $1, 0),
       updated_at = now()
     WHERE id = $2
       AND organization_id = $3
       AND deleted_at IS NULL
     RETURNING *,
       ${statusExpr('donation_pledges')} AS status`,
    [delta, pledgeId, organizationId]
  );

  return normalizePledge(result.rows[0] || null);
}

async function softDelete(organizationId, userId, pledgeId) {
  const result = await pool.query(
    `UPDATE donation_pledges
     SET
       deleted_at = now(),
       updated_by = $1,
       updated_at = now()
     WHERE id = $2
       AND organization_id = $3
       AND deleted_at IS NULL
     RETURNING *,
       ${statusExpr('donation_pledges')} AS status`,
    [userId, pledgeId, organizationId]
  );

  return normalizePledge(result.rows[0] || null);
}

module.exports = {
  create,
  findById,
  list,
  summary,
  update,
  recordFulfillment,
  softDelete,
};
