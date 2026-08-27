const { pool } = require('../db');

// Case-insensitive lookup — matches the ux_users_email_lower unique index
// added in migration 011. Returns the full row (including password_hash)
// because this is only ever used internally by the login flow, which
// verifies the hash and then discards it before responding.
async function findByEmail(email) {
  const result = await pool.query(
    `SELECT * FROM users WHERE lower(email) = lower($1)`,
    [email]
  );
  return result.rows[0] || null;
}

async function findById(userId) {
  const result = await pool.query(
    `SELECT * FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

// Strips password_hash before a user record ever leaves the backend —
// used by both the login response and GET /api/auth/me so there is one
// place responsible for that redaction.
function toSafeUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

module.exports = { findByEmail, findById, toSafeUser };
