require('dotenv').config();
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const ROLES = ['viewer', 'fundraising_staff', 'finance_staff', 'manager', 'administrator'];

async function seed() {
  const orgA = await pool.query(`INSERT INTO organizations (name) VALUES ('Org A Non-Profit') RETURNING *`);
  const orgB = await pool.query(`INSERT INTO organizations (name) VALUES ('Org B Non-Profit') RETURNING *`);

  const tokens = {};

  for (const [label, org] of [['orgA', orgA.rows[0]], ['orgB', orgB.rows[0]]]) {
    for (const role of ROLES) {
      const userResult = await pool.query(
        `INSERT INTO users (organization_id, email, role) VALUES ($1, $2, $3) RETURNING *`,
        [org.id, `${role}@${label}.example.com`, role]
      );
      const user = userResult.rows[0];

      const token = jwt.sign(
        { sub: user.id, organization_id: org.id, role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      tokens[`${label}_${role}`] = token;
    }
  }

  // One sample donor per org, created_by/updated_by stamped with that org's manager
  const orgAManager = await pool.query(`SELECT id FROM users WHERE organization_id = $1 AND role = 'manager'`, [orgA.rows[0].id]);
  const orgBManager = await pool.query(`SELECT id FROM users WHERE organization_id = $1 AND role = 'manager'`, [orgB.rows[0].id]);

  const donorA = await pool.query(
    `INSERT INTO donors (organization_id, donor_type, display_name, email, created_by, updated_by)
     VALUES ($1, 'individual', 'Alice Donor (Org A)', 'alice@example.com', $2, $2) RETURNING *`,
    [orgA.rows[0].id, orgAManager.rows[0].id]
  );
  const donorB = await pool.query(
    `INSERT INTO donors (organization_id, donor_type, display_name, email, created_by, updated_by)
     VALUES ($1, 'individual', 'Bob Donor (Org B)', 'bob@example.com', $2, $2) RETURNING *`,
    [orgB.rows[0].id, orgBManager.rows[0].id]
  );

  console.log('\n=== Seed complete ===\n');
  console.log('Org A id:', orgA.rows[0].id, '| Donor A id:', donorA.rows[0].id);
  console.log('Org B id:', orgB.rows[0].id, '| Donor B id:', donorB.rows[0].id);
  console.log('\n=== JWTs (use as: Authorization: Bearer <token>) ===\n');
  for (const [key, token] of Object.entries(tokens)) {
    console.log(`${key}:\n${token}\n`);
  }

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
