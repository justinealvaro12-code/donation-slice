/**
 * Integration tests for the Reports API.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { createApp } = require('../src/app');
const { pool } = require('../src/db');

const app = createApp();

function tokenFor(userId, organizationId, role) {
  return jwt.sign(
    { sub: userId, organization_id: organizationId, role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

let orgA;
let orgB;
let userAManager;
let userAViewer;
let userBManager;
let campaignA1;
let campaignA2;

beforeAll(async () => {
  const orgARes = await pool.query(
    `INSERT INTO organizations (name) VALUES ('Report Org A') RETURNING *`
  );
  const orgBRes = await pool.query(
    `INSERT INTO organizations (name) VALUES ('Report Org B') RETURNING *`
  );
  orgA = orgARes.rows[0];
  orgB = orgBRes.rows[0];

  const managerARes = await pool.query(
    `INSERT INTO users (organization_id, email, role) VALUES ($1, 'report-mgr-a@test.com', 'manager') RETURNING *`,
    [orgA.id]
  );
  const viewerARes = await pool.query(
    `INSERT INTO users (organization_id, email, role) VALUES ($1, 'report-viewer-a@test.com', 'viewer') RETURNING *`,
    [orgA.id]
  );
  const managerBRes = await pool.query(
    `INSERT INTO users (organization_id, email, role) VALUES ($1, 'report-mgr-b@test.com', 'manager') RETURNING *`,
    [orgB.id]
  );
  userAManager = managerARes.rows[0];
  userAViewer = viewerARes.rows[0];
  userBManager = managerBRes.rows[0];

  const dA1 = await pool.query(
    `INSERT INTO donation_donors (organization_id, donor_type, display_name, created_by, updated_by)
     VALUES ($1, 'individual', 'Donor A1', $2, $2) RETURNING *`,
    [orgA.id, userAManager.id]
  );
  const dA2 = await pool.query(
    `INSERT INTO donation_donors (organization_id, donor_type, display_name, created_by, updated_by)
     VALUES ($1, 'individual', 'Donor A2', $2, $2) RETURNING *`,
    [orgA.id, userAManager.id]
  );
  const dB1 = await pool.query(
    `INSERT INTO donation_donors (organization_id, donor_type, display_name, created_by, updated_by)
     VALUES ($1, 'individual', 'Donor B1', $2, $2) RETURNING *`,
    [orgB.id, userBManager.id]
  );
  const donorA1 = dA1.rows[0];
  const donorA2 = dA2.rows[0];
  const donorB1 = dB1.rows[0];

  /* Create campaigns via API */
  const mgrToken = tokenFor(userAManager.id, orgA.id, 'manager');

  const cA1Res = await request(app)
    .post('/api/campaigns')
    .set('Authorization', `Bearer ${mgrToken}`)
    .send({
      name: 'Campaign A1',
      goal_amount: 10000,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
    });
  expect(cA1Res.status).toBe(201);
  campaignA1 = cA1Res.body;

  const cA2Res = await request(app)
    .post('/api/campaigns')
    .set('Authorization', `Bearer ${mgrToken}`)
    .send({
      name: 'Campaign A2',
      goal_amount: 5000,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
    });
  expect(cA2Res.status).toBe(201);
  campaignA2 = cA2Res.body;

  /* Org A donations */
  await pool.query(
    `INSERT INTO donation_donations
       (organization_id, donor_id, amount, payment_channel, donation_date, status,
        campaign_id, created_by, updated_by, created_at)
     VALUES
       ($1, $2, 100, 'cash', '2026-06-01', 'confirmed', $4, $3, $3, '2026-06-01T00:00:00Z'),
       ($1, $2, 200, 'bank_transfer', '2026-06-15', 'confirmed', $4, $3, $3, '2026-06-15T00:00:00Z'),
       ($1, $5, 300, 'cash', '2026-07-01', 'confirmed', $6, $3, $3, '2026-07-01T00:00:00Z'),
       ($1, $5, 400, 'card', '2026-07-15', 'confirmed', NULL, $3, $3, '2026-07-15T00:00:00Z')`,
    [orgA.id, donorA1.id, userAManager.id, campaignA1.id, donorA2.id, campaignA2.id]
  );

  /* Deleted donation — must be excluded */
  await pool.query(
    `INSERT INTO donation_donations
       (organization_id, donor_id, amount, payment_channel, donation_date, status,
        campaign_id, created_by, updated_by, created_at, deleted_at)
     VALUES
       ($1, $2, 999, 'cash', '2026-07-01', 'confirmed', NULL, $3, $3, '2026-07-01T00:00:00Z', NOW())`,
    [orgA.id, donorA1.id, userAManager.id]
  );

  /* Org B donation */
  await pool.query(
    `INSERT INTO donation_donations
       (organization_id, donor_id, amount, payment_channel, donation_date, status,
        created_by, updated_by, created_at)
     VALUES
       ($1, $2, 500, 'cash', '2026-07-01', 'confirmed', $3, $3, '2026-07-01T00:00:00Z')`,
    [orgB.id, donorB1.id, userBManager.id]
  );

  /* Org A pledges */
  await pool.query(
    `INSERT INTO donation_pledges
       (organization_id, donor_id, amount_pledged, amount_fulfilled, pledge_date,
        created_by, updated_by, created_at)
     VALUES
       ($1, $2, 1000, 200, '2026-06-01', $3, $3, '2026-06-01T00:00:00Z'),
       ($1, $4, 500, 0, '2026-07-01', $3, $3, '2026-07-01T00:00:00Z')`,
    [orgA.id, donorA1.id, userAManager.id, donorA2.id]
  );

  /* Org B pledge */
  await pool.query(
    `INSERT INTO donation_pledges
       (organization_id, donor_id, amount_pledged, amount_fulfilled, pledge_date,
        created_by, updated_by, created_at)
     VALUES
       ($1, $2, 2000, 500, '2026-07-01', $3, $3, '2026-07-01T00:00:00Z')`,
    [orgB.id, donorB1.id, userBManager.id]
  );
}, 30000);

