-- Rollback for 001_create_donors.sql

DROP INDEX IF EXISTS ix_donation_donors_org;
DROP INDEX IF EXISTS ux_donation_donors_org_email;
DROP TABLE IF EXISTS donation_donors;
