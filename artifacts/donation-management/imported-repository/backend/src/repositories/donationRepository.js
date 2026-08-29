const { pool } = require("../db");

async function create(
  organizationId,
  userId,
  {
    donor_id,
    campaign_id,
    pledge_id,
    amount,
    payment_channel,
    payment_reference,
    donation_date,
  },
) {
  const result = await pool.query(
    `INSERT INTO donation_donations
       (organization_id, donor_id, campaign_id, pledge_id, amount, payment_channel, payment_reference, donation_date, status, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $9)
     RETURNING *`,
    [
      organizationId,
      donor_id,
      campaign_id || null,
      pledge_id || null,
      amount,
      payment_channel,
      payment_reference || null,
      donation_date,
      userId,
    ],
  );
  return result.rows[0];
}

async function findById(organizationId, donationId) {
  const result = await pool.query(
    `SELECT d.*, don.display_name AS donor_display_name,
            r.id AS receipt_id, r.receipt_number, r.status AS receipt_status
     FROM donation_donations d
     LEFT JOIN donation_donors don ON don.id = d.donor_id
     LEFT JOIN donation_receipts r ON r.donation_id = d.id
     WHERE d.id = $1 AND d.organization_id = $2 AND d.deleted_at IS NULL`,
    [donationId, organizationId],
  );
  return result.rows[0] || null;
}

async function list(
  organizationId,
  { page = 1, pageSize = 20, status, donor_id } = {},
) {
  const offset = (page - 1) * pageSize;
  const conditions = ["d.organization_id = $1", "d.deleted_at IS NULL"];
  const params = [organizationId];

  if (status) {
    params.push(status);
    conditions.push(`d.status = $${params.length}`);
  }
  if (donor_id) {
    params.push(donor_id);
    conditions.push(`d.donor_id = $${params.length}`);
  }

  params.push(pageSize, offset);
  const result = await pool.query(
    `SELECT d.*, don.display_name AS donor_display_name
     FROM donation_donations d
     LEFT JOIN donation_donors don ON don.id = d.donor_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY d.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return result.rows;
}

async function confirm(organizationId, userId, donationId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock just the donation row (no JOIN here)
    const donationResult = await client.query(
      `SELECT * FROM donation_donations 
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [donationId, organizationId],
    );
    const donation = donationResult.rows[0];

    if (!donation) {
      await client.query("ROLLBACK");
      return { error: "NOT_FOUND" };
    }
    if (donation.status !== "pending") {
      await client.query("ROLLBACK");
      return { error: "INVALID_TRANSITION", currentStatus: donation.status };
    }

    const updateResult = await client.query(
      `UPDATE donation_donations SET status = 'confirmed', updated_by = $1, updated_at = now()
       WHERE id = $2 AND organization_id = $3 RETURNING *`,
      [userId, donationId, organizationId],
    );

    // Pledge fulfillment: a donation only counts toward a pledge once it's
    // actually confirmed (not while pending). Locks the pledge row before
    // updating so a simultaneous confirm on another donation against the
    // same pledge can't race — same protection pattern as the donation
    // row lock above.
    if (donation.pledge_id) {
      await client.query(
        `SELECT id FROM donation_pledges WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [donation.pledge_id, organizationId],
      );
      await client.query(
        `UPDATE donation_pledges
         SET amount_fulfilled = GREATEST(amount_fulfilled + $1, 0), updated_by = $2, updated_at = now()
         WHERE id = $3 AND organization_id = $4`,
        [donation.amount, userId, donation.pledge_id, organizationId],
      );
    }

    await client.query("COMMIT");
    return { donation: updateResult.rows[0] };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function voidDonation(organizationId, userId, donationId) {
  // No pledge fulfillment reversal needed here: void only ever succeeds on
  // a 'pending' donation (see WHERE clause below), and pending donations
  // never incremented amount_fulfilled in the first place (that only
  // happens in confirm()).
  const result = await pool.query(
    `UPDATE donation_donations SET status = 'voided', updated_by = $1, updated_at = now()
     WHERE id = $2 AND organization_id = $3 AND status = 'pending' AND deleted_at IS NULL
     RETURNING *`,
    [userId, donationId, organizationId],
  );
  return result.rows[0] || null;
}

async function refund(organizationId, userId, donationId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const donationResult = await client.query(
      `SELECT * FROM donation_donations WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [donationId, organizationId],
    );
    const donation = donationResult.rows[0];

    if (!donation) {
      await client.query("ROLLBACK");
      return { error: "NOT_FOUND" };
    }
    if (donation.status !== "confirmed") {
      await client.query("ROLLBACK");
      return { error: "INVALID_TRANSITION", currentStatus: donation.status };
    }

    const updateResult = await client.query(
      `UPDATE donation_donations SET status = 'refunded', updated_by = $1, updated_at = now()
       WHERE id = $2 AND organization_id = $3 RETURNING *`,
      [userId, donationId, organizationId],
    );

    // Reverse the fulfillment credit this donation added back at confirm
    // time. Only 'confirmed' donations reach here (checked above), and
    // confirm() is the only place that ever increments amount_fulfilled,
    // so this subtraction always has a matching prior addition.
    if (donation.pledge_id) {
      await client.query(
        `SELECT id FROM donation_pledges WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [donation.pledge_id, organizationId],
      );
      await client.query(
        `UPDATE donation_pledges
         SET amount_fulfilled = GREATEST(amount_fulfilled - $1, 0), updated_by = $2, updated_at = now()
         WHERE id = $3 AND organization_id = $4`,
        [donation.amount, userId, donation.pledge_id, organizationId],
      );
    }

    await client.query(
      `UPDATE donation_receipts SET status = 'voided', updated_by = $1, updated_at = now()
       WHERE donation_id = $2 AND organization_id = $3 AND status = 'issued'`,
      [userId, donationId, organizationId],
    );

    await client.query("COMMIT");
    return { donation: updateResult.rows[0] };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function softDelete(organizationId, userId, donationId) {
  const result = await pool.query(
    `UPDATE donation_donations SET deleted_at = now(), updated_by = $1, updated_at = now()
     WHERE id = $2 AND organization_id = $3 AND deleted_at IS NULL
     RETURNING *`,
    [userId, donationId, organizationId],
  );
  return result.rows[0] || null;
}

async function voidReceipt(organizationId, userId, receiptId) {
  const result = await pool.query(
    `UPDATE donation_receipts SET status = 'voided', updated_by = $1, updated_at = now()
     WHERE id = $2 AND organization_id = $3 AND status = 'issued' AND deleted_at IS NULL
     RETURNING *`,
    [userId, receiptId, organizationId],
  );
  return result.rows[0] || null;
}

module.exports = {
  create,
  findById,
  list,
  confirm,
  voidDonation,
  refund,
  softDelete,
  voidReceipt,
};
