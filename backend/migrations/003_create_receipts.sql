-- 003_create_receipts.sql

CREATE TABLE IF NOT EXISTS donation_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    donation_id UUID NOT NULL REFERENCES donation_donations(id),

    receipt_number VARCHAR(50) NOT NULL,

    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    issued_by UUID,

    status VARCHAR(20) NOT NULL DEFAULT 'issued'
        CHECK (status IN ('issued', 'voided')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- Receipt number must be unique within an organization
CREATE UNIQUE INDEX IF NOT EXISTS ux_donation_receipts_org_number
    ON donation_receipts (organization_id, receipt_number);

-- Each donation can only have one receipt within an organization
CREATE UNIQUE INDEX IF NOT EXISTS ux_donation_receipts_org_donation
    ON donation_receipts (organization_id, donation_id);

CREATE INDEX IF NOT EXISTS ix_donation_receipts_org
    ON donation_receipts (organization_id);