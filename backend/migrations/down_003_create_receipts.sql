-- Rollback for 003_create_receipts.sql

DROP INDEX IF EXISTS ix_donation_receipts_org;
DROP INDEX IF EXISTS ux_donation_receipts_org_donation;
DROP INDEX IF EXISTS ux_donation_receipts_org_number;
DROP TABLE IF EXISTS donation_receipts;
