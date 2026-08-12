-- 004_create_campaigns.sql
-- Adds the campaigns table and links donations to campaigns.
-- Mirrors the column/constraint style used in 000-003 (donation_donors, donation_donations).

BEGIN;

CREATE TABLE IF NOT EXISTS donation_campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name            varchar(255) NOT NULL,
  description     text,
  goal_amount     decimal(14,2) NOT NULL,
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  status          varchar(20) NOT NULL DEFAULT 'draft', -- draft | active | closed
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid NOT NULL,
  deleted_at      timestamptz,

  CONSTRAINT campaigns_end_after_start CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_org ON donation_campaigns (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON donation_campaigns (organization_id, status) WHERE deleted_at IS NULL;

-- Link donations to a campaign. Nullable — existing donations and
-- general (non-campaign) donations are still valid.
ALTER TABLE donation_donations
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES donation_campaigns(id);

CREATE INDEX IF NOT EXISTS idx_donations_campaign ON donation_donations (campaign_id) WHERE deleted_at IS NULL;

COMMIT;