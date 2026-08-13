const { pool } = require('../db');

async function findByOrganization(organizationId) {
  const result = await pool.query(
    `SELECT r.*, dd.status as donation_status, dd.amount as amount
     FROM donation_receipts r
     JOIN donation_donations dd ON dd.id = r.donation_id
     WHERE r.organization_id = $1 AND r.deleted_at IS NULL
     ORDER BY r.issued_at DESC`,
    [organizationId]
  );
  return result.rows;
}

async function findById(id, organizationId) {
  const result = await pool.query(
    `SELECT r.*, dd.status as donation_status, dd.amount as amount
     FROM donation_receipts r
     JOIN donation_donations dd ON dd.id = r.donation_id
     WHERE r.id = $1 AND r.organization_id = $2 AND r.deleted_at IS NULL`,
    [id, organizationId]
  );
  return result.rows[0] || null;
}

async function findByDonationId(donationId, organizationId) {
  const result = await pool.query(
    `SELECT * FROM donation_receipts 
     WHERE donation_id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
    [donationId, organizationId]
  );
  return result.rows[0] || null;
}

async function create({ donation_id, organization_id, receipt_number, issued_by }, client = pool) {
  const result = await client.query(
    `INSERT INTO donation_receipts 
     (donation_id, organization_id, receipt_number, issued_at, issued_by, status, created_by, updated_by)
     VALUES ($1, $2, $3, NOW(), $4, 'issued', $4, $4)
     RETURNING *`,
    [donation_id, organization_id, receipt_number, issued_by]
  );
  return result.rows[0];
}

module.exports = { findByOrganization, findById, findByDonationId, create };