afterAll(async () => {
  await pool.end();
});

describe('Reports API', () => {
  test('Viewer can access summary report', async () => {
    const token = tokenFor(userAViewer.id, orgA.id, 'viewer');
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.totalDonations).toBe(1000);
    expect(res.body.data.donationCount).toBe(4);
    expect(res.body.data.totalPledges).toBe(1500);
    expect(res.body.data.pledgeCount).toBe(2);
    expect(res.body.data.pledgePaid).toBe(200);
    expect(res.body.data.activeDonors).toBe(2);
    expect(res.body.data.pledgeFulfillmentRate).toBe(13);
  });

  test('Manager can access all report endpoints', async () => {
    const token = tokenFor(userAManager.id, orgA.id, 'manager');
    const endpoints = [
      '/api/reports/summary',
      '/api/reports/trends',
      '/api/reports/campaigns',
      '/api/reports/channels',
      '/api/reports/top-donors',
    ];

    for (const endpoint of endpoints) {
      const res = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    }
  });

  test('User without report.view permission is denied', async () => {
    const token = tokenFor(userAManager.id, orgA.id, 'nobody');
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test('Summary is tenant-isolated', async () => {
    const token = tokenFor(userBManager.id, orgB.id, 'manager');
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalDonations).toBe(500);
    expect(res.body.data.donationCount).toBe(1);
    expect(res.body.data.totalPledges).toBe(2000);
    expect(res.body.data.pledgePaid).toBe(500);
  });

  test('Date filtering excludes out-of-range donations', async () => {
    const token = tokenFor(userAManager.id, orgA.id, 'manager');
    const res = await request(app)
      .get('/api/reports/summary?from=2026-07-01&to=2026-07-31')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalDonations).toBe(700);
    expect(res.body.data.donationCount).toBe(2);
  });

  test('Campaign breakdown includes all campaigns and correct totals', async () => {
    const token = tokenFor(userAManager.id, orgA.id, 'manager');
    const res = await request(app)
      .get('/api/reports/campaigns')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    const c1 = res.body.data.find((c) => c.id === campaignA1.id);
    const c2 = res.body.data.find((c) => c.id === campaignA2.id);

    expect(c1).toBeDefined();
    expect(c1.total).toBe(300);
    expect(c1.count).toBe(2);

    expect(c2).toBeDefined();
    expect(c2.total).toBe(300);
    expect(c2.count).toBe(1);
  });

  test('Channel breakdown aggregates by payment channel', async () => {
    const token = tokenFor(userAManager.id, orgA.id, 'manager');
    const res = await request(app)
      .get('/api/reports/channels')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const cash = res.body.data.find((c) => c.channel === 'cash');
    const bank = res.body.data.find((c) => c.channel === 'bank_transfer');
    const cc = res.body.data.find((c) => c.channel === 'card');

    expect(cash).toBeDefined();
    expect(cash.total).toBe(400);
    expect(cash.count).toBe(2);

    expect(bank).toBeDefined();
    expect(bank.total).toBe(200);
    expect(bank.count).toBe(1);

    expect(cc).toBeDefined();
    expect(cc.total).toBe(400);
    expect(cc.count).toBe(1);
  });

  test('Top donors returns correct ranking and respects limit', async () => {
    const token = tokenFor(userAManager.id, orgA.id, 'manager');
    const res = await request(app)
      .get('/api/reports/top-donors?limit=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe('Donor A2');
    expect(res.body.data[0].total).toBe(700);
  });

  test('Monthly trends groups donations by month', async () => {
    const token = tokenFor(userAManager.id, orgA.id, 'manager');
    const res = await request(app)
      .get('/api/reports/trends')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    const june = res.body.data.find((t) => t.month === '2026-06');
    const july = res.body.data.find((t) => t.month === '2026-07');

    expect(june).toBeDefined();
    expect(june.total).toBe(300);
    expect(june.count).toBe(2);

    expect(july).toBeDefined();
    expect(july.total).toBe(700);
    expect(july.count).toBe(2);
  });

  test('Deleted donations are excluded from reports', async () => {
    const token = tokenFor(userAManager.id, orgA.id, 'manager');
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalDonations).toBe(1000);
  });

  test('Organization B reports do not contain Organization A data', async () => {
    const token = tokenFor(userBManager.id, orgB.id, 'manager');

    const [summary, campaigns, channels, topDonors] = await Promise.all([
      request(app).get('/api/reports/summary').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/reports/campaigns').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/reports/channels').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/reports/top-donors').set('Authorization', `Bearer ${token}`),
    ]);

    expect(summary.status).toBe(200);
    expect(summary.body.data.totalDonations).toBe(500);

    expect(campaigns.status).toBe(200);
    const campaignIds = campaigns.body.data.map((c) => c.id);
    expect(campaignIds).not.toContain(campaignA1.id);
    expect(campaignIds).not.toContain(campaignA2.id);

    expect(channels.status).toBe(200);
    expect(channels.body.data.length).toBe(1);
    expect(channels.body.data[0].channel).toBe('cash');

    expect(topDonors.status).toBe(200);
    const names = topDonors.body.data.map((d) => d.name);
    expect(names).not.toContain('Donor A1');
    expect(names).not.toContain('Donor A2');
    expect(names).toContain('Donor B1');
  });
});
