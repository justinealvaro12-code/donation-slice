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

let orgA, orgB;
let userAManager, userAViewer, userBManager;
let donorA, donorB;

beforeAll(async () => {
  const orgAResult = await pool.query(
    `INSERT INTO organizations (name) VALUES ('Pledge Test Org A') RETURNING *`
  );
  const orgBResult = await pool.query(
    `INSERT INTO organizations (name) VALUES ('Pledge Test Org B') RETURNING *`
  );

  orgA = orgAResult.rows[0];
  orgB = orgBResult.rows[0];

  const uAM = await pool.query(
    `INSERT INTO users (organization_id, email, role)
     VALUES ($1, 'pledge-a-manager@test.com', 'manager')
     RETURNING *`,
    [orgA.id]
  );

  const uAV = await pool.query(
    `INSERT INTO users (organization_id, email, role)
     VALUES ($1, 'pledge-a-viewer@test.com', 'viewer')
     RETURNING *`,
    [orgA.id]
  );

  const uBM = await pool.query(
    `INSERT INTO users (organization_id, email, role)
     VALUES ($1, 'pledge-b-manager@test.com', 'manager')
     RETURNING *`,
    [orgB.id]
  );

  userAManager = uAM.rows[0];
  userAViewer = uAV.rows[0];
  userBManager = uBM.rows[0];

  const dA = await pool.query(
    `INSERT INTO donation_donors
       (organization_id, donor_type, display_name, created_by, updated_by)
     VALUES ($1, 'individual', 'Pledge Donor A', $2, $2)
     RETURNING *`,
    [orgA.id, userAManager.id]
  );

  const dB = await pool.query(
    `INSERT INTO donation_donors
       (organization_id, donor_type, display_name, created_by, updated_by)
     VALUES ($1, 'individual', 'Pledge Donor B', $2, $2)
     RETURNING *`,
    [orgB.id, userBManager.id]
  );

  donorA = dA.rows[0];
  donorB = dB.rows[0];
});

afterAll(async () => {
  await pool.end();
});

describe('Mandatory Security Test 1: Cross-Tenant Isolation', () => {
  test('Org B cannot view a pledge belonging to Org A', async () => {
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

    const createRes = await request(app)
      .post('/api/pledges')
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        donor_id: donorA.id,
        amount_pledged: 500,
        pledge_date: '2026-07-19',
      });

    expect(createRes.status).toBe(201);

    const pledgeId = createRes.body.id;

    const crossOrgRead = await request(app)
      .get(`/api/pledges/${pledgeId}`)
      .set('Authorization', `Bearer ${managerBToken}`);

    expect(crossOrgRead.status).toBe(404);
  });

  test('Org B cannot list Org A pledges', async () => {
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

    const createRes = await request(app)
      .post('/api/pledges')
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        donor_id: donorA.id,
        amount_pledged: 750,
        pledge_date: '2026-07-19',
      });

    expect(createRes.status).toBe(201);

    const pledgeId = createRes.body.id;

    const listRes = await request(app)
      .get('/api/pledges')
      .set('Authorization', `Bearer ${managerBToken}`);

    expect(listRes.status).toBe(200);

    const ids = listRes.body.data.map((p) => p.id);

    expect(ids).not.toContain(pledgeId);
  });

  test('Org B cannot update an Org A pledge', async () => {
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

    const createRes = await request(app)
      .post('/api/pledges')
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        donor_id: donorA.id,
        amount_pledged: 900,
        pledge_date: '2026-07-19',
      });

    expect(createRes.status).toBe(201);

    const pledgeId = createRes.body.id;

    const updateRes = await request(app)
      .put(`/api/pledges/${pledgeId}`)
      .set('Authorization', `Bearer ${managerBToken}`)
      .send({
        amount_pledged: 9999,
      });

    expect(updateRes.status).toBe(404);
  });
});

