-- 013_add_report_view_permission.sql
-- Adds the new report.view permission (required by every /api/reports route
-- via requirePermission('report.view')) to every EXISTING organization's
-- already-materialized role grants. New organizations get this automatically
-- via ROLE_PERMISSIONS in rolePermissions.js -> ensureDefaultsForOrg; this
-- migration only backfills orgs that were seeded before report.view existed.
-- Grants report.view to ALL FIVE roles — viewer, fundraising_staff,
-- finance_staff, manager, and administrator — matching the existing pattern
-- where every other *.view permission (donor.view, donation.view,
-- receipt.view, campaign.view, pledge.view) is granted platform-wide with no
-- role restrictions.
INSERT INTO organization_role_permissions (organization_id, role, permission)
SELECT o.id, r.role, 'report.view'
FROM organizations o
CROSS JOIN (VALUES ('viewer'), ('fundraising_staff'), ('finance_staff'), ('manager'), ('administrator')) AS r(role)
ON CONFLICT (organization_id, role, permission) DO NOTHING;
