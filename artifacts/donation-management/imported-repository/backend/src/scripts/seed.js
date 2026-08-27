require("dotenv").config();

if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET must be set in environment. Check your .env file.",
  );
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set in environment. Check your .env file.",
  );
}
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const settingsRepository = require("../repositories/settingsRepository");

const ROLES = [
  "viewer",
  "fundraising_staff",
  "finance_staff",
  "manager",
  "administrator",
];
const SEED_ORG_NAMES = ["Org A Non-Profit", "Org B Non-Profit"];

// Development-only credential — every seeded account (both orgs, all
// roles) gets this same password so anyone can log in and try each
// role. Never used outside local/dev seeding, and never hard-coded into
// frontend code.
const DEV_PASSWORD = "ChangeMe123!";

// Matches the mockup: bank_transfer/cash/check/online on by default,
// card/other off.
const DEFAULT_CHANNEL_STATES = [
  { channel: "bank_transfer", is_active: true },
  { channel: "cash", is_active: true },
  { channel: "check", is_active: true },
  { channel: "online", is_active: true },
  { channel: "card", is_active: false },
  { channel: "other", is_active: false },
];

async function reset() {
  const orgs = await pool.query(
    `SELECT id FROM organizations WHERE name = ANY($1)`,
    [SEED_ORG_NAMES],
  );
  const orgIds = orgs.rows.map((r) => r.id);

  if (orgIds.length > 0) {
    await pool.query(
      `DELETE FROM donation_receipts WHERE organization_id = ANY($1)`,
      [orgIds],
    );
    await pool.query(
      `DELETE FROM donation_donations WHERE organization_id = ANY($1)`,
      [orgIds],
    );
    await pool.query(
      `DELETE FROM donation_pledges WHERE organization_id = ANY($1)`,
      [orgIds],
    );
    await pool.query(
      `DELETE FROM donation_campaigns WHERE organization_id = ANY($1)`,
      [orgIds],
    );
    await pool.query(
      `DELETE FROM donation_donors WHERE organization_id = ANY($1)`,
      [orgIds],
    );
    await pool.query(
      `DELETE FROM organization_role_permissions WHERE organization_id = ANY($1)`,
      [orgIds],
    );
    await pool.query(
      `DELETE FROM organization_payment_channels WHERE organization_id = ANY($1)`,
      [orgIds],
    );
    await pool.query(
      `DELETE FROM organization_receipt_settings WHERE organization_id = ANY($1)`,
      [orgIds],
    );
    await pool.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [
      orgIds,
    ]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [orgIds]);
    console.log(
      `Cleared ${orgIds.length} previously seeded organization(s) and their related data.`,
    );
  }
}

async function seed() {
  await reset();

  const orgA = await pool.query(
    `INSERT INTO organizations (name) VALUES ('Org A Non-Profit') RETURNING *`,
  );
  const orgB = await pool.query(
    `INSERT INTO organizations (name) VALUES ('Org B Non-Profit') RETURNING *`,
  );

  const tokens = {};
  const credentials = [];

  // Same salt round count for every seeded user — bcrypt.hash() is run
  // once per user (not shared) so each row gets its own salt even though
  // they all hash the same DEV_PASSWORD.
  const devPasswordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  for (const [label, org] of [
    ["orga", orgA.rows[0]],
    ["orgb", orgB.rows[0]],
  ]) {
    for (const role of ROLES) {
      // Generate a display name from the role (e.g. "administrator" ->
      // "Administrator") — used both as the users.name column and as
      // the JWT's display name claim.
      const displayName = role
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      const email = `${role}@${label}.example.com`;

      const userResult = await pool.query(
        `INSERT INTO users (organization_id, email, role, name, password_hash)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [org.id, email, role, displayName, devPasswordHash],
      );
      const user = userResult.rows[0];

      const token = jwt.sign(
        {
          sub: user.id,
          organization_id: org.id,
          role,
          name: displayName,
          email: user.email,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      );
      tokens[`${label}_${role}`] = token;
      credentials.push({ email, password: DEV_PASSWORD });
    }
  }

  const orgAManager = await pool.query(
    `SELECT id FROM users WHERE organization_id = $1 AND role = 'manager'`,
    [orgA.rows[0].id],
  );
  const orgBManager = await pool.query(
    `SELECT id FROM users WHERE organization_id = $1 AND role = 'manager'`,
    [orgB.rows[0].id],
  );

  // Settings: default role permissions (from ROLE_PERMISSIONS, via
  // ensureDefaultsForOrg) and default payment channel states — same
  // seeding every fresh org gets outside this script too, just done
  // eagerly here instead of on first read.
  for (const [org, manager] of [
    [orgA.rows[0], orgAManager.rows[0]],
    [orgB.rows[0], orgBManager.rows[0]],
  ]) {
    await settingsRepository.ensureDefaultsForOrg(org.id, manager.id);
    await settingsRepository.updatePaymentChannels(
      org.id,
      DEFAULT_CHANNEL_STATES,
      manager.id,
    );
  }

  const donorA = await pool.query(
    `INSERT INTO donation_donors (organization_id, donor_type, display_name, email, created_by, updated_by)
     VALUES ($1, 'individual', 'Alice Donor (Org A)', 'alice@example.com', $2, $2) RETURNING *`,
    [orgA.rows[0].id, orgAManager.rows[0].id],
  );
  const donorB = await pool.query(
    `INSERT INTO donation_donors (organization_id, donor_type, display_name, email, created_by, updated_by)
     VALUES ($1, 'individual', 'Bob Donor (Org B)', 'bob@example.com', $2, $2) RETURNING *`,
    [orgB.rows[0].id, orgBManager.rows[0].id],
  );

  console.log("\n=== Seed complete ===\n");
  console.log("Org A id:", orgA.rows[0].id, "| Donor A id:", donorA.rows[0].id);
  console.log("Org B id:", orgB.rows[0].id, "| Donor B id:", donorB.rows[0].id);
  console.log(
    `\n=== Login credentials (all seeded accounts use password: ${DEV_PASSWORD}) ===\n`,
  );
  for (const { email } of credentials) {
    console.log(`  ${email}`);
  }
  console.log(
    "\nLog in with any of the above emails and the password shown, e.g.:",
  );
  console.log(`  email:    administrator@orga.example.com`);
  console.log(`  password: ${DEV_PASSWORD}`);
  console.log(
    "\n=== Dev JWTs (not needed for normal login; kept for scripting/tests) ===\n",
  );
  for (const [key, token] of Object.entries(tokens)) {
    console.log(`${key}:\n${token}\n`);
  }

  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