describe('Mandatory Security Test 2: RBAC Denial', () => {
  test('Viewer cannot create a pledge', async () => {
    const viewerToken = tokenFor(
      userAViewer.id,
      orgA.id,
      'viewer'
    );

    const res = await request(app)
      .post('/api/pledges')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        donor_id: donorA.id,
        amount_pledged: 100,
        pledge_date: '2026-07-19',
      });

    expect(res.status).toBe(403);
  });

  test('Viewer cannot update a pledge', async () => {
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

    const createRes = await request(app)
      .post('/api/pledges')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        donor_id: donorA.id,
        amount_pledged: 300,
        pledge_date: '2026-07-19',
      });

    expect(createRes.status).toBe(201);

    const pledgeId = createRes.body.id;

    const updateRes = await request(app)
      .put(`/api/pledges/${pledgeId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        amount_pledged: 999,
      });

    expect(updateRes.status).toBe(403);
  });

  test('Viewer cannot delete a pledge', async () => {
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

    const createRes = await request(app)
      .post('/api/pledges')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        donor_id: donorA.id,
        amount_pledged: 400,
        pledge_date: '2026-07-19',
      });

    expect(createRes.status).toBe(201);

    const pledgeId = createRes.body.id;

    const deleteRes = await request(app)
      .delete(`/api/pledges/${pledgeId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(deleteRes.status).toBe(403);
  });
});

describe('Validation and mass assignment', () => {
  test('Rejects a negative pledged amount', async () => {
    const managerToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const res = await request(app)
      .post('/api/pledges')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        donor_id: donorA.id,
        amount_pledged: -100,
        pledge_date: '2026-07-19',
      });

    expect(res.status).toBe(422);
  });

  test('Rejects a due date before pledge date', async () => {
    const managerToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const res = await request(app)
      .post('/api/pledges')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        donor_id: donorA.id,
        amount_pledged: 100,
        pledge_date: '2026-07-20',
        due_date: '2026-07-19',
      });

    expect(res.status).toBe(422);
  });

  test('Rejects an invalid donor UUID', async () => {
    const managerToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const res = await request(app)
      .post('/api/pledges')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        donor_id: 'not-a-uuid',
        amount_pledged: 100,
        pledge_date: '2026-07-19',
      });

    expect(res.status).toBe(422);
  });

  test('Client cannot set amount_fulfilled or status', async () => {
    const managerToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const res = await request(app)
      .post('/api/pledges')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        donor_id: donorA.id,
        amount_pledged: 600,
        pledge_date: '2026-07-19',
        amount_fulfilled: 600,
        status: 'fulfilled',
      });

    expect(res.status).toBe(201);

    expect(res.body.amount_fulfilled).toBe(0);
    expect(res.body.status).toBe('pledged');
  });

  test('Cannot create a pledge using a donor from another organization', async () => {
    const managerAToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const res = await request(app)
      .post('/api/pledges')
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        donor_id: donorB.id,
        amount_pledged: 100,
        pledge_date: '2026-07-19',
      });

    expect(res.status).toBe(404);
  });
});

describe('Pledge state and summary', () => {
  test('New pledge starts as pledged with zero fulfillment', async () => {
    const managerToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const res = await request(app)
      .post('/api/pledges')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        donor_id: donorA.id,
        amount_pledged: 1000,
        pledge_date: '2026-07-19',
      });

    expect(res.status).toBe(201);
    expect(res.body.amount_fulfilled).toBe(0);
    expect(res.body.status).toBe('pledged');
  });

  test('Summary endpoint is tenant-isolated', async () => {
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

    const createRes = await request(app)
      .post('/api/pledges')
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        donor_id: donorA.id,
        amount_pledged: 1234,
        pledge_date: '2026-07-19',
      });

    expect(createRes.status).toBe(201);

    const summaryB = await request(app)
      .get('/api/pledges/summary')
      .set('Authorization', `Bearer ${managerBToken}`);

    expect(summaryB.status).toBe(200);
    expect(Number(summaryB.body.total_outstanding)).toBe(0);
  });
});
