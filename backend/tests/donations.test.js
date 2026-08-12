/**
 * Integration tests against a real Postgres database.
 *
 * Requires: `npm run migrate` to have been run against a test database
 * pointed to by DATABASE_URL (see README.md — use a dedicated test DB,
 * not your dev DB, since this suite inserts real rows).
 *
 * These tests exercise the app the same way a real client would (HTTP
 * request in, HTTP response out) rather than calling repository functions
 * directly, so they actually prove the permission/tenant middleware wiring
 * works — not just that the SQL is correct in isolation.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { createApp } = require('../src/app');
const { pool } = require('../src/db');

const app = createApp();

function tokenFor(userId, organizationId, role) {
  return jwt.sign({ sub: userId, organization_id: organizationId, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

let orgA, orgB, userAManager, userAFinance, userAViewer, userBManager, donorA, donorB;

beforeAll(async () => {
  // Minimal fixture setup, independent of seed.js so this suite is self-contained.
  const orgAResult = await pool.query(`INSERT INTO organizations (name) VALUES ('Test Org A') RETURNING *`);
  const orgBResult = await pool.query(`INSERT INTO organizations (name) VALUES ('Test Org B') RETURNING *`);
  orgA = orgAResult.rows[0];
  orgB = orgBResult.rows[0];

  const uAM = await pool.query(`INSERT INTO users (organization_id, email, role) VALUES ($1, 'a-manager@test.com', 'manager') RETURNING *`, [orgA.id]);
  const uAF = await pool.query(`INSERT INTO users (organization_id, email, role) VALUES ($1, 'a-finance@test.com', 'finance_staff') RETURNING *`, [orgA.id]);
  const uAV = await pool.query(`INSERT INTO users (organization_id, email, role) VALUES ($1, 'a-viewer@test.com', 'viewer') RETURNING *`, [orgA.id]);
  const uBM = await pool.query(`INSERT INTO users (organization_id, email, role) VALUES ($1, 'b-manager@test.com', 'manager') RETURNING *`, [orgB.id]);
  userAManager = uAM.rows[0];
  userAFinance = uAF.rows[0];
  userAViewer = uAV.rows[0];
  userBManager = uBM.rows[0];

  const dA = await pool.query(
    `INSERT INTO donors (organization_id, donor_type, display_name, created_by, updated_by)
     VALUES ($1, 'individual', 'Donor A', $2, $2) RETURNING *`,
    [orgA.id, userAManager.id]
  );
  const dB = await pool.query(
    `INSERT INTO donors (organization_id, donor_type, display_name, created_by, updated_by)
     VALUES ($1, 'individual', 'Donor B', $2, $2) RETURNING *`,
    [orgB.id, userBManager.id]
  );
  donorA = dA.rows[0];
  donorB = dB.rows[0];
});

afterAll(async () => {
  await pool.end();
});

describe('Mandatory Security Test 1: Cross-Tenant Isolation', () => {
  test('Org B cannot view a donation belonging to Org A', async () => {
    const managerAToken = tokenFor(userAManager.id, orgA.id, 'manager');
    const managerBToken = tokenFor(userBManager.id, orgB.id, 'manager');

    const createRes = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        donor_id: donorA.id,
        amount: 100.5,
        payment_channel: 'cash',
        donation_date: '2026-07-19',
      });
    expect(createRes.status).toBe(201);
    const donationId = createRes.body.id;

    const crossOrgRead = await request(app)
      .get(`/api/donations/${donationId}`)
      .set('Authorization', `Bearer ${managerBToken}`);
    expect(crossOrgRead.status).toBe(404);

    const crossOrgConfirm = await request(app)
      .post(`/api/donations/${donationId}/confirm`)
      .set('Authorization', `Bearer ${managerBToken}`);
    expect(crossOrgConfirm.status).toBe(404);

    // Prove it's genuinely inaccessible, not just hidden from GET: confirm
    // from Org A succeeds, proving the record existed and Org B truly never touched it.
    const legitConfirm = await request(app)
      .post(`/api/donations/${donationId}/confirm`)
      .set('Authorization', `Bearer ${managerAToken}`);
    expect(legitConfirm.status).toBe(200);
    expect(legitConfirm.body.donation.status).toBe('confirmed');
  });

  test('Org B cannot list Org A donors', async () => {
    const managerBToken = tokenFor(userBManager.id, orgB.id, 'manager');
    const res = await request(app)
      .get('/api/donors')
      .set('Authorization', `Bearer ${managerBToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.map((d) => d.id);
    expect(ids).not.toContain(donorA.id);
  });
});

describe('Mandatory Security Test 2: RBAC Denial', () => {
  test('Viewer role cannot create a donation (write with view-only role)', async () => {
    const viewerToken = tokenFor(userAViewer.id, orgA.id, 'viewer');

    const res = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        donor_id: donorA.id,
        amount: 50,
        payment_channel: 'cash',
        donation_date: '2026-07-19',
      });

    expect(res.status).toBe(403);
  });

  test('Fundraising-equivalent role (viewer, no confirm permission) cannot confirm a donation', async () => {
    const managerToken = tokenFor(userAManager.id, orgA.id, 'manager');
    const viewerToken = tokenFor(userAViewer.id, orgA.id, 'viewer');

    const createRes = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ donor_id: donorA.id, amount: 75, payment_channel: 'cash', donation_date: '2026-07-19' });
    const donationId = createRes.body.id;

    const res = await request(app)
      .post(`/api/donations/${donationId}/confirm`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);

    // Confirm the denial actually prevented the state change (not just the HTTP response).
    const check = await request(app)
      .get(`/api/donations/${donationId}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(check.body.status).toBe('pending');
  });
});

describe('State machine guards', () => {
  test('Cannot confirm an already-confirmed donation (idempotent transition protection)', async () => {
    const managerToken = tokenFor(userAManager.id, orgA.id, 'manager');

    const createRes = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ donor_id: donorA.id, amount: 30, payment_channel: 'cash', donation_date: '2026-07-19' });
    const donationId = createRes.body.id;

    const first = await request(app).post(`/api/donations/${donationId}/confirm`).set('Authorization', `Bearer ${managerToken}`);
    expect(first.status).toBe(200);

    const second = await request(app).post(`/api/donations/${donationId}/confirm`).set('Authorization', `Bearer ${managerToken}`);
    expect(second.status).toBe(409);
  });

  test('Cannot refund a pending (never-confirmed) donation', async () => {
    const managerToken = tokenFor(userAManager.id, orgA.id, 'manager');

    const createRes = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ donor_id: donorA.id, amount: 20, payment_channel: 'cash', donation_date: '2026-07-19' });
    const donationId = createRes.body.id;

    const res = await request(app).post(`/api/donations/${donationId}/refund`).set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(409);
  });

  test('Confirming a donation issues a receipt in the same response', async () => {
    const managerToken = tokenFor(userAManager.id, orgA.id, 'manager');

    const createRes = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ donor_id: donorA.id, amount: 200, payment_channel: 'bank_transfer', donation_date: '2026-07-19' });
    const donationId = createRes.body.id;

    const confirmRes = await request(app).post(`/api/donations/${donationId}/confirm`).set('Authorization', `Bearer ${managerToken}`);
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.receipt).toBeDefined();
    expect(confirmRes.body.receipt.status).toBe('issued');
  });
});

describe('Validation and mass assignment', () => {
  test('Rejects a negative donation amount', async () => {
    const managerToken = tokenFor(userAManager.id, orgA.id, 'manager');
    const res = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ donor_id: donorA.id, amount: -100, payment_channel: 'cash', donation_date: '2026-07-19' });
    expect(res.status).toBe(422);
  });

  test('Ignores a client-submitted organization_id and status on create', async () => {
    const managerToken = tokenFor(userAManager.id, orgA.id, 'manager');
    const res = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        donor_id: donorA.id,
        amount: 60,
        payment_channel: 'cash',
        donation_date: '2026-07-19',
        organization_id: orgB.id, // attempted tenant reassignment
        status: 'confirmed', // attempted status forgery
      });

    expect(res.status).toBe(201);
    expect(res.body.organization_id).toBe(orgA.id); // token's org wins, not the body's
    expect(res.body.status).toBe('pending'); // forced server default, not client value
  });

  test('Rejects a donation referencing a donor from another organization', async () => {
    const managerAToken = tokenFor(userAManager.id, orgA.id, 'manager');
    const res = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({ donor_id: donorB.id, amount: 10, payment_channel: 'cash', donation_date: '2026-07-19' });

    expect(res.status).toBe(404);
  });
});
