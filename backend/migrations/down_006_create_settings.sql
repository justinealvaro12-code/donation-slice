-- Rollback for 006_create_settings.sql

BEGIN;

DROP TABLE IF EXISTS organization_receipt_settings;
DROP TABLE IF EXISTS organization_payment_channels;
DROP TABLE IF EXISTS organization_role_permissions;

COMMIT;
