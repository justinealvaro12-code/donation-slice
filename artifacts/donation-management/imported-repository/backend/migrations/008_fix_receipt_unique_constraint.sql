-- 008_fix_receipt_unique_constraint.sql
-- The original unique index blocked ANY second receipt for a donation,
-- even after the first was voided (e.g. via a refund). A donation should
-- only ever be blocked by a currently-issued receipt, not a voided one.
BEGIN;

DROP INDEX IF EXISTS ux_donation_receipts_org_donation;

CREATE UNIQUE INDEX IF NOT EXISTS ux_donation_receipts_org_donation_issued
    ON donation_receipts (organization_id, donation_id)
    WHERE status = 'issued' AND deleted_at IS NULL;

COMMIT;