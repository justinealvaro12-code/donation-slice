-- 002_create_donations.sql
CREATE TABLE IF NOT EXISTS donation_donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    donor_id UUID NOT NULL REFERENCES donation_donors(id),
    -- campaign_id / pledge_id intentionally omitted from this slice's schema:
    -- the full ERD includes them (see /docs/ERD.md), but campaigns and pledges
    -- are out of scope for the vertical slice itself (see README "Known Limitations").

    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    payment_channel VARCHAR(20) NOT NULL CHECK (
        payment_channel IN ('cash', 'check', 'bank_transfer', 'card', 'online', 'other')
    ),
    payment_reference VARCHAR(255),
    donation_date DATE NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'confirmed', 'refunded', 'void')
    ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_donation_donations_org
    ON donation_donations (organization_id);

CREATE INDEX IF NOT EXISTS ix_donation_donations_org_donor
    ON donation_donations (organization_id, donor_id);

CREATE INDEX IF NOT EXISTS ix_donation_donations_org_status
    ON donation_donations (organization_id, status);