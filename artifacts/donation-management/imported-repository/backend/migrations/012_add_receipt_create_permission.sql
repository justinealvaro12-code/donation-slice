-- 012_add_receipt_create_permission.sql
-- Adds the new receipt.create permission (introduced alongside the
-- authorization work separating receipt viewing/creating/voiding) to every
-- EXISTING organization's already-materialized role grants. New
-- organizations get this automatically via ROLE_PERMISSIONS in
-- rolePermissions.js -> ensureDefaultsForOrg; this migration only backfills
-- orgs that were seeded before receipt.create existed.
-- Grants receipt.create to finance_staff, manager, and administrator only —
-- matching the same roles already granted receipt.void and donation.confirm.
-- viewer and fundraising_staff are intentionally excluded.
INSERT INTO organization_role_permissions (organization_id, role, permission)
SELECT o.id, r.role, 'receipt.create'
FROM organizations o
CROSS JOIN (VALUES ('finance_staff'), ('manager'), ('administrator')) AS r(role)
ON CONFLICT (organization_id, role, permission) DO NOTHING;