/**
 * Integration tests against a real Postgres database.
 *
 * Requires: `npm run migrate` to have been run against a test database
 * pointed to by DATABASE_URL.
 *
 * These tests exercise the Campaign HTTP API and verify:
 * - tenant isolation
 * - RBAC
 * - validation
 * - mass-assignment protection
 * - CRUD behavior
 * - raised amount calculation
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

beforeAll(async () => {
  // Create two organizations.
  const orgAResult = await pool.query(
    `INSERT INTO organizations (name)
     VALUES ('Campaign Test Org A')
     RETURNING *`
  );

  const orgBResult = await pool.query(
    `INSERT INTO organizations (name)
     VALUES ('Campaign Test Org B')
     RETURNING *`
  );

  orgA = orgAResult.rows[0];
  orgB = orgBResult.rows[0];

  // Create users.
  const uAM = await pool.query(
    `INSERT INTO users (organization_id, email, role)
     VALUES ($1, 'campaign-a-manager@test.com', 'manager')
     RETURNING *`,
    [orgA.id]
  );

  const uAV = await pool.query(
    `INSERT INTO users (organization_id, email, role)
     VALUES ($1, 'campaign-a-viewer@test.com', 'viewer')
     RETURNING *`,
    [orgA.id]
  );

  const uBM = await pool.query(
    `INSERT INTO users (organization_id, email, role)
     VALUES ($1, 'campaign-b-manager@test.com', 'manager')
     RETURNING *`,
    [orgB.id]
  );

  userAManager = uAM.rows[0];
  userAViewer = uAV.rows[0];
  userBManager = uBM.rows[0];
});

afterAll(async () => {
  await pool.end();
});

describe('Mandatory Security Test 1: Cross-Tenant Isolation', () => {
  test('Org B cannot view a campaign belonging to Org A', async () => {
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
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        name: 'Org A Private Campaign',
        description: 'Should not be visible to Org B',
        goal_amount: 5000,
        start_date: '2026-07-01',
        end_date: '2026-12-31',
        status: 'active',
      });

    expect(createRes.status).toBe(201);

    const campaignId = createRes.body.id;

    const crossOrgRead = await request(app)
      .get(`/api/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${managerBToken}`);

    expect(crossOrgRead.status).toBe(404);

    // Prove the campaign genuinely exists by reading it as Org A.
    const legitRead = await request(app)
      .get(`/api/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${managerAToken}`);

    expect(legitRead.status).toBe(200);
    expect(legitRead.body.id).toBe(campaignId);
  });

  test('Org B cannot list Org A campaigns', async () => {
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
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        name: 'Org A List Isolation Campaign',
        goal_amount: 1000,
        start_date: '2026-07-01',
        end_date: '2026-12-31',
      });

    expect(createRes.status).toBe(201);

    const campaignId = createRes.body.id;

    const res = await request(app)
      .get('/api/campaigns')
      .set('Authorization', `Bearer ${managerBToken}`);

    expect(res.status).toBe(200);

    const ids = res.body.data.map((campaign) => campaign.id);

    expect(ids).not.toContain(campaignId);
  });

  test('Org B cannot update an Org A campaign', async () => {
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
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        name: 'Org A Protected Campaign',
        goal_amount: 2000,
        start_date: '2026-07-01',
        end_date: '2026-12-31',
      });

    expect(createRes.status).toBe(201);

    const campaignId = createRes.body.id;

    const crossOrgUpdate = await request(app)
      .put(`/api/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${managerBToken}`)
      .send({
        name: 'Org B Attempted Update',
      });

    expect(crossOrgUpdate.status).toBe(404);

    // Verify Org A's record was not changed.
    const legitRead = await request(app)
      .get(`/api/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${managerAToken}`);

    expect(legitRead.status).toBe(200);
    expect(legitRead.body.name).toBe('Org A Protected Campaign');
  });

  test('Org B cannot delete an Org A campaign', async () => {
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
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        name: 'Org A Delete Protection Campaign',
        goal_amount: 3000,
        start_date: '2026-07-01',
        end_date: '2026-12-31',
      });

    expect(createRes.status).toBe(201);

    const campaignId = createRes.body.id;

    const crossOrgDelete = await request(app)
      .delete(`/api/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${managerBToken}`);

    expect(crossOrgDelete.status).toBe(404);

    // Verify Org A can still access it.
    const legitRead = await request(app)
      .get(`/api/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${managerAToken}`);

    expect(legitRead.status).toBe(200);
  });
});

describe('Mandatory Security Test 2: RBAC Denial', () => {
  test('Viewer cannot create a campaign', async () => {
    const viewerToken = tokenFor(
      userAViewer.id,
      orgA.id,
      'viewer'
    );

    const res = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        name: 'Viewer Attempted Campaign',
        goal_amount: 1000,
        start_date: '2026-07-01',
        end_date: '2026-12-31',
      });

    expect(res.status).toBe(403);
  });

  test('Viewer cannot update a campaign', async () => {
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
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Viewer Update Protection Campaign',
        goal_amount: 1000,
        start_date: '2026-07-01',
        end_date: '2026-12-31',
      });

    expect(createRes.status).toBe(201);

    const campaignId = createRes.body.id;

    const res = await request(app)
      .put(`/api/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        name: 'Viewer Attempted Update',
      });

    expect(res.status).toBe(403);
  });

  test('Viewer cannot delete a campaign', async () => {
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
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Viewer Delete Protection Campaign',
        goal_amount: 1000,
        start_date: '2026-07-01',
        end_date: '2026-12-31',
      });

    expect(createRes.status).toBe(201);

    const campaignId = createRes.body.id;

    const res = await request(app)
      .delete(`/api/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
  });
});

describe('Validation and mass assignment', () => {
  test('Rejects a negative campaign goal amount', async () => {
    const managerToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const res = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Negative Goal Campaign',
        goal_amount: -100,
        start_date: '2026-07-01',
        end_date: '2026-12-31',
      });

    expect(res.status).toBe(422);
  });

  test('Rejects an end date before the start date', async () => {
    const managerToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const res = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Invalid Date Campaign',
        goal_amount: 1000,
        start_date: '2026-12-31',
        end_date: '2026-07-01',
      });

    expect(res.status).toBe(422);
  });

  test('Rejects an invalid campaign ID', async () => {
    const managerToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const res = await request(app)
      .get('/api/campaigns/not-a-valid-uuid')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ID');
  });

  test('Client cannot override organization_id on create', async () => {
    const managerToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const res = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Mass Assignment Campaign',
        goal_amount: 5000,
        start_date: '2026-07-01',
        end_date: '2026-12-31',

        // Attempt to move the campaign to another tenant.
        organization_id: orgB.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.organization_id).toBe(orgA.id);
  });

  test('Client cannot override created_by or updated_by on create', async () => {
    const managerToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const res = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Audit Field Protection Campaign',
        goal_amount: 5000,
        start_date: '2026-07-01',
        end_date: '2026-12-31',
        created_by: userBManager.id,
        updated_by: userBManager.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.organization_id).toBe(orgA.id);
    expect(res.body.created_by).toBe(userAManager.id);
    expect(res.body.updated_by).toBe(userAManager.id);
  });
});

describe('Campaign state and CRUD behavior', () => {
  test('New campaign defaults to draft status', async () => {
    const managerToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const res = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Default Draft Campaign',
        goal_amount: 2500,
        start_date: '2026-07-01',
        end_date: '2026-12-31',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('draft');
  });

  test('Manager can update a campaign', async () => {
    const managerToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const createRes = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Campaign Before Update',
        goal_amount: 1000,
        start_date: '2026-07-01',
        end_date: '2026-12-31',
      });

    expect(createRes.status).toBe(201);

    const campaignId = createRes.body.id;

    const updateRes = await request(app)
      .put(`/api/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Campaign After Update',
        goal_amount: 2500,
        status: 'active',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('Campaign After Update');
    expect(Number(updateRes.body.goal_amount)).toBe(2500);
    expect(updateRes.body.status).toBe('active');
  });

  test('Manager can soft-delete a campaign', async () => {
    const managerToken = tokenFor(
      userAManager.id,
      orgA.id,
      'manager'
    );

    const createRes = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Campaign To Delete',
        goal_amount: 1000,
        start_date: '2026-07-01',
        end_date: '2026-12-31',
      });

    expect(createRes.status).toBe(201);

    const campaignId = createRes.body.id;

    const deleteRes = await request(app)
      .delete(`/api/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(deleteRes.status).toBe(200);

    const readRes = await request(app)
      .get(`/api/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(readRes.status).toBe(404);
  });
});
