const express = require('express');
const { requirePermission } = require('../middleware/requirePermission');
const donorRepository = require('../repositories/donorRepository');
const { createDonorSchema } = require('../validators/donationSchema');

const router = express.Router();

router.post('/', requirePermission('donor.create'), async (req, res, next) => {
  try {
    const parsed = createDonorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: { code: 'VALIDATION_FAILED', fields: parsed.error.flatten() } });
    }
    const donor = await donorRepository.create(req.auth.organization_id, req.auth.user_id, parsed.data);
    res.status(201).json(donor);
  } catch (err) {
    next(err);
  }
});

router.get('/', requirePermission('donor.view'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.page_size, 10) || 20;
    const donors = await donorRepository.list(req.auth.organization_id, { page, pageSize });
    res.status(200).json({ data: donors, page, page_size: pageSize });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requirePermission('donor.view'), async (req, res, next) => {
  try {
    const donor = await donorRepository.findById(req.auth.organization_id, req.params.id);
    if (!donor) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Donor not found' } });
    }
    res.status(200).json(donor);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
