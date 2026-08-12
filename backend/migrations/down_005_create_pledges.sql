-- Rollback for 005_create_pledges.sql

BEGIN;

DROP INDEX IF EXISTS idx_donation_donations_pledge;
ALTER TABLE donation_donations DROP COLUMN IF EXISTS pledge_id;

DROP INDEX IF EXISTS idx_donation_pledges_due_date;
DROP INDEX IF EXISTS idx_donation_pledges_donor;
DROP INDEX IF EXISTS idx_donation_pledges_campaign;
DROP INDEX IF EXISTS idx_donation_pledges_org;
DROP TABLE IF EXISTS donation_pledges;

COMMIT;
