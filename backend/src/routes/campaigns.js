const express = require('express');
const { requirePermission } = require('../middleware/requirePermission');
const campaignRepository = require('../repositories/campaignRepository');
const { createCampaignSchema, updateCampaignSchema } = require('../validators/campaignSchema');

const router = express.Router();

router.param('id', (req, res, next, id) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Campaign ID must be a valid UUID' } });
  }
  next();
});

// POST /api/campaigns — campaign.create
router.post('/', requirePermission('campaign.create'), async (req, res, next) => {
  try {
    const parsed = createCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const firstMessage = Object.values(flat.fieldErrors).flat()[0] || flat.formErrors[0] || 'Invalid request';
      return res.status(422).json({
        error: { code: 'VALIDATION_FAILED', message: firstMessage, fields: flat },
      });
    }
    const campaign = await campaignRepository.create(req.auth.organization_id, req.auth.user_id, parsed.data);
    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
});

// GET /api/campaigns — campaign.view
router.get('/', requirePermission('campaign.view'), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size, 10) || 20));
    const campaigns = await campaignRepository.list(req.auth.organization_id, {
      page,
      pageSize,
      status: req.query.status,
      search: req.query.search,
    });
    res.status(200).json({ data: campaigns, page, page_size: pageSize });
  } catch (err) {
    next(err);
  }
});

// GET /api/campaigns/:id — campaign.view
router.get('/:id', requirePermission('campaign.view'), async (req, res, next) => {
  try {
    const campaign = await campaignRepository.findById(req.auth.organization_id, req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }
    res.status(200).json(campaign);
  } catch (err) {
    next(err);
  }
});

// PUT /api/campaigns/:id — campaign.update
router.put('/:id', requirePermission('campaign.update'), async (req, res, next) => {
  try {
    const parsed = updateCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const firstMessage = Object.values(flat.fieldErrors).flat()[0] || 'Invalid request';
      return res.status(422).json({
        error: { code: 'VALIDATION_FAILED', message: firstMessage, fields: flat },
      });
    }
    const updated = await campaignRepository.update(req.auth.organization_id, req.auth.user_id, req.params.id, parsed.data);
    if (!updated) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/campaigns/:id — campaign.delete (soft delete)
router.delete('/:id', requirePermission('campaign.delete'), async (req, res, next) => {
  try {
    const campaign = await campaignRepository.softDelete(req.auth.organization_id, req.auth.user_id, req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }
    res.status(200).json(campaign);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
