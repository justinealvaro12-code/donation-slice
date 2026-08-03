const { pool } = require('../db');

async function create(organizationId, userId, { donor_id, amount, payment_channel, payment_reference, donation_date }) {
  const result = await pool.query(
    `INSERT INTO donations
       (organization_id, donor_id, amount, payment_channel, payment_reference, donation_date, status, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $7)
     RETURNING *`,
    [organizationId, donor_id, amount, payment_channel, payment_reference || null, donation_date, userId]
  );
  return result.rows[0];
}

async function findById(organizationId, donationId) {
  const result = await pool.query(
    `SELECT d.*, r.id AS receipt_id, r.receipt_number, r.status AS receipt_status
     FROM donations d
     LEFT JOIN receipts r ON r.donation_id = d.id
     WHERE d.id = $1 AND d.organization_id = $2 AND d.deleted_at IS NULL`,
    [donationId, organizationId]
  );
  return result.rows[0] || null;
}

async function list(organizationId, { page = 1, pageSize = 20, status, donor_id } = {}) {
  const offset = (page - 1) * pageSize;
  const conditions = ['organization_id = $1', 'deleted_at IS NULL'];
  const params = [organizationId];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (donor_id) {
    params.push(donor_id);
    conditions.push(`donor_id = $${params.length}`);
  }

  params.push(pageSize, offset);
  const result = await pool.query(
    `SELECT * FROM donations WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
}

// Confirms a pending donation and issues its receipt in a single transaction,
// so a donation can never end up "confirmed" without a receipt (or vice versa).
async function confirm(organizationId, userId, donationId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const donationResult = await client.query(
      `SELECT * FROM donations WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [donationId, organizationId]
    );
    const donation = donationResult.rows[0];

    if (!donation) {
      await client.query('ROLLBACK');
      return { error: 'NOT_FOUND' };
    }
    if (donation.status !== 'pending') {
      await client.query('ROLLBACK');
      return { error: 'INVALID_TRANSITION', currentStatus: donation.status };
    }

    const updateResult = await client.query(
      `UPDATE donations SET status = 'confirmed', updated_by = $1, updated_at = now()
       WHERE id = $2 RETURNING *`,
      [userId, donationId]
    );

    const receiptNumber = `RCPT-${Date.now()}-${donationId.slice(0, 8)}`;
    const receiptResult = await client.query(
      `INSERT INTO receipts (organization_id, donation_id, receipt_number, issued_by, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4, $4)
       RETURNING *`,
      [organizationId, donationId, receiptNumber, userId]
    );

    await client.query('COMMIT');
    return { donation: updateResult.rows[0], receipt: receiptResult.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function voidDonation(organizationId, userId, donationId) {
  const result = await pool.query(
    `UPDATE donations SET status = 'void', updated_by = $1, updated_at = now()
     WHERE id = $2 AND organization_id = $3 AND status = 'pending' AND deleted_at IS NULL
     RETURNING *`,
    [userId, donationId, organizationId]
  );
  return result.rows[0] || null; // null means not found OR invalid transition; caller distinguishes via a fresh lookup
}

async function refund(organizationId, userId, donationId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const donationResult = await client.query(
      `SELECT * FROM donations WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [donationId, organizationId]
    );
    const donation = donationResult.rows[0];

    if (!donation) {
      await client.query('ROLLBACK');
      return { error: 'NOT_FOUND' };
    }
    if (donation.status !== 'confirmed') {
      await client.query('ROLLBACK');
      return { error: 'INVALID_TRANSITION', currentStatus: donation.status };
    }

    const updateResult = await client.query(
      `UPDATE donations SET status = 'refunded', updated_by = $1, updated_at = now()
       WHERE id = $2 RETURNING *`,
      [userId, donationId]
    );

    await client.query(
      `UPDATE receipts SET status = 'voided', updated_by = $1, updated_at = now()
       WHERE donation_id = $2 AND status = 'issued'`,
      [userId, donationId]
    );

    await client.query('COMMIT');
    return { donation: updateResult.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { create, findById, list, confirm, voidDonation, refund };
