const express = require('express');
const { requirePermission } = require('../middleware/requirePermission');
const pledgeRepository = require('../repositories/pledgeRepository');
const {
  createPledgeSchema,
  updatePledgeSchema,
} = require('../validators/pledgeSchema');

const router = express.Router();

router.param('id', (req, res, next, id) => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_ID',
        message: 'Pledge ID must be a valid UUID',
      },
    });
  }

  next();
});

// POST /api/pledges
router.post(
  '/',
  requirePermission('pledge.create'),
  async (req, res, next) => {
    try {
      const parsed = createPledgeSchema.safeParse(req.body);

      if (!parsed.success) {
        const flat = parsed.error.flatten();

        const firstMessage =
          Object.values(flat.fieldErrors).flat()[0] ||
          flat.formErrors[0] ||
          'Invalid request';

        return res.status(422).json({
          error: {
            code: 'VALIDATION_FAILED',
            message: firstMessage,
            fields: flat,
          },
        });
      }

      const pledge = await pledgeRepository.create(
        req.auth.organization_id,
        req.auth.user_id,
        parsed.data
      );

      // Repository returns null when the donor or campaign
      // does not belong to this organization.
      if (!pledge) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Donor or campaign not found',
          },
        });
      }

      res.status(201).json(pledge);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/pledges
router.get(
  '/',
  requirePermission('pledge.view'),
  async (req, res, next) => {
    try {
      const page = Math.max(
        1,
        parseInt(req.query.page, 10) || 1
      );

      const pageSize = Math.min(
        100,
        Math.max(
          1,
          parseInt(req.query.page_size, 10) || 20
        )
      );

      const pledges = await pledgeRepository.list(
        req.auth.organization_id,
        {
          page,
          pageSize,
          status: req.query.status,
          campaign_id: req.query.campaign_id,
          search: req.query.search,
          overdue: req.query.overdue === 'true',
        }
      );

      res.status(200).json({
        data: pledges,
        page,
        page_size: pageSize,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/pledges/summary
router.get(
  '/summary',
  requirePermission('pledge.view'),
  async (req, res, next) => {
    try {
      const summary = await pledgeRepository.summary(
        req.auth.organization_id
      );

      res.status(200).json(summary);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/pledges/:id
router.get(
  '/:id',
  requirePermission('pledge.view'),
  async (req, res, next) => {
    try {
      const pledge = await pledgeRepository.findById(
        req.auth.organization_id,
        req.params.id
      );

      if (!pledge) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Pledge not found',
          },
        });
      }

      res.status(200).json(pledge);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/pledges/:id
router.put(
  '/:id',
  requirePermission('pledge.update'),
  async (req, res, next) => {
    try {
      const parsed = updatePledgeSchema.safeParse(req.body);

      if (!parsed.success) {
        const flat = parsed.error.flatten();

        const firstMessage =
          Object.values(flat.fieldErrors).flat()[0] ||
          flat.formErrors[0] ||
          'Invalid request';

        return res.status(422).json({
          error: {
            code: 'VALIDATION_FAILED',
            message: firstMessage,
            fields: flat,
          },
        });
      }

      const updated = await pledgeRepository.update(
        req.auth.organization_id,
        req.auth.user_id,
        req.params.id,
        parsed.data
      );

      if (!updated) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Pledge, donor, or campaign not found',
          },
        });
      }

      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/pledges/:id
router.delete(
  '/:id',
  requirePermission('pledge.delete'),
  async (req, res, next) => {
    try {
      const pledge = await pledgeRepository.softDelete(
        req.auth.organization_id,
        req.auth.user_id,
        req.params.id
      );

      if (!pledge) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Pledge not found',
          },
        });
      }

      res.status(200).json(pledge);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
