// Mirrors /docs/RBAC_MATRIX.md exactly. In real ARGO, permission resolution for
// a token would be handled by the platform's own identity service; this map
// stands in for that so the slice is runnable standalone. Only the subset of
// permissions touched by the vertical slice (donors, donations) is included.

const ROLE_PERMISSIONS = {
  viewer: ['donor.view', 'donation.view', 'receipt.view'],
  fundraising_staff: [
    'donor.view', 'donor.create', 'donor.update',
    'donation.view', 'donation.create',
    'receipt.view',
  ],
  finance_staff: [
    'donor.view',
    'donation.view', 'donation.create', 'donation.confirm', 'donation.refund', 'donation.void',
    'receipt.view', 'receipt.void',
  ],
  manager: [
    'donor.view', 'donor.create', 'donor.update', 'donor.delete',
    'donation.view', 'donation.create', 'donation.confirm', 'donation.refund', 'donation.void',
    'receipt.view', 'receipt.void',
  ],
  administrator: [
    'donor.view', 'donor.create', 'donor.update', 'donor.delete',
    'donation.view', 'donation.create', 'donation.confirm', 'donation.refund', 'donation.void',
    'receipt.view', 'receipt.void',
  ],
};

function permissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || [];
}

module.exports = { ROLE_PERMISSIONS, permissionsForRole };
