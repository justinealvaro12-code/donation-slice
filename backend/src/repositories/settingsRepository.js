const { pool } = require('../db');
const { ROLE_PERMISSIONS } = require('../rolePermissions');

const ALL_ROLES = Object.keys(ROLE_PERMISSIONS);
const ALL_PERMISSIONS = [...new Set(Object.values(ROLE_PERMISSIONS).flat())].sort();
const ALL_CHANNELS = ['cash', 'check', 'bank_transfer', 'card', 'online', 'other'];

/* ---------- Roles & Permissions ---------- */

// Idempotent: inserts each role's default permissions for this org, but
// only for roles that have zero rows yet — never overwrites permissions
// an admin has already customized.
async function ensureDefaultsForOrg(organizationId, userId) {
  for (const role of ALL_ROLES) {
    const existing = await pool.query(
      `SELECT 1 FROM donation_role_permissions WHERE organization_id = $1 AND role = $2 LIMIT 1`,
      [organizationId, role]
    );
    if (existing.rows.length > 0) continue;

    const defaults = ROLE_PERMISSIONS[role] || [];
    for (const permission of defaults) {
      await pool.query(
        `INSERT INTO donation_role_permissions (organization_id, role, permission, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $4)
         ON CONFLICT (organization_id, role, permission) DO NOTHING`,
        [organizationId, role, permission, userId || null]
      );
    }
  }
}

async function getRolesSummary(organizationId, userId) {
  await ensureDefaultsForOrg(organizationId, userId);

  const result = await pool.query(
    `SELECT role, COUNT(*)::int AS permission_count, MAX(updated_at) AS last_modified
     FROM donation_role_permissions
     WHERE organization_id = $1
     GROUP BY role`,
    [organizationId]
  );

  const byRole = {};
  result.rows.forEach(r => { byRole[r.role] = r; });

  return ALL_ROLES.map(role => ({
    role,
    permission_count: byRole[role]?.permission_count ?? 0,
    last_modified: byRole[role]?.last_modified ?? null,
  }));
}

async function getRolePermissionMatrix(organizationId, role, userId) {
  await ensureDefaultsForOrg(organizationId, userId);

  const result = await pool.query(
    `SELECT permission FROM donation_role_permissions WHERE organization_id = $1 AND role = $2`,
    [organizationId, role]
  );
  const granted = new Set(result.rows.map(r => r.permission));

  return ALL_PERMISSIONS.map(permission => ({
    permission,
    granted: granted.has(permission),
  }));
}

// Replaces the full permission set for one role in one org. Runs as a
// transaction: delete then re-insert, so a partial write never leaves the
// role with a mixed old/new state.
async function updateRolePermissions(organizationId, role, permissions, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM donation_role_permissions WHERE organization_id = $1 AND role = $2`,
      [organizationId, role]
    );

    for (const permission of permissions) {
      if (!ALL_PERMISSIONS.includes(permission)) continue; // ignore unknown permission keys
      await client.query(
        `INSERT INTO donation_role_permissions (organization_id, role, permission, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $4)`,
        [organizationId, role, permission, userId]
      );
    }

    await client.query('COMMIT');
    return getRolePermissionMatrix(organizationId, role, userId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* ---------- Payment Channels ---------- */

async function getPaymentChannels(organizationId) {
  const result = await pool.query(
    `SELECT channel, is_active FROM donation_payment_channels WHERE organization_id = $1`,
    [organizationId]
  );
  const byChannel = {};
  result.rows.forEach(r => { byChannel[r.channel] = r.is_active; });

  // Any channel with no row yet defaults to active=true — matches the
  // behavior donations already had before this table existed (all 6
  // channels accepted).
  return ALL_CHANNELS.map(channel => ({
    channel,
    is_active: byChannel[channel] ?? true,
  }));
}

async function updatePaymentChannels(organizationId, channels, userId) {
  for (const { channel, is_active } of channels) {
    if (!ALL_CHANNELS.includes(channel)) continue;
    await pool.query(
      `INSERT INTO donation_payment_channels (organization_id, channel, is_active, updated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id, channel)
       DO UPDATE SET is_active = $3, updated_by = $4, updated_at = now()`,
      [organizationId, channel, is_active, userId]
    );
  }
  return getPaymentChannels(organizationId);
}

// Used by donations.js at donation-creation time to enforce the toggle
// server-side, not just hide it in the UI.
async function isChannelActive(organizationId, channel) {
  const result = await pool.query(
    `SELECT is_active FROM donation_payment_channels WHERE organization_id = $1 AND channel = $2`,
    [organizationId, channel]
  );
  if (result.rows.length === 0) return true; // no row yet = default active
  return result.rows[0].is_active;
}

/* ---------- Receipt Settings ---------- */

async function getReceiptSettings(organizationId) {
  const result = await pool.query(
    `SELECT prefix, next_sequence FROM donation_receipt_settings WHERE organization_id = $1`,
    [organizationId]
  );
  if (result.rows.length > 0) return result.rows[0];

  // Lazily create the default row on first read for orgs that predate
  // this table (same pattern as ensureDefaultsForOrg above).
  const inserted = await pool.query(
    `INSERT INTO donation_receipt_settings (organization_id, prefix, next_sequence)
     VALUES ($1, 'RCPT-', 1)
     ON CONFLICT (organization_id) DO NOTHING
     RETURNING prefix, next_sequence`,
    [organizationId]
  );
  if (inserted.rows.length > 0) return inserted.rows[0];

  // Race: another request inserted it between our SELECT and INSERT.
  const retry = await pool.query(
    `SELECT prefix, next_sequence FROM donation_receipt_settings WHERE organization_id = $1`,
    [organizationId]
  );
  return retry.rows[0];
}

async function updateReceiptPrefix(organizationId, prefix, userId) {
  await getReceiptSettings(organizationId); // ensures a row exists first
  const result = await pool.query(
    `UPDATE donation_receipt_settings SET prefix = $1, updated_by = $2, updated_at = now()
     WHERE organization_id = $3
     RETURNING prefix, next_sequence`,
    [prefix, userId, organizationId]
  );
  return result.rows[0];
}

// Must be called with a client that is inside an active transaction
// (see receipts.js Step 10) — locks the settings row so two simultaneous
// receipt creations can never get the same sequence number.
async function getAndIncrementSequence(client, organizationId) {
  await client.query(
    `INSERT INTO donation_receipt_settings (organization_id, prefix, next_sequence)
     VALUES ($1, 'RCPT-', 1)
     ON CONFLICT (organization_id) DO NOTHING`,
    [organizationId]
  );

  const result = await client.query(
    `SELECT prefix, next_sequence FROM donation_receipt_settings
     WHERE organization_id = $1 FOR UPDATE`,
    [organizationId]
  );
  const { prefix, next_sequence } = result.rows[0];

  await client.query(
    `UPDATE donation_receipt_settings SET next_sequence = next_sequence + 1, updated_at = now()
     WHERE organization_id = $1`,
    [organizationId]
  );

  return { prefix, sequence: next_sequence };
}

module.exports = {
  ALL_PERMISSIONS,
  ALL_ROLES,
  ALL_CHANNELS,
  ensureDefaultsForOrg,
  getRolesSummary,
  getRolePermissionMatrix,
  updateRolePermissions,
  getPaymentChannels,
  updatePaymentChannels,
  isChannelActive,
  getReceiptSettings,
  updateReceiptPrefix,
  getAndIncrementSequence,
};