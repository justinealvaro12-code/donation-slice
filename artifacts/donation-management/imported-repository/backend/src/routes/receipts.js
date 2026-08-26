const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const receiptRepository = require("../repositories/receiptRepository");
const donationRepository = require("../repositories/donationRepository");
const settingsRepository = require("../repositories/settingsRepository");

// GET /api/receipts
router.get("/", async (req, res) => {
  try {
    const rows = await receiptRepository.findByOrganization(
      req.auth.organization_id,
    );
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch receipts" },
      });
  }
});

// GET /api/receipts/:id
router.get("/:id", async (req, res) => {
  try {
    const receipt = await receiptRepository.findById(
      req.params.id,
      req.auth.organization_id,
    );
    if (!receipt)
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Receipt not found" } });
    res.json(receipt);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch receipt" },
      });
  }
});

// POST /api/receipts
router.post("/", async (req, res) => {
  try {
    const { donation_id } = req.body;
    if (!donation_id)
      return res
        .status(400)
        .json({
          error: {
            code: "VALIDATION_FAILED",
            message: "donation_id is required",
          },
        });

    const donation = await donationRepository.findById(
      req.auth.organization_id,
      donation_id,
    );
    if (!donation) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Donation not found" } });
    }
    if (donation.status !== "confirmed") {
      return res
        .status(400)
        .json({
          error: {
            code: "INVALID_STATUS",
            message: "Only confirmed donations can be receipted",
          },
        });
    }

    const existing = await receiptRepository.findByDonationId(
      donation_id,
      req.auth.organization_id,
    );
    if (existing)
      return res
        .status(409)
        .json({
          error: {
            code: "ALREADY_EXISTS",
            message: "Receipt already exists",
            receipt_id: existing.id,
          },
        });

    const donorResult = await pool.query(
      `SELECT display_name, email FROM donation_donors WHERE id = $1`,
      [donation.donor_id],
    );
    const donor = donorResult.rows[0] || {};

    const client = await pool.connect();
    let receipt;
    try {
      await client.query("BEGIN");

      // Prefix + atomically-incremented sequence from Settings > Receipts,
      // row-locked inside this transaction (see settingsRepository) so two
      // simultaneous requests can never get the same number.
      const { prefix, sequence } =
        await settingsRepository.getAndIncrementSequence(
          client,
          req.auth.organization_id,
        );
      const receiptNumber = `${prefix}${String(sequence).padStart(6, "0")}`;

      receipt = await receiptRepository.create(
        {
          donation_id,
          organization_id: req.auth.organization_id,
          receipt_number: receiptNumber,
          amount: donation.amount,
          name: donor.display_name || "Unknown",
          donor_email: donor.email,
          donation_date: donation.donation_date,
          payment_channel: donation.payment_channel,
          issued_by: req.auth.user_id || req.auth.id,
        },
        client,
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "23505") {
        // Two different unique constraints can fire here — report each
        // accurately instead of assuming it's always the donation one.
        if (err.constraint === "ux_donation_receipts_org_donation_issued") {
          // Another request issued a receipt for this donation in the gap
          // between our findByDonationId check above and this transaction.
          return res
            .status(409)
            .json({
              error: {
                code: "ALREADY_EXISTS",
                message: "Receipt already exists",
              },
            });
        }
        if (err.constraint === "ux_donation_receipts_org_number") {
          // The generated receipt number collided with an existing one —
          // a sequence/data problem, not a "this donation already has a
          // receipt" problem. Retrying won't help until the sequence is
          // fixed, so surface it distinctly rather than mislabeling it.
          return res.status(409).json({
            error: {
              code: "RECEIPT_NUMBER_COLLISION",
              message:
                "Generated receipt number already exists — check organization_receipt_settings.next_sequence",
            },
          });
        }
      }
      throw err;
    } finally {
      client.release();
    }

    res.status(201).json(receipt);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({
        error: { code: "INTERNAL_ERROR", message: "Failed to create receipt" },
      });
  }
});
module.exports = router;
