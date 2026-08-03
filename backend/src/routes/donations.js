const express = require('express');
const { requirePermission } = require('../middleware/requirePermission');
const donationRepository = require('../repositories/donationRepository');
const donorRepository = require('../repositories/donorRepository');
const { createDonationSchema } = require('../validators/donationSchema');

const router = express.Router();

// POST /api/donations — donation.create
router.post('/', requirePermission('donation.create'), async (req, res, next) => {
  try {
    const parsed = createDonationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: { code: 'VALIDATION_FAILED', fields: parsed.error.flatten() } });
    }

    // donor_id must exist IN THIS ORGANIZATION — cross-tenant references
    // resolve to 404, not a confirming 400/403 (see THREAT_MODEL.md: IDOR).
    const donor = await donorRepository.findById(req.auth.organization_id, parsed.data.donor_id);
    if (!donor) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'donor_id not found in your organization' } });
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
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.page_size, 10) || 20;
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
      // Distinguish not-found vs invalid-transition for a clean error message
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

module.exports = router;
