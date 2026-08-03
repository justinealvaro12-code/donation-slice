import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

// In real ARGO, the platform JWT is injected by the host shell — this module
// never asks the user to log in. The token field below is a stand-in for
// that injection point so this slice can be demoed standalone; paste a token
// printed by `npm run seed` in the backend.

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('demo_token') || '');
  const [donations, setDonations] = useState([]);
  const [donors, setDonors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ donor_id: '', amount: '', payment_channel: 'cash', donation_date: '' });

  const refresh = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [donationsRes, donorsRes] = await Promise.all([api.listDonations(token), api.listDonors(token)]);
      setDonations(donationsRes.data);
      setDonors(donorsRes.data);
    } catch (err) {
      setError(err);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function saveToken(t) {
    setToken(t);
    localStorage.setItem('demo_token', t);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.createDonation(token, {
        donor_id: form.donor_id,
        amount: parseFloat(form.amount),
        payment_channel: form.payment_channel,
        donation_date: form.donation_date,
      });
      setForm({ donor_id: '', amount: '', payment_channel: 'cash', donation_date: '' });
      refresh();
    } catch (err) {
      setError(err);
    }
  }

  async function handleAction(action, id) {
    setError(null);
    try {
      const fn = { confirm: api.confirmDonation, void: api.voidDonation, refund: api.refundDonation }[action];
      await fn(token, id);
      refresh();
      if (selected?.id === id) {
        const updated = await api.getDonation(token, id);
        setSelected(updated);
      }
    } catch (err) {
      setError(err);
    }
  }

  async function openDetail(id) {
    setError(null);
    try {
      const donation = await api.getDonation(token, id);
      setSelected(donation);
    } catch (err) {
      setError(err);
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 960, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Donation Management — Vertical Slice</h1>

      <section style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
          Platform JWT (paste output from <code>npm run seed</code>)
        </label>
        <input
          type="text"
          value={token}
          onChange={(e) => saveToken(e.target.value)}
          placeholder="eyJhbGciOi..."
          style={{ width: '100%', padding: 8, fontFamily: 'monospace' }}
        />
      </section>

      {error && (
        <div style={{ background: '#fdecea', color: '#611a15', padding: '0.75rem 1rem', borderRadius: 6, marginBottom: '1rem' }}>
          <strong>{error.status || 'Error'}:</strong> {error.message}
        </div>
      )}

      <section style={{ marginBottom: '2rem' }}>
        <h2>Record a Donation</h2>
        <form onSubmit={handleCreate} style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr', maxWidth: 500 }}>
          <select
            value={form.donor_id}
            onChange={(e) => setForm({ ...form, donor_id: e.target.value })}
            required
            style={{ gridColumn: 'span 2' }}
          >
            <option value="">Select donor…</option>
            {donors.map((d) => (
              <option key={d.id} value={d.id}>{d.display_name}</option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            placeholder="Amount"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />
          <select value={form.payment_channel} onChange={(e) => setForm({ ...form, payment_channel: e.target.value })}>
            {['cash', 'check', 'bank_transfer', 'card', 'online', 'other'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type="date"
            value={form.donation_date}
            onChange={(e) => setForm({ ...form, donation_date: e.target.value })}
            required
          />
          <button type="submit" style={{ gridColumn: 'span 2' }}>Create Donation (pending)</button>
        </form>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <h2>Donations</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => openDetail(d.id)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid #eee' }}
                >
                  <td>${Number(d.amount).toFixed(2)}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td>{d.donation_date}</td>
                </tr>
              ))}
              {donations.length === 0 && (
                <tr><td colSpan={3} style={{ color: '#888', padding: '0.5rem 0' }}>No donations yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          <h2>Detail</h2>
          {!selected && <p style={{ color: '#888' }}>Select a donation to view details.</p>}
          {selected && (
            <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem' }}>
              <p><strong>Amount:</strong> ${Number(selected.amount).toFixed(2)}</p>
              <p><strong>Status:</strong> <StatusBadge status={selected.status} /></p>
              <p><strong>Payment channel:</strong> {selected.payment_channel}</p>
              <p><strong>Date:</strong> {selected.donation_date}</p>
              {selected.receipt_number && <p><strong>Receipt:</strong> {selected.receipt_number} ({selected.receipt_status})</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button disabled={selected.status !== 'pending'} onClick={() => handleAction('confirm', selected.id)}>
                  Confirm
                </button>
                <button disabled={selected.status !== 'pending'} onClick={() => handleAction('void', selected.id)}>
                  Void
                </button>
                <button disabled={selected.status !== 'confirmed'} onClick={() => handleAction('refund', selected.id)}>
                  Refund
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    pending: '#8a6d3b',
    confirmed: '#3c763d',
    refunded: '#31708f',
    void: '#a94442',
  };
  return <span style={{ color: colors[status] || '#333', fontWeight: 600 }}>{status}</span>;
}
