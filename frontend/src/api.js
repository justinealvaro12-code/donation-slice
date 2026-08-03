const BASE_URL = 'http://localhost:4000/api';

async function request(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

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
};
