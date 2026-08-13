/**
 * Integration tests for the Receipts API.
 *
 * Requires: npm run migrate
 * Uses the DATABASE_URL configured for the test environment.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { createApp } = require('../src/app');
const { pool } = require('../src/db');

const app = createApp();

function tokenFor(userId, organizationId, role) {
  return jwt.sign(
    {
      sub: userId,
      organization_id: organizationId,
      role,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

let orgA;
let orgB;
let userAManager;
let userAViewer;
let userBManager;
let donorA;
let donorB;

beforeAll(async () => {
  const orgAResult = await pool.query(
    `INSERT INTO organizations (name)
     VALUES ('Receipt Test Org A')
     RETURNING *`
  );

  const orgBResult = await pool.query(
    `INSERT INTO organizations (name)
     VALUES ('Receipt Test Org B')
     RETURNING *`
  );

  orgA = orgAResult.rows[0];
  orgB = orgBResult.rows[0];

  const managerAResult = await pool.query(
    `INSERT INTO users (organization_id, email, role)
     VALUES ($1, 'receipt-manager-a@test.com', 'manager')
     RETURNING *`,
    [orgA.id]
  );

  const viewerAResult = await pool.query(
    `INSERT INTO users (organization_id, email, role)
     VALUES ($1, 'receipt-viewer-a@test.com', 'viewer')
     RETURNING *`,
    [orgA.id]
  );

  const managerBResult = await pool.query(
    `INSERT INTO users (organization_id, email, role)
     VALUES ($1, 'receipt-manager-b@test.com', 'manager')
     RETURNING *`,
    [orgB.id]
  );

  userAManager = managerAResult.rows[0];
  userAViewer = viewerAResult.rows[0];
  userBManager = managerBResult.rows[0];

  const donorAResult = await pool.query(
    `INSERT INTO donation_donors
       (organization_id, donor_type, display_name, created_by, updated_by)
     VALUES ($1, 'individual', 'Receipt Donor A', $2, $2)
     RETURNING *`,
    [orgA.id, userAManager.id]
  );

  const donorBResult = await pool.query(
    `INSERT INTO donation_donors
       (organization_id, donor_type, display_name, created_by, updated_by)
     VALUES ($1, 'individual', 'Receipt Donor B', $2, $2)
     RETURNING *`,
    [orgB.id, userBManager.id]
  );

  donorA = donorAResult.rows[0];
  donorB = donorBResult.rows[0];
});

afterAll(async () => {
  await pool.end();
});

describe('Receipt API', () => {
  test('Viewer can list receipts', async () => {
    const viewerToken = tokenFor(
      userAViewer.id,
      orgA.id,
      'viewer'
    );

    const res = await request(app)
      .get('/api/receipts')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('Viewer cannot create a receipt', async () => {
    const managerToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const viewerToken = tokenFor(
      userAViewer.id,
      orgA.id,
      'viewer'
    );

    const donationRes = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        donor_id: donorA.id,
        amount: 100,
        payment_channel: 'cash',
        donation_date: '2026-07-19',
      });

    expect(donationRes.status).toBe(201);

    const receiptRes = await request(app)
      .post('/api/receipts')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        donation_id: donationRes.body.id,
      });

    expect(receiptRes.status).toBe(403);
  });

  test('Cannot create a receipt for a pending donation', async () => {
    const managerToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const donationRes = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        donor_id: donorA.id,
        amount: 125,
        payment_channel: 'cash',
        donation_date: '2026-07-19',
      });

    expect(donationRes.status).toBe(201);

    const receiptRes = await request(app)
      .post('/api/receipts')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        donation_id: donationRes.body.id,
      });

    expect(receiptRes.status).toBe(400);
    expect(receiptRes.body.error.code).toBe('INVALID_STATUS');
  });

  test('Confirmed donation can receive a receipt', async () => {
    const managerToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const donationRes = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        donor_id: donorA.id,
        amount: 250,
        payment_channel: 'bank_transfer',
        donation_date: '2026-07-19',
      });

    expect(donationRes.status).toBe(201);

    const donationId = donationRes.body.id;

    const confirmRes = await request(app)
      .post(`/api/donations/${donationId}/confirm`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(confirmRes.status).toBe(200);

    /*
     * The donation confirmation flow already issues a receipt.
     * Verify that receipt exists and is accessible through /api/receipts.
     */
    const receiptsRes = await request(app)
      .get('/api/receipts')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(receiptsRes.status).toBe(200);

    const receipt = receiptsRes.body.data.find(
      (item) => item.donation_id === donationId
    );

    expect(receipt).toBeDefined();
    expect(receipt.status).toBe('issued');
    expect(receipt.amount).toBeDefined();
  });

  test('Cannot create a duplicate receipt for the same donation', async () => {
    const managerToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const donationRes = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        donor_id: donorA.id,
        amount: 300,
        payment_channel: 'cash',
        donation_date: '2026-07-19',
      });

    expect(donationRes.status).toBe(201);

    const donationId = donationRes.body.id;

    const confirmRes = await request(app)
      .post(`/api/donations/${donationId}/confirm`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(confirmRes.status).toBe(200);

    /*
     * Confirmation already created the receipt.
     * A second manual receipt creation must be rejected.
     */
    const duplicateRes = await request(app)
      .post('/api/receipts')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        donation_id: donationId,
      });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.error.code).toBe('ALREADY_EXISTS');
  });

  test('Organization B cannot access Organization A receipt', async () => {
    const managerAToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const managerBToken = tokenFor(
      userBManager.id,
      orgB.id,
      'manager'
    );

    const donationRes = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        donor_id: donorA.id,
        amount: 400,
        payment_channel: 'cash',
        donation_date: '2026-07-19',
      });

    expect(donationRes.status).toBe(201);

    const donationId = donationRes.body.id;

    const confirmRes = await request(app)
      .post(`/api/donations/${donationId}/confirm`)
      .set('Authorization', `Bearer ${managerAToken}`);

    expect(confirmRes.status).toBe(200);

    const receiptId = confirmRes.body.receipt.id;

    const crossOrgRead = await request(app)
      .get(`/api/receipts/${receiptId}`)
      .set('Authorization', `Bearer ${managerBToken}`);

    expect(crossOrgRead.status).toBe(404);
  });

  test('Organization B receipt list does not contain Organization A receipts', async () => {
    const managerAToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const managerBToken = tokenFor(
      userBManager.id,
      orgB.id,
      'manager'
    );

    const donationRes = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        donor_id: donorA.id,
        amount: 500,
        payment_channel: 'cash',
        donation_date: '2026-07-19',
      });

    expect(donationRes.status).toBe(201);

    const donationId = donationRes.body.id;

    const confirmRes = await request(app)
      .post(`/api/donations/${donationId}/confirm`)
      .set('Authorization', `Bearer ${managerAToken}`);

    expect(confirmRes.status).toBe(200);

    const receiptId = confirmRes.body.receipt.id;

    const receiptsB = await request(app)
      .get('/api/receipts')
      .set('Authorization', `Bearer ${managerBToken}`);

    expect(receiptsB.status).toBe(200);

    const ids = receiptsB.body.data.map((receipt) => receipt.id);

    expect(ids).not.toContain(receiptId);
  });

  test('Missing donation_id is rejected', async () => {
    const managerToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const res = await request(app)
      .post('/api/receipts')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  test('Nonexistent donation cannot receive a receipt', async () => {
    const managerToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const fakeDonationId =
      '00000000-0000-0000-0000-000000000000';

    const res = await request(app)
      .post('/api/receipts')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        donation_id: fakeDonationId,
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('Organization A cannot receipt a donation belonging to Organization B', async () => {
    const managerAToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const managerBToken = tokenFor(
      userBManager.id,
      orgB.id,
      'manager'
    );

    const donationRes = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${managerBToken}`)
      .send({
        donor_id: donorB.id,
        amount: 600,
        payment_channel: 'cash',
        donation_date: '2026-07-19',
      });

    expect(donationRes.status).toBe(201);

    const donationId = donationRes.body.id;

    const crossOrgReceipt = await request(app)
      .post('/api/receipts')
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        donation_id: donationId,
      });

    expect(crossOrgReceipt.status).toBe(404);
  });
});
