-- Rollback for 002_create_donations.sql

DROP INDEX IF EXISTS ix_donation_donations_org_status;
DROP INDEX IF EXISTS ix_donation_donations_org_donor;
DROP INDEX IF EXISTS ix_donation_donations_org;
DROP TABLE IF EXISTS donation_donations;
