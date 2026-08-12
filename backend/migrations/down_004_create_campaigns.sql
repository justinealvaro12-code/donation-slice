-- Rollback for 004_create_campaigns.sql

BEGIN;

DROP INDEX IF EXISTS idx_donations_campaign;
ALTER TABLE donation_donations DROP COLUMN IF EXISTS campaign_id;

DROP INDEX IF EXISTS idx_campaigns_status;
DROP INDEX IF EXISTS idx_campaigns_org;
DROP TABLE IF EXISTS donation_campaigns;

COMMIT;
