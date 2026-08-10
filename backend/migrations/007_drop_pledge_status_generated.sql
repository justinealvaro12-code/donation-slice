-- 007_drop_pledge_status_generated.sql
-- Remove stored generated status; compute dynamically in queries instead
-- per ARGO contract: "Never store what you can calculate"

BEGIN;

ALTER TABLE donation_pledges DROP COLUMN IF EXISTS status;

COMMIT;
