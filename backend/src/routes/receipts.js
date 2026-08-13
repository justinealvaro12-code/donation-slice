const express = require('express');
const { requirePermission } = require('../middleware/requirePermission');
const { pool } = require('../db');
const receiptRepository = require('../repositories/receiptRepository');
const donationRepository = require('../repositories/donationRepository');
const settingsRepository = require('../repositories/settingsRepository');

const router = express.Router();

// GET /api/receipts
// Requires receipt.view
router.get(
  '/',
  requirePermission('receipt.view'),
  async (req, res) => {
    try {
      const rows = await receiptRepository.findByOrganization(
        req.auth.organization_id
      );

      res.json({ data: rows });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch receipts',
        },
      });
    }
  }
);

// GET /api/receipts/:id
// Requires receipt.view
router.get(
  '/:id',
  requirePermission('receipt.view'),
  async (req, res) => {
    try {
      const receipt = await receiptRepository.findById(
        req.params.id,
        req.auth.organization_id
      );

      if (!receipt) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Receipt not found',
          },
        });
      }

      res.json(receipt);
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch receipt',
        },
      });
    }
  }
);

// POST /api/receipts
// Requires donation.confirm because issuing a receipt is a
// privileged financial operation.
router.post(
  '/',
  requirePermission('donation.confirm'),
  async (req, res) => {
    try {
      const { donation_id } = req.body;

      if (!donation_id) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'donation_id is required',
          },
        });
      }

      // The repository query is tenant-scoped using req.auth.organization_id.
      // This prevents a user from issuing a receipt for another
      // organization's donation.
      const donation = await donationRepository.findById(
        req.auth.organization_id,
        donation_id
      );

      if (!donation) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Donation not found',
          },
        });
      }

      // Only confirmed donations can receive receipts.
      if (donation.status !== 'confirmed') {
        return res.status(400).json({
          error: {
            code: 'INVALID_STATUS',
            message: 'Only confirmed donations can be receipted',
          },
        });
      }

      // Prevent duplicate receipts.
      const existing = await receiptRepository.findByDonationId(
        donation_id,
        req.auth.organization_id
      );

      if (existing) {
        return res.status(409).json({
          error: {
            code: 'ALREADY_EXISTS',
            message: 'Receipt already exists',
            receipt_id: existing.id,
          },
        });
      }

      // Get donor information for the receipt.
      const donorResult = await pool.query(
        `SELECT display_name, email
         FROM donation_donors
         WHERE id = $1
           AND organization_id = $2
           AND deleted_at IS NULL`,
        [donation.donor_id, req.auth.organization_id]
      );

      const donor = donorResult.rows[0] || {};

      const client = await pool.connect();

      let receipt;

      try {
        await client.query('BEGIN');

        // Get the organization's receipt prefix and atomically
        // increment the sequence inside this transaction.
        const { prefix, sequence } =
          await settingsRepository.getAndIncrementSequence(
            client,
            req.auth.organization_id
          );

        const receiptNumber =
          `${prefix}${String(sequence).padStart(6, '0')}`;

        receipt = await receiptRepository.create(
          {
            donation_id,
            organization_id: req.auth.organization_id,
            receipt_number: receiptNumber,
            amount: donation.amount,
            name: donor.display_name || 'Unknown',
            donor_email: donor.email,
            donation_date: donation.donation_date,
            payment_channel: donation.payment_channel,
            issued_by: req.auth.user_id || req.auth.id,
          },
          client
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');

        // Unique violation means another request created the
        // receipt between our duplicate check and INSERT.
        if (err.code === '23505') {
          return res.status(409).json({
            error: {
              code: 'ALREADY_EXISTS',
              message: 'Receipt already exists',
            },
          });
        }

        throw err;
      } finally {
        client.release();
      }

      res.status(201).json(receipt);
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create receipt',
        },
      });
    }
  }
);

module.exports = router;
