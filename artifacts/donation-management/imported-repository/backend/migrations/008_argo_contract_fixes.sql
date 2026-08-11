-- ARGO DB Contract compliance fixes
-- 1. Rename mis-prefixed tables to the donation_ module prefix
ALTER TABLE organization_payment_channels RENAME TO donation_payment_channels;
ALTER TABLE organization_receipt_settings RENAME TO donation_receipt_settings;
ALTER TABLE organization_role_permissions RENAME TO donation_role_permissions;

-- 2. Fix CASCADE on organization_id FKs that were missing it
ALTER TABLE donation_campaigns DROP CONSTRAINT donation_campaigns_organization_id_fkey;
ALTER TABLE donation_campaigns ADD CONSTRAINT donation_campaigns_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE donation_pledges DROP CONSTRAINT donation_pledges_organization_id_fkey;
ALTER TABLE donation_pledges ADD CONSTRAINT donation_pledges_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- 3. Make created_by/updated_by nullable (loose audit refs, per contract)
ALTER TABLE donation_campaigns ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE donation_campaigns ALTER COLUMN updated_by DROP NOT NULL;
ALTER TABLE donation_pledges ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE donation_pledges ALTER COLUMN updated_by DROP NOT NULL;
