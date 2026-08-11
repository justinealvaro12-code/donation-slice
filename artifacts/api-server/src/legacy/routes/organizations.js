const express = require('express');
const router = express.Router();
const organizationRepository = require('../repositories/organizationRepository');

// GET /api/organizations/me — view your own organization
router.get('/me', async (req, res) => {
  try {
    const org = await organizationRepository.findById(req.auth.organization_id);
    if (!org) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Organization not found' } });
    res.json(org);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch organization' } });
  }
});

// PUT /api/organizations/me — update your own organization
router.put('/me', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'name is required' } });
    const org = await organizationRepository.update(req.auth.organization_id, name);
    if (!org) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Organization not found' } });
    res.json(org);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update organization' } });
  }
});

module.exports = router;