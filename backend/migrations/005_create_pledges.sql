-- Migration: add donation_pledges + link donation_donations to pledges
-- Mirrors the conventions used by donation_campaigns (org-scoped, soft delete,
-- created_by/updated_by audit columns).

BEGIN;

CREATE TABLE IF NOT EXISTS donation_pledges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  donor_id        UUID NOT NULL REFERENCES donation_donors(id),
  campaign_id     UUID REFERENCES donation_campaigns(id),

  amount_pledged   NUMERIC(14,2) NOT NULL CHECK (amount_pledged > 0),
  amount_fulfilled NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_fulfilled >= 0),

  pledge_date DATE NOT NULL,
  due_date    DATE,

 
  created_by UUID NOT NULL,
  updated_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_donation_pledges_org ON donation_pledges (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_donation_pledges_campaign ON donation_pledges (campaign_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_donation_pledges_donor ON donation_pledges (donor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_donation_pledges_due_date ON donation_pledges (due_date) WHERE deleted_at IS NULL;

-- Link donations back to the pledge they fulfill (nullable — most donations
-- won't be tied to a pledge).
ALTER TABLE donation_donations
  ADD COLUMN IF NOT EXISTS pledge_id UUID REFERENCES donation_pledges(id);

CREATE INDEX IF NOT EXISTS idx_donation_donations_pledge ON donation_donations (pledge_id) WHERE deleted_at IS NULL;

COMMIT;