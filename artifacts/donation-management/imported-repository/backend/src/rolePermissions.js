// DEFAULT permission grants for each role, used to seed a new organization's
// donation_role_permissions rows (see seed.js and settingsRepository.js's
// ensureDefaultsForOrg). This is NO LONGER the live source of truth for
// permission checks — auth.js queries donation_role_permissions instead,
// so an organization's actual grants can diverge from these defaults once an
// admin edits them via Settings > Roles & Permissions.
//
// Role NAMES here are still fixed and shared platform-wide — orgs can't add
// new roles, only change what each of these five roles can do for their org.

const ROLE_PERMISSIONS = {
  viewer: ['donor.view', 'donation.view', 'receipt.view', 'campaign.view', 'pledge.view'],
  fundraising_staff: [
    'donor.view', 'donor.create', 'donor.update',
    'donation.view', 'donation.create',
    'receipt.view',
    'campaign.view', 'campaign.create', 'campaign.update',
    'pledge.view', 'pledge.create', 'pledge.update',
  ],
  finance_staff: [
    'donor.view',
    'donation.view', 'donation.create', 'donation.confirm', 'donation.refund', 'donation.void',
    'receipt.view', 'receipt.void',
    'campaign.view',
    'pledge.view',
  ],
  manager: [
    'donor.view', 'donor.create', 'donor.update', 'donor.delete',
    'donation.view', 'donation.create', 'donation.confirm', 'donation.refund', 'donation.void', 'donation.delete',
    'receipt.view', 'receipt.void',
    'campaign.view', 'campaign.create', 'campaign.update', 'campaign.delete',
    'pledge.view', 'pledge.create', 'pledge.update', 'pledge.delete',
  ],
  administrator: [
  'donor.view', 'donor.create', 'donor.update', 'donor.delete',
  'donation.view', 'donation.create', 'donation.confirm', 'donation.refund', 'donation.void', 'donation.delete',
  'receipt.view', 'receipt.void',
  'campaign.view', 'campaign.create', 'campaign.update', 'campaign.delete',
  'pledge.view', 'pledge.create', 'pledge.update', 'pledge.delete',
  'settings.view', 'settings.manage',
],
};

// Still used as a fallback default set — settingsRepository reads this
// directly when seeding a new org's donation_role_permissions rows.
function permissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || [];
}

module.exports = { ROLE_PERMISSIONS, permissionsForRole };