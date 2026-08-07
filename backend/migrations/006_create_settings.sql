-- 006_create_settings.sql
-- Organization-level configuration: role permission grants, payment channel
-- toggles, and receipt numbering. See Settings page (Roles & Permissions,
-- Payment Channels, Receipt Numbering tabs).

-- Per-organization permission grants. Role NAMES stay fixed (viewer,
-- fundraising_staff, finance_staff, manager, administrator) — this table
-- does not let an org invent new roles, only change what each fixed role
-- can do within that org. Defaults are seeded from ROLE_PERMISSIONS in
-- rolePermissions.js when an organization is first seeded.
CREATE TABLE IF NOT EXISTS organization_role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('viewer', 'fundraising_staff', 'finance_staff', 'manager', 'administrator')),
    permission VARCHAR(100) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_org_role_permission
    ON organization_role_permissions (organization_id, role, permission);

CREATE INDEX IF NOT EXISTS ix_org_role_permissions_org_role
    ON organization_role_permissions (organization_id, role);

-- Per-organization payment channel toggles. The universe of possible
-- channels stays the fixed 6-value set already enforced by
-- donation_donations.payment_channel's CHECK constraint and the
-- createDonationSchema zod enum — this table only tracks which of those
-- six are currently ACTIVE for a given org.
CREATE TABLE IF NOT EXISTS organization_payment_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('cash', 'check', 'bank_transfer', 'card', 'online', 'other')),
    is_active BOOLEAN NOT NULL DEFAULT true,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_org_payment_channel
    ON organization_payment_channels (organization_id, channel);

-- Per-organization receipt numbering config. next_sequence is
-- server-generated and incremented atomically inside the same transaction
-- as receipt creation — never editable directly, matching the Settings
-- mockup's own note that "Sequence is server-generated and not editable,
-- to guarantee receipt-number uniqueness." Prefix IS editable.
CREATE TABLE IF NOT EXISTS organization_receipt_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    prefix VARCHAR(20) NOT NULL DEFAULT 'RCPT-',
    next_sequence INTEGER NOT NULL DEFAULT 1 CHECK (next_sequence > 0),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID
);