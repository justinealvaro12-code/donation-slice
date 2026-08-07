const express = require('express');
const { requirePermission } = require('../middleware/requirePermission');
const donorRepository = require('../repositories/donorRepository');
const { createDonorSchema } = require('../validators/donationSchema');

const router = express.Router();

// POST /api/donors — donor.create
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

// GET /api/donors — donor.view
router.get('/', requirePermission('donor.view'), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size, 10) || 20));
    const donors = await donorRepository.list(req.auth.organization_id, {
      page,
      pageSize,
      search: req.query.search
    });
    res.status(200).json({ data: donors, page, page_size: pageSize });
  } catch (err) {
    next(err);
  }
});

// GET /api/donors/:id — donor.view
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

// PUT /api/donors/:id — donor.update
router.put('/:id', requirePermission('donor.update'), async (req, res, next) => {
  try {
    const updateDonorSchema = createDonorSchema.partial();
    const parsed = updateDonorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: { code: 'VALIDATION_FAILED', fields: parsed.error.flatten() } });
    }
    
    if (Object.keys(parsed.data).length === 0) {
      return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'No fields provided to update' } });
    }
    
    const donor = await donorRepository.update(req.auth.organization_id, req.auth.user_id, req.params.id, parsed.data);
    if (!donor) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Donor not found' } });
    }
    res.status(200).json(donor);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/donors/:id — donor.delete (soft delete)
router.delete('/:id', requirePermission('donor.delete'), async (req, res, next) => {
  try {
    const donor = await donorRepository.softDelete(req.auth.organization_id, req.auth.user_id, req.params.id);
    if (!donor) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Donor not found' } });
    }
    res.status(200).json(donor);
  } catch (err) {
    next(err);
  }
});

module.exports = router;