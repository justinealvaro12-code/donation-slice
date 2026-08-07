const BASE_URL = 'http://localhost:4000/api';

async function request(path, { method = 'GET', token, body } = {}) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const err = new Error('Cannot reach the server. Is the backend running?');
    err.status = 'Network Error';
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export const api = {
  listDonations: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/donations${qs ? `?${qs}` : ''}`, { token });
  },
  getDonation: (token, id) => request(`/donations/${id}`, { token }),
  createDonation: (token, body) => request('/donations', { method: 'POST', token, body }),
  confirmDonation: (token, id) => request(`/donations/${id}/confirm`, { method: 'POST', token }),
  voidDonation: (token, id) => request(`/donations/${id}/void`, { method: 'POST', token }),
  refundDonation: (token, id) => request(`/donations/${id}/refund`, { method: 'POST', token }),
  listDonors: (token) => request('/donors', { token }),
  getMyOrganization: (token) => request('/organizations/me', { token }),
  updateMyOrganization: (token, body) => request('/organizations/me', { method: 'PUT', token, body }),
  createDonor: (token, body) => request('/donors', { method: 'POST', token, body }),
  updateDonor: (token, id, body) => request(`/donors/${id}`, { method: 'PUT', token, body }),
  deleteDonor: (token, id) => request(`/donors/${id}`, { method: 'DELETE', token }),
  listReceipts: (token) => request('/receipts', { token }),
  getReceipt: (token, id) => request(`/receipts/${id}`, { token }),
  createReceipt: (token, body) => request('/receipts', { method: 'POST', token, body }),
  listCampaigns: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/campaigns${qs ? `?${qs}` : ''}`, { token });
  },
  getCampaign: (token, id) => request(`/campaigns/${id}`, { token }),
  createCampaign: (token, body) => request('/campaigns', { method: 'POST', token, body }),
  updateCampaign: (token, id, body) => request(`/campaigns/${id}`, { method: 'PUT', token, body }),
  deleteCampaign: (token, id) => request(`/campaigns/${id}`, { method: 'DELETE', token }),

  // Pledges
   // Pledges
  listPledges: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/pledges${qs ? `?${qs}` : ''}`, { token });
  },
  getPledgeSummary: (token) => request('/pledges/summary', { token }),
  getPledge: (token, id) => request(`/pledges/${id}`, { token }),
  createPledge: (token, body) => request('/pledges', { method: 'POST', token, body }),
  updatePledge: (token, id, body) => request(`/pledges/${id}`, { method: 'PUT', token, body }),
  deletePledge: (token, id) => request(`/pledges/${id}`, { method: 'DELETE', token }),

  // Reports
  getReportSummary: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports/summary${qs ? `?${qs}` : ''}`, { token });
  },
  getReportTrends: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports/trends${qs ? `?${qs}` : ''}`, { token });
  },
  getReportCampaigns: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports/campaigns${qs ? `?${qs}` : ''}`, { token });
  },
  getReportChannels: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports/channels${qs ? `?${qs}` : ''}`, { token });
  },
  getReportTopDonors: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports/top-donors${qs ? `?${qs}` : ''}`, { token });
  },

  // Settings
  // Call with no role for the roles-list summary (counts + last modified);
  // call with a role for that role's full permission matrix.
  getRolePermissions: (token, role) =>
    request(role ? `/settings/roles/${role}` : '/settings/roles', { token }),
  updateRolePermissions: (token, role, permissions) =>
    request(`/settings/roles/${role}`, { method: 'PUT', token, body: { permissions } }),
  getPaymentChannels: (token) => request('/settings/payment-channels', { token }),
  updatePaymentChannels: (token, channels) =>
    request('/settings/payment-channels', { method: 'PUT', token, body: { channels } }),
  getReceiptSettings: (token) => request('/settings/receipt', { token }),
  updateReceiptSettings: (token, prefix) =>
    request('/settings/receipt', { method: 'PUT', token, body: { prefix } }),
};