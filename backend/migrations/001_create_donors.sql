-- 001_create_donors.sql
CREATE TABLE IF NOT EXISTS donation_donors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    donor_type VARCHAR(20) NOT NULL CHECK (donor_type IN ('individual', 'organization')),
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- Tenant-scoped uniqueness on email (only enforced while email is present and donor not deleted)
CREATE UNIQUE INDEX IF NOT EXISTS ux_donation_donors_org_email
    ON donation_donors (organization_id, email)
    WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_donation_donors_org ON donation_donors (organization_id);
