// Mirrors /docs/RBAC_MATRIX.md exactly. In real ARGO, permission resolution for
// a token would be handled by the platform's own identity service; this map
// stands in for that so the slice is runnable standalone. Only the subset of
// permissions touched by the vertical slice (donors, donations, campaigns,
// pledges) is included.

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
  'donation.view', 'donation.create', 'donation.confirm', 'donation.refund', 'donation.void', 'donation.delete',  // ADD THIS
  'receipt.view', 'receipt.void',
  'campaign.view', 'campaign.create', 'campaign.update', 'campaign.delete',
  'pledge.view', 'pledge.create', 'pledge.update', 'pledge.delete',
],

administrator: [
  'donor.view', 'donor.create', 'donor.update', 'donor.delete',
  'donation.view', 'donation.create', 'donation.confirm', 'donation.refund', 'donation.void', 'donation.delete',  // ADD THIS
  'receipt.view', 'receipt.void',
  'campaign.view', 'campaign.create', 'campaign.update', 'campaign.delete',
  'pledge.view', 'pledge.create', 'pledge.update', 'pledge.delete',
],
  
};

function permissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || [];
}

module.exports = { ROLE_PERMISSIONS, permissionsForRole };
