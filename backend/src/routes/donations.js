const express = require('express');
const { requirePermission } = require('../middleware/requirePermission');
const donationRepository = require('../repositories/donationRepository');
const donorRepository = require('../repositories/donorRepository');
const campaignRepository = require('../repositories/campaignRepository');
const pledgeRepository = require('../repositories/pledgeRepository');
const settingsRepository = require('../repositories/settingsRepository');
const { createDonationSchema } = require('../validators/donationSchema');

const router = express.Router();

router.param('id', (req, res, next, id) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Donation ID must be a valid UUID' } });
  }
  next();
});

// POST /api/donations — donation.create
router.post('/', requirePermission('donation.create'), async (req, res, next) => {
  try {
    const parsed = createDonationSchema.safeParse(req.body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const firstMessage = Object.values(flat.fieldErrors).flat()[0] || 'Invalid request';
      return res.status(422).json({
        error: { code: 'VALIDATION_FAILED', message: firstMessage, fields: flat },
      });
    }

    // Channel must be currently active for this org (Settings > Payment
    // Channels). Checked AFTER the zod enum check above, so this only
    // ever rejects a channel that's structurally valid but disabled.
    const channelActive = await settingsRepository.isChannelActive(req.auth.organization_id, parsed.data.payment_channel);
    if (!channelActive) {
      return res.status(422).json({
        error: { code: 'CHANNEL_DISABLED', message: `Payment channel '${parsed.data.payment_channel}' is disabled for your organization` },
      });
    }

    // donor_id must exist IN THIS ORGANIZATION — cross-tenant references
    // resolve to 404, not a confirming 400/403 (see THREAT_MODEL.md: IDOR).
    const donor = await donorRepository.findById(req.auth.organization_id, parsed.data.donor_id);
    if (!donor) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'donor_id not found in your organization' } });
    }
    if (parsed.data.campaign_id) {
      const campaign = await campaignRepository.findById(req.auth.organization_id, parsed.data.campaign_id);
      if (!campaign) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'campaign_id not found in your organization' } });
      }
    }
    if (parsed.data.pledge_id) {
      const pledge = await pledgeRepository.findById(req.auth.organization_id, parsed.data.pledge_id);
      if (!pledge) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'pledge_id not found in your organization' } });
      }
      if (pledge.donor_id !== parsed.data.donor_id) {
        return res.status(422).json({
          error: { code: 'VALIDATION_FAILED', message: 'pledge_id does not belong to the specified donor_id' },
        });
      }
    }
    const donation = await donationRepository.create(req.auth.organization_id, req.auth.user_id, parsed.data);
    res.status(201).json(donation);
  } catch (err) {
    next(err);
  }
});

// GET /api/donations — donation.view
router.get('/', requirePermission('donation.view'), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size, 10) || 20));
    const donations = await donationRepository.list(req.auth.organization_id, {
      page,
      pageSize,
      status: req.query.status,
      donor_id: req.query.donor_id,
    });
    res.status(200).json({ data: donations, page, page_size: pageSize });
  } catch (err) {
    next(err);
  }
});

// GET /api/donations/:id — donation.view
router.get('/:id', requirePermission('donation.view'), async (req, res, next) => {
  try {
    const donation = await donationRepository.findById(req.auth.organization_id, req.params.id);
    if (!donation) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Donation not found' } });
    }
    res.status(200).json(donation);
  } catch (err) {
    next(err);
  }
});

// POST /api/donations/:id/confirm — donation.confirm
router.post('/:id/confirm', requirePermission('donation.confirm'), async (req, res, next) => {
  try {
    const result = await donationRepository.confirm(req.auth.organization_id, req.auth.user_id, req.params.id);

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Donation not found' } });
    }
    if (result.error === 'INVALID_TRANSITION') {
      return res.status(409).json({
        error: { code: 'INVALID_TRANSITION', message: `Cannot confirm a donation with status '${result.currentStatus}'` },
      });
    }

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/donations/:id/void — donation.void
router.post('/:id/void', requirePermission('donation.void'), async (req, res, next) => {
  try {
    const updated = await donationRepository.voidDonation(req.auth.organization_id, req.auth.user_id, req.params.id);

    if (!updated) {
      const existing = await donationRepository.findById(req.auth.organization_id, req.params.id);
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Donation not found' } });
      }
      return res.status(409).json({
        error: { code: 'INVALID_TRANSITION', message: `Cannot void a donation with status '${existing.status}'` },
      });
    }

    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/donations/:id/refund — donation.refund
router.post('/:id/refund', requirePermission('donation.refund'), async (req, res, next) => {
  try {
    const result = await donationRepository.refund(req.auth.organization_id, req.auth.user_id, req.params.id);

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Donation not found' } });
    }
    if (result.error === 'INVALID_TRANSITION') {
      return res.status(409).json({
        error: { code: 'INVALID_TRANSITION', message: `Cannot refund a donation with status '${result.currentStatus}'` },
      });
    }

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/donations/:id — donation.delete (soft delete)
router.delete('/:id', requirePermission('donation.delete'), async (req, res, next) => {
  try {
    const donation = await donationRepository.softDelete(req.auth.organization_id, req.auth.user_id, req.params.id);
    if (!donation) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Donation not found' } });
    }
    res.status(200).json(donation);
  } catch (err) {
    next(err);
  }
});

module.exports = router;