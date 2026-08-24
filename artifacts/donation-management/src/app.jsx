import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "./api.js";
import "./App.css";

/* ============================== helpers ============================== */
function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return (
    "₱" +
    num.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function classNames(...c) {
  return c.filter(Boolean).join(" ");
}

/* ============================== icons ============================== */
function Icon({ name, size = 20 }) {
  const s = {
    width: size,
    height: size,
    display: "inline-block",
    verticalAlign: "middle",
  };
  const paths = {
    dashboard: (
      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
    ),
    donors: (
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    ),
    campaigns: (
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
    ),
    pledges: (
      <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
    ),
    donations: (
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    ),
    receipts: (
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
    ),
    reports: (
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
    ),
    settings: (
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L3.16 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    ),
    search: (
      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    ),
    close: (
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    ),
    bell: (
      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
    ),
    plus: <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />,
    check: <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />,
    arrowBack: (
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
    ),
    person: (
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    ),
    calendar: (
      <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" />
    ),
    filter: <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />,
    moreVert: (
      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    ),
    clock: (
      <path d="M12 20a8 8 0 100-16 8 8 0 000 16zm0-18a10 10 0 110 20 10 10 0 010-20zm.5 5H11v6l5.2 3.12.8-1.3-4.5-2.7V7z" />
    ),
    alert: (
      <path d="M12 2L1 21h22L12 2zm0 5.5L18.7 19H5.3L12 7.5zM11 10h2v5h-2v-5zm0 6h2v2h-2v-2z" />
    ),
  };
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={s}>
      {paths[name] || null}
    </svg>
  );
}

/* ============================== chart ============================== */
function WeeklyChart({ donations }) {
  const data = useMemo(() => {
    const confirmed = donations.filter((d) => d.status === "confirmed");
    if (confirmed.length === 0) return [];

    const dates = confirmed.map((d) => new Date(d.donation_date));
    const maxDate = new Date(Math.max(...dates));

    const endOfWeek = new Date(maxDate);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
    endOfWeek.setHours(23, 59, 59, 999);

    const buckets = [];
    for (let i = 0; i < 8; i++) {
      const weekEnd = new Date(endOfWeek);
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);

      const sum = confirmed
        .filter((d) => {
          const date = new Date(d.donation_date);
          return date >= weekStart && date <= weekEnd;
        })
        .reduce((acc, d) => acc + Number(d.amount || 0), 0);

      buckets.unshift({
        label: weekStart.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        value: sum,
      });
    }
    return buckets;
  }, [donations]);

  const maxValue = useMemo(
    () => Math.max(...data.map((d) => d.value), 1),
    [data],
  );

  if (data.length === 0) {
    return (
      <div className="chart-empty">
        <p>No confirmed donations yet.</p>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <div className="chart-bars">
        {data.map((bucket, i) => {
          const heightPct = (bucket.value / maxValue) * 100;
          return (
            <div key={i} className="chart-bar-wrapper">
              <div className="chart-bar-track">
                <div
                  className="chart-bar"
                  style={{ height: `${Math.max(heightPct, 4)}%` }}
                  title={`${bucket.label}: ${formatCurrency(bucket.value)}`}
                />
              </div>
              <span className="chart-bar-label">{bucket.label}</span>
              {bucket.value > 0 && (
                <span className="chart-bar-value">
                  {formatCurrency(bucket.value)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== status pill ============================== */
function StatusPill({ status }) {
  const map = {
    confirmed: { cls: "status-confirmed", label: "Confirmed" },
    pending: { cls: "status-pending", label: "Pending" },
    voided: { cls: "status-voided", label: "Voided" },
    refunded: { cls: "status-refunded", label: "Refunded" },
  };
  const s = map[status] || { cls: "status-pending", label: status };
  return <span className={classNames("status-pill", s.cls)}>{s.label}</span>;
}

/* ============================== modals ============================== */
function Modal({ title, onClose, children, size = "md" }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={classNames("modal", `modal-${size}`)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function RecordDonationModal({
  token,
  donors,
  campaigns,
  pledges = [],
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({
    donor_id: "",
    campaign_id: "",
    pledge_id: "",
    amount: "",
    payment_channel: "cash",
    payment_reference: "",
    donation_date: new Date().toISOString().split("T")[0],
  });
  const [saving, setSaving] = useState(false);

  // Only offer pledges belonging to the selected donor that still have an
  // outstanding balance — matches the backend rule that pledge_id must
  // belong to the same donor_id (see donations.js IDOR check).
  const donorPledges = useMemo(() => {
    if (!form.donor_id) return [];
    return pledges.filter(
      (p) => p.donor_id === form.donor_id && p.status !== "fulfilled",
    );
  }, [pledges, form.donor_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createDonation(token, {
        donor_id: form.donor_id,
        campaign_id: form.campaign_id || undefined,
        pledge_id: form.pledge_id || undefined,
        amount: Number(form.amount),
        payment_channel: form.payment_channel,
        payment_reference: form.payment_reference || undefined,
        donation_date: form.donation_date,
      });
      onSave();
      onClose();
    } catch (err) {
      alert("Failed to record donation: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Record Donation" onClose={onClose}>
      <form onSubmit={handleSubmit} className="form">
        <div className="form-row">
          <label>Donor *</label>
          <select
            required
            value={form.donor_id}
            onChange={(e) =>
              setForm({ ...form, donor_id: e.target.value, pledge_id: "" })
            }
          >
            <option value="">Select donor</option>
            {donors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.display_name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>Campaign</label>
          <select
            value={form.campaign_id}
            onChange={(e) => setForm({ ...form, campaign_id: e.target.value })}
          >
            <option value="">No campaign</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>Fulfills Pledge</label>
          <select
            value={form.pledge_id}
            onChange={(e) => setForm({ ...form, pledge_id: e.target.value })}
            disabled={!form.donor_id}
          >
            <option value="">No pledge</option>
            {donorPledges.map((p) => (
              <option key={p.id} value={p.id}>
                {formatCurrency(p.amount_pledged - p.amount_fulfilled)}{" "}
                outstanding{p.campaign_name ? ` — ${p.campaign_name}` : ""}
              </option>
            ))}
          </select>
          {form.donor_id && donorPledges.length === 0 && (
            <span className="field-hint">
              This donor has no outstanding pledges.
            </span>
          )}
        </div>
        <div className="form-row">
          <label>Amount (₱) *</label>
          <input
            type="number"
            min="1"
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </div>
        <div className="form-row">
          <label>Payment Channel *</label>
          <select
            required
            value={form.payment_channel}
            onChange={(e) =>
              setForm({ ...form, payment_channel: e.target.value })
            }
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="check">Check</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="online">Online</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="form-row">
          <label>Date *</label>
          <input
            type="date"
            required
            value={form.donation_date}
            onChange={(e) =>
              setForm({ ...form, donation_date: e.target.value })
            }
          />
        </div>
        <div className="form-row">
          <label>Reference Number</label>
          <input
            type="text"
            maxLength={255}
            value={form.payment_reference}
            onChange={(e) =>
              setForm({ ...form, payment_reference: e.target.value })
            }
          />
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Donation"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DonationDetailModal({ donation, donor, pledge, onClose }) {
  if (!donation) return null;
  return (
    <Modal title="Donation Details" onClose={onClose}>
      <div className="detail-grid">
        <div className="detail-item">
          <span className="detail-label">Donor</span>
          <span className="detail-value">
            {donor?.display_name || "Unknown"}
          </span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Amount</span>
          <span className="detail-value">
            {formatCurrency(donation.amount)}
          </span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Channel</span>
          <span className="detail-value capitalize">
            {donation.payment_channel}
          </span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Status</span>
          <span className="detail-value">
            <StatusPill status={donation.status} />
          </span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Date</span>
          <span className="detail-value">
            {formatDate(donation.donation_date)}
          </span>
        </div>
        {donation.pledge_id && (
          <div className="detail-item">
            <span className="detail-label">Fulfills Pledge</span>
            <span className="detail-value">
              {pledge
                ? `${formatCurrency(donation.amount)} of ${formatCurrency(pledge.amount_pledged)}${pledge.campaign_name ? ` — ${pledge.campaign_name}` : ""}`
                : "Linked pledge"}
            </span>
          </div>
        )}
        {donation.referenceNumber && (
          <div className="detail-item">
            <span className="detail-label">Reference</span>
            <span className="detail-value">{donation.referenceNumber}</span>
          </div>
        )}
        {donation.notes && (
          <div className="detail-item full">
            <span className="detail-label">Notes</span>
            <span className="detail-value">{donation.notes}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

function DonorDetailModal({ donor, donations, organizations, onClose }) {
  if (!donor) return null;
  const orgName =
    organizations.find((o) => o.id === donor.organization_id)?.name || "—";
  const donorDonations = donations
    .filter((d) => d.donor_id === donor.id)
    .sort((a, b) => new Date(b.donation_date) - new Date(a.donation_date));
  const totalDonated = donorDonations
    .filter((d) => d.status === "confirmed")
    .reduce((acc, d) => acc + Number(d.amount || 0), 0);

  return (
    <Modal title="Donor Profile" onClose={onClose} size="lg">
      <div className="detail-grid">
        <div className="detail-item">
          <span className="detail-label">Name</span>
          <span className="detail-value">{donor.display_name}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Email</span>
          <span className="detail-value">{donor.email || "—"}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Phone</span>
          <span className="detail-value">{donor.phone || "—"}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Organization</span>
          <span className="detail-value">{orgName}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Total Donated</span>
          <span className="detail-value">{formatCurrency(totalDonated)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Donations</span>
          <span className="detail-value">{donorDonations.length}</span>
        </div>
      </div>

      <h4 className="modal-section-title">Donation History</h4>
      {donorDonations.length === 0 ? (
        <p className="empty-text">No donations recorded yet.</p>
      ) : (
        <table className="table modal-table">
          <thead>
            <tr>
              <th>Amount</th>
              <th>Channel</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {donorDonations.map((d) => (
              <tr key={d.id}>
                <td className="amount">{formatCurrency(d.amount)}</td>
                <td className="capitalize">{d.payment_channel}</td>
                <td>
                  <StatusPill status={d.status} />
                </td>
                <td>{formatDate(d.donation_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
function DonorFormModal({ token, donor, onClose, onSave }) {
  const isEdit = !!donor;
  const [form, setForm] = useState({
    donor_type: donor?.donor_type || "individual",
    display_name: donor?.display_name || "",
    email: donor?.email || "",
    phone: donor?.phone || "",
    address: donor?.address || "",
  });
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      const payload = {
        donor_type: form.donor_type,
        display_name: form.display_name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
      };
      if (isEdit) {
        await api.updateDonor(token, donor.id, payload);
      } else {
        await api.createDonor(token, payload);
      }
      onSave();
      onClose();
    } catch (err) {
      if (err.body?.error?.fields?.fieldErrors) {
        setFieldErrors(err.body.error.fields.fieldErrors);
      } else {
        alert("Failed to save donor: " + (err.message || "Unknown error"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit Donor" : "New Donor"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="form">
        <div className="form-row">
          <label>Donor Type *</label>
          <select
            required
            value={form.donor_type}
            onChange={(e) => setForm({ ...form, donor_type: e.target.value })}
          >
            <option value="individual">Individual</option>
            <option value="organization">Organization</option>
          </select>
        </div>
        <div className="form-row">
          <label>Display Name *</label>
          <input
            type="text"
            required
            maxLength={255}
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            autoFocus
          />
          {fieldErrors.display_name && (
            <span className="field-error">{fieldErrors.display_name[0]}</span>
          )}
        </div>
        <div className="form-row">
          <label>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          {fieldErrors.email && (
            <span className="field-error">{fieldErrors.email[0]}</span>
          )}
        </div>
        <div className="form-row">
          <label>Phone</label>
          <input
            type="text"
            maxLength={50}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="form-row">
          <label>Address</label>
          <textarea
            rows={2}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Donor"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
/* ============================== sidebar ============================== */
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", disabled: false },
  { id: "donors", label: "Donors", icon: "donors", disabled: false },
  {
    id: "organizations",
    label: "My Organization",
    icon: "settings",
    disabled: false,
  },
  { id: "campaigns", label: "Campaigns", icon: "campaigns", disabled: false },
  { id: "pledges", label: "Pledges", icon: "pledges", disabled: false },
  { id: "donations", label: "Donations", icon: "donations", disabled: false },
  { id: "receipts", label: "Receipts", icon: "receipts", disabled: false },
  { id: "reports", label: "Reports", icon: "reports", disabled: false },
  { id: "settings", label: "Settings", icon: "settings", disabled: false },
];

function Sidebar({ page, setPage, pendingCount, role }) {
  // Settings is admin-only on the backend (settings.view/settings.manage
  // permissions) — hide the nav item for anyone who isn't an administrator
  // so non-admins don't land on a page that just 403s.
  const visibleItems = NAV_ITEMS.filter(
    (item) => item.id !== "settings" || role === "administrator",
  );
  return (
    <aside className="sidebar bg-sidebar text-white">
      <div className="sidebar-brand">
        <div className="brand-logo">
          <Icon name="donations" size={22} />
        </div>
        <span className="brand-text">Giving</span>
      </div>
      <nav className="sidebar-nav">
        {visibleItems.map((item) => {
          const active = page === item.id;
          const badge =
            item.id === "donations" && pendingCount > 0 ? pendingCount : null;
          return (
            <button
              key={item.id}
              className={classNames(
                "nav-item",
                active && "active",
                item.disabled && "disabled",
              )}
              onClick={() => !item.disabled && setPage(item.id)}
              title={item.disabled ? "Not built in this slice yet" : item.label}
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
              {badge !== null && <span className="nav-badge">{badge}</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

/* ============================== header ============================== */
function Header({ user, organizations }) {
  const org = organizations.find((o) => o.id === user?.organization_id);
  return (
    <header className="topbar">
      <div className="topbar-org">
        <span className="org-dot" />
        <span className="org-name">{org?.name || "Unknown Organization"}</span>
      </div>
      <div className="topbar-actions">
        <button className="icon-btn">
          <Icon name="bell" size={20} />
        </button>
        <div className="avatar">{user?.name?.[0] || "A"}</div>
      </div>
    </header>
  );
}
/* ============================== dashboard page ============================== */
function DashboardPage({ organizations, donors, donations, loading }) {
  const confirmedThisMonth = useMemo(() => {
    const now = new Date();
    return donations
      .filter((d) => d.status === "confirmed")
      .filter((d) => {
        const date = new Date(d.donation_date);
        return (
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      })
      .reduce((acc, d) => acc + Number(d.amount || 0), 0);
  }, [donations]);

  const pendingCount = useMemo(
    () => donations.filter((d) => d.status === "pending").length,
    [donations],
  );

  const donorMap = useMemo(() => {
    const m = {};
    donors.forEach((d) => (m[d.id] = d));
    return m;
  }, [donors]);

  const recentDonations = useMemo(
    () =>
      [...donations]
        .sort((a, b) => new Date(b.donation_date) - new Date(a.donation_date))
        .slice(0, 5),
    [donations],
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-subtitle">
            Overview of your organization's giving activity
          </p>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon blue">
            <Icon name="donors" size={22} />
          </div>
          <div className="stat-value">{donors.length}</div>
          <div className="stat-label">Total Donors</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <Icon name="receipts" size={22} />
          </div>
          <div className="stat-value">{formatCurrency(confirmedThisMonth)}</div>
          <div className="stat-label">Total Confirmed (This Month)</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber">
            <Icon name="bell" size={22} />
          </div>
          <div className="stat-value">{pendingCount}</div>
          <div className="stat-label">Pending Confirmation</div>
        </div>
      </div>

      <div className="card chart-card">
        <div className="card-header">
          <h3>Donations Over Time</h3>
          <p className="card-subtitle">Confirmed donations by week</p>
        </div>
        <WeeklyChart donations={donations} />
      </div>

      <div className="card">
        <div className="table-toolbar">
          <h3 className="table-title">Recent Donations</h3>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Donor</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="empty">
                    Loading...
                  </td>
                </tr>
              ) : recentDonations.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty">
                    No donations recorded yet.
                  </td>
                </tr>
              ) : (
                recentDonations.map((d) => {
                  const donor = donorMap[d.donor_id];
                  return (
                    <tr key={d.id}>
                      <td>{donor?.display_name || "Unknown"}</td>
                      <td className="amount">{formatCurrency(d.amount)}</td>
                      <td>
                        <StatusPill status={d.status} />
                      </td>
                      <td>{formatDate(d.donation_date)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
/* ============================== donations page ============================== */
function DonationsPage({
  token,
  donors,
  campaigns,
  pledges = [],
  donations,
  organizations,
  loading,
  onRefresh,
}) {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [showRecord, setShowRecord] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const donorMap = useMemo(() => {
    const m = {};
    donors.forEach((d) => (m[d.id] = d));
    return m;
  }, [donors]);

  const filtered = useMemo(() => {
    let rows = [...donations];
    if (tab === "pending") rows = rows.filter((d) => d.status === "pending");
    if (statusFilter) rows = rows.filter((d) => d.status === statusFilter);
    if (channelFilter)
      rows = rows.filter((d) => d.payment_channel === channelFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((d) => {
        const donor = donorMap[d.donor_id];
        const orgName =
          organizations.find((o) => o.id === donor?.organization_id)?.name ||
          "";
        return (
          (donor?.display_name || "").toLowerCase().includes(q) ||
          orgName.toLowerCase().includes(q) ||
          (d.referenceNumber || "").toLowerCase().includes(q)
        );
      });
    }
    return rows.sort(
      (a, b) => new Date(b.donation_date) - new Date(a.donation_date),
    );
  }, [donations, tab, search, statusFilter, channelFilter, donorMap]);

  const confirmedThisMonth = useMemo(() => {
    const now = new Date();
    return donations
      .filter((d) => d.status === "confirmed")
      .filter((d) => {
        const date = new Date(d.donation_date);
        return (
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      })
      .reduce((acc, d) => acc + Number(d.amount || 0), 0);
  }, [donations]);

  const pendingCount = useMemo(
    () => donations.filter((d) => d.status === "pending").length,
    [donations],
  );

  const handleAction = async (id, action) => {
    setActionLoading(id + action);
    try {
      if (action === "confirm") await api.confirmDonation(token, id);
      else if (action === "void") await api.voidDonation(token, id);
      else if (action === "refund") await api.refundDonation(token, id);
      onRefresh();
    } catch (err) {
      alert("Action failed: " + (err.message || "Unknown error"));
    } finally {
      setActionLoading(null);
    }
  };

  const detailDonation = donations.find((d) => d.id === detailId);
  const detailDonor = detailDonation ? donorMap[detailDonation.donor_id] : null;
  const detailPledge = detailDonation?.pledge_id
    ? pledges.find((p) => p.id === detailDonation.pledge_id)
    : null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Donations</h1>
          <p className="page-subtitle">
            Record and finalize gifts received — the module's core financial
            entity
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowRecord(true)}>
          <Icon name="plus" size={18} /> Record donation
        </button>
      </div>

      <div className="tabs">
        <button
          className={classNames("tab", tab === "all" && "active")}
          onClick={() => setTab("all")}
        >
          All Donations
        </button>
        <button
          className={classNames("tab", tab === "pending" && "active")}
          onClick={() => setTab("pending")}
        >
          Pending Confirmation
        </button>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon blue">
            <Icon name="receipts" size={22} />
          </div>
          <div className="stat-value">{formatCurrency(confirmedThisMonth)}</div>
          <div className="stat-label">Total Confirmed (This Month)</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber">
            <Icon name="bell" size={22} />
          </div>
          <div className="stat-value">{pendingCount}</div>
          <div className="stat-label">Pending Confirmation Count</div>
        </div>
      </div>

      <div className="card chart-card">
        <div className="card-header">
          <h3>Donations Over Time</h3>
          <p className="card-subtitle">Confirmed donations by week</p>
        </div>
        <WeeklyChart donations={donations} />
      </div>

      <div className="card">
        <div className="table-toolbar">
          <h3 className="table-title">
            {tab === "all" ? "All Donations" : "Pending Confirmation"}
          </h3>
          <div className="table-filters">
            <div className="search-box">
              <Icon name="search" size={16} />
              <input
                type="text"
                placeholder="Search donor, reference..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="voided">Voided</option>
              <option value="refunded">Refunded</option>
            </select>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
            >
              <option value="">All channels</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="check">Check</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="online">Online</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Donor</th>
                <th>Amount</th>
                <th>Payment Channel</th>
                <th>Status</th>
                <th>Donation Date</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="empty">
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    No donations found.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => {
                  const donor = donorMap[d.donor_id];
                  const isLoading =
                    actionLoading && actionLoading.startsWith(d.id);
                  return (
                    <tr key={d.id}>
                      <td>
                        <div className="donor-cell">
                          <span className="donor-name">
                            {donor?.display_name || "Unknown"}
                          </span>
                          {organizations.find(
                            (o) => o.id === donor?.organization_id,
                          )?.name && (
                            <span className="donor-org">
                              {
                                organizations.find(
                                  (o) => o.id === donor?.organization_id,
                                )?.name
                              }
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="amount">{formatCurrency(d.amount)}</td>
                      <td className="capitalize">{d.payment_channel}</td>
                      <td>
                        <StatusPill status={d.status} />
                      </td>
                      <td>{formatDate(d.donation_date)}</td>
                      <td className="actions">
                        <button
                          className="link"
                          onClick={() => setDetailId(d.id)}
                        >
                          View
                        </button>
                        {d.status === "pending" && (
                          <>
                            <button
                              className="link"
                              disabled={isLoading}
                              onClick={() => handleAction(d.id, "confirm")}
                            >
                              {actionLoading === d.id + "confirm"
                                ? "..."
                                : "Confirm"}
                            </button>
                            <button
                              className="link danger"
                              disabled={isLoading}
                              onClick={() => handleAction(d.id, "void")}
                            >
                              {actionLoading === d.id + "void" ? "..." : "Void"}
                            </button>
                          </>
                        )}
                        {d.status === "confirmed" && (
                          <button
                            className="link danger"
                            disabled={isLoading}
                            onClick={() => handleAction(d.id, "refund")}
                          >
                            {actionLoading === d.id + "refund"
                              ? "..."
                              : "Refund"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showRecord && (
        <RecordDonationModal
          token={token}
          donors={donors}
          campaigns={campaigns}
          pledges={pledges}
          onClose={() => setShowRecord(false)}
          onSave={onRefresh}
        />
      )}
      {detailId && (
        <DonationDetailModal
          donation={detailDonation}
          donor={detailDonor}
          pledge={detailPledge}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

/* ============================== donors page ============================== */
function DonorsPage({
  token,
  donors,
  donations,
  organizations,
  loading,
  onRefresh,
}) {
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editDonor, setEditDonor] = useState(null);

  const handleDelete = async (donor) => {
    if (
      !window.confirm(`Delete "${donor.display_name}"? This cannot be undone.`)
    )
      return;
    try {
      await api.deleteDonor(token, donor.id);
      onRefresh();
    } catch (err) {
      alert("Failed to delete donor: " + (err.message || "Unknown error"));
    }
  };

  const donorStats = useMemo(() => {
    const stats = {};
    donors.forEach((d) => {
      stats[d.id] = { totalDonated: 0, count: 0, lastDate: null };
    });
    donations.forEach((d) => {
      const s = stats[d.donor_id];
      if (!s) return;
      s.count += 1;
      if (d.status === "confirmed") s.totalDonated += d.amount || 0;
      const date = new Date(d.donation_date);
      if (!s.lastDate || date > s.lastDate) s.lastDate = date;
    });
    return stats;
  }, [donors, donations]);

  const filtered = useMemo(() => {
    let rows = [...donors];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((d) => {
        const orgName =
          organizations.find((o) => o.id === d.organization_id)?.name || "";
        return (
          (d.display_name || "").toLowerCase().includes(q) ||
          (d.email || "").toLowerCase().includes(q) ||
          orgName.toLowerCase().includes(q)
        );
      });
    }
    return rows.sort((a, b) => {
      const statsA = donorStats[a.id];
      const statsB = donorStats[b.id];
      if (statsA?.lastDate && statsB?.lastDate)
        return statsB.lastDate - statsA.lastDate;
      if (statsA?.lastDate) return -1;
      if (statsB?.lastDate) return 1;
      return (statsB?.totalDonated || 0) - (statsA?.totalDonated || 0);
    });
  }, [donors, search, donorStats]);

  const totalDonatedAll = useMemo(
    () =>
      donations
        .filter((d) => d.status === "confirmed")
        .reduce((acc, d) => acc + Number(d.amount || 0), 0),
    [donations],
  );

  const avgDonation = useMemo(() => {
    const confirmed = donations.filter((d) => d.status === "confirmed");
    return confirmed.length ? totalDonatedAll / confirmed.length : 0;
  }, [donations, totalDonatedAll]);

  const detailDonor = donors.find((d) => d.id === detailId);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Donors</h1>
          <p className="page-subtitle">
            Manage your supporter base and view giving history
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Icon name="plus" size={18} /> New Donor
        </button>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon blue">
            <Icon name="donors" size={22} />
          </div>
          <div className="stat-value">{donors.length}</div>
          <div className="stat-label">Total Donors</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <Icon name="receipts" size={22} />
          </div>
          <div className="stat-value">{formatCurrency(totalDonatedAll)}</div>
          <div className="stat-label">Total Confirmed Donations</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">
            <Icon name="reports" size={22} />
          </div>
          <div className="stat-value">{formatCurrency(avgDonation)}</div>
          <div className="stat-label">Average Donation</div>
        </div>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <h3 className="table-title">All Donors</h3>
          <div className="table-filters">
            <div className="search-box">
              <Icon name="search" size={16} />
              <input
                type="text"
                placeholder="Search name, email, organization..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Donor</th>
                <th>Organization</th>
                <th>Total Donated</th>
                <th># of Donations</th>
                <th>Last Donation</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="empty">
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    No donors found.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => {
                  const stats = donorStats[d.id] || {
                    totalDonated: 0,
                    count: 0,
                    lastDate: null,
                  };
                  return (
                    <tr key={d.id}>
                      <td>
                        <div className="donor-cell">
                          <div className="donor-avatar-sm">
                            {d.display_name?.[0] || "?"}
                          </div>
                          <div>
                            <span className="donor-name">{d.display_name}</span>
                            {d.email && (
                              <span className="donor-org">{d.email}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        {organizations.find((o) => o.id === d.organization_id)
                          ?.name || "—"}
                      </td>
                      <td className="amount">
                        {formatCurrency(stats.totalDonated)}
                      </td>
                      <td>{stats.count}</td>
                      <td>
                        {stats.lastDate ? formatDate(stats.lastDate) : "—"}
                      </td>
                      <td className="actions">
                        <button
                          className="link"
                          onClick={() => setDetailId(d.id)}
                        >
                          View
                        </button>
                        <button
                          className="link"
                          onClick={() => setEditDonor(d)}
                        >
                          Edit
                        </button>
                        <button
                          className="link danger"
                          onClick={() => handleDelete(d)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailId && (
        <DonorDetailModal
          donor={detailDonor}
          donations={donations}
          organizations={organizations}
          onClose={() => setDetailId(null)}
        />
      )}
      {(showCreate || editDonor) && (
        <DonorFormModal
          token={token}
          donor={editDonor}
          onClose={() => {
            setShowCreate(false);
            setEditDonor(null);
          }}
          onSave={onRefresh}
        />
      )}
    </div>
  );
}
/* ============================== my organization page ============================== */
function MyOrganizationPage({ organization, loading, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (organization) setName(organization.name);
  }, [organization]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem("giving_token");
      const updated = await api.updateMyOrganization(token, { name });
      onUpdate(updated);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>My Organization</h1>
          <p className="page-subtitle">Manage your organization's profile</p>
        </div>
        {!editing && (
          <button className="btn btn-primary" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        {loading ? (
          <div className="empty">Loading...</div>
        ) : !organization ? (
          <div className="empty">Organization not found.</div>
        ) : editing ? (
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>Organization Name</label>
              <input
                type="text"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            {error && <div className="error-text">{error}</div>}
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        ) : (
          <div className="detail-list">
            <div className="detail-row">
              <span className="detail-label">Name</span>
              <span className="detail-value">{organization.name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Organization ID</span>
              <span className="detail-value text-muted" title={organization.id}>
                {organization.id.slice(0, 8)}…{organization.id.slice(-4)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
/* ============================== receipt modal ============================== */
function ReceiptModal({ receipt, onClose }) {
  if (!receipt) return null;

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt ${receipt.receipt_number}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; color: #111; }
          .receipt-header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 20px; margin-bottom: 30px; }
          .receipt-header h1 { margin: 0; font-size: 28px; letter-spacing: 2px; }
          .receipt-header p { margin: 8px 0 0; color: #666; font-size: 14px; }
          .row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
          .row:last-child { border-bottom: none; }
          .label { color: #666; font-size: 14px; }
          .value { font-weight: 600; }
          .amount { font-size: 24px; font-weight: 700; text-align: center; margin: 30px 0; padding: 20px; background: #f9fafb; border-radius: 8px; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #999; }
          @media print { body { padding: 0; } button { display: none; } }
        </style>
      </head>
      <body>
        <div class="receipt-header">
          <h1>OFFICIAL RECEIPT</h1>
          <p>No. ${receipt.receipt_number}</p>
        </div>
        <div class="row"><span class="label">Date Issued</span><span class="value">${formatDate(receipt.issued_at)}</span></div>
        <div class="row"><span class="label">Donor Name</span><span class="value">${receipt.name}</span></div>
        ${receipt.donor_email ? `<div class="row"><span class="label">Email</span><span class="value">${receipt.donor_email}</span></div>` : ""}
        <div class="row"><span class="label">Donation Date</span><span class="value">${formatDate(receipt.donation_date)}</span></div>
        <div class="row"><span class="label">Payment Method</span><span class="value capitalize">${receipt.payment_channel || "—"}</span></div>
        <div class="amount">${formatCurrency(receipt.amount)}</div>
        <div class="footer">
          Thank you for your generous contribution.<br>
          This receipt serves as official proof of donation.
        </div>
        <button onclick="window.print()" style="margin-top:30px;padding:10px 20px;background:#111;color:#fff;border:none;border-radius:6px;cursor:pointer;width:100%;">Print Receipt</button>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Modal
      title={`Receipt ${receipt.receipt_number}`}
      onClose={onClose}
      size="md"
    >
      <div className="detail-grid" style={{ marginBottom: 20 }}>
        <div className="detail-item">
          <span className="detail-label">Receipt #</span>
          <span className="detail-value">
            <code>{receipt.receipt_number}</code>
          </span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Amount</span>
          <span className="detail-value">{formatCurrency(receipt.amount)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Donor</span>
          <span className="detail-value">{receipt.name}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Issued</span>
          <span className="detail-value">{formatDate(receipt.issued_at)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Donation Date</span>
          <span className="detail-value">
            {formatDate(receipt.donation_date)}
          </span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Channel</span>
          <span className="detail-value capitalize">
            {receipt.payment_channel || "—"}
          </span>
        </div>
      </div>
      <button
        className="btn btn-primary"
        onClick={handlePrint}
        style={{ width: "100%" }}
      >
        <Icon name="receipts" size={18} /> View & Print Receipt
      </button>
    </Modal>
  );
}

/* ============================== receipts page ============================== */
function ReceiptsPage({ token, donations, donors, loading, onRefresh }) {
  const [receipts, setReceipts] = useState([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [detailReceipt, setDetailReceipt] = useState(null);
  const [generating, setGenerating] = useState(null);
  const [error, setError] = useState(null);

  const fetchReceipts = useCallback(async () => {
    setReceiptsLoading(true);
    try {
      const res = await api.listReceipts(token);
      setReceipts(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setReceipts([]);
    } finally {
      setReceiptsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const donorMap = useMemo(() => {
    const m = {};
    donors.forEach((d) => (m[d.id] = d));
    return m;
  }, [donors]);

  const confirmedDonationsWithoutReceipts = useMemo(() => {
    const receiptedIds = new Set(receipts.map((r) => r.donation_id));
    return donations.filter(
      (d) => d.status === "confirmed" && !receiptedIds.has(d.id),
    );
  }, [donations, receipts]);

  const handleGenerate = async (donation) => {
    setGenerating(donation.id);
    setError(null);
    try {
      await api.createReceipt(token, { donation_id: donation.id });
      fetchReceipts();
      onRefresh();
    } catch (err) {
      if (err.status === 409) {
        fetchReceipts();
      } else {
        setError(err.message);
      }
    } finally {
      setGenerating(null);
    }
  };

  const handleView = async (receipt) => {
    try {
      const full = await api.getReceipt(token, receipt.id);
      setDetailReceipt(full);
    } catch (err) {
      alert("Failed to load receipt: " + err.message);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Receipts</h1>
          <p className="page-subtitle">Generate and view donation receipts</p>
        </div>
      </div>

      {error && (
        <div
          className="card error-banner"
          style={{ marginBottom: 16, color: "#dc2626" }}
        >
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="table-toolbar">
          <h3 className="table-title">Ready to Receipt</h3>
          <span className="table-subtitle">
            {confirmedDonationsWithoutReceipts.length} confirmed donations
            without receipts
          </span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Donor</th>
                <th>Amount</th>
                <th>Date</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="empty">
                    Loading...
                  </td>
                </tr>
              ) : confirmedDonationsWithoutReceipts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty">
                    All confirmed donations have receipts.
                  </td>
                </tr>
              ) : (
                confirmedDonationsWithoutReceipts.map((d) => {
                  const donor = donorMap[d.donor_id];
                  return (
                    <tr key={d.id}>
                      <td>{donor?.display_name || "Unknown"}</td>
                      <td className="amount">{formatCurrency(d.amount)}</td>
                      <td>{formatDate(d.donation_date)}</td>
                      <td className="actions">
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={generating === d.id}
                          onClick={() => handleGenerate(d)}
                        >
                          {generating === d.id
                            ? "Generating..."
                            : "Generate Receipt"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <h3 className="table-title">Issued Receipts</h3>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Donor</th>
                <th>Amount</th>
                <th>Issued</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {receiptsLoading ? (
                <tr>
                  <td colSpan={5} className="empty">
                    Loading...
                  </td>
                </tr>
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty">
                    No receipts issued yet.
                  </td>
                </tr>
              ) : (
                receipts.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <code>{r.receipt_number}</code>
                    </td>
                    <td>{r.name}</td>
                    <td className="amount">{formatCurrency(r.amount)}</td>
                    <td>{formatDate(r.issued_at)}</td>
                    <td className="actions">
                      <button className="link" onClick={() => handleView(r)}>
                        View / Print
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailReceipt && (
        <ReceiptModal
          receipt={detailReceipt}
          onClose={() => setDetailReceipt(null)}
        />
      )}
    </div>
  );
}
/* ============================== campaign status pill ==============================
   Add this near the existing StatusPill function. Kept separate because
   campaign statuses (draft/active/closed) are a different set from
   donation statuses (confirmed/pending/voided/refunded). */
function CampaignStatusPill({ status }) {
  const map = {
    active: { cls: "status-confirmed", label: "Active" },
    closed: { cls: "status-voided", label: "Closed" },
    draft: { cls: "status-pending", label: "Draft" },
  };
  const s = map[status] || { cls: "status-pending", label: status };
  return <span className={classNames("status-pill", s.cls)}>{s.label}</span>;
}

/* ============================== campaign form modal ============================== */
function CampaignFormModal({ token, campaign, onClose, onSave }) {
  const isEdit = !!campaign;
  const [form, setForm] = useState({
    name: campaign?.name || "",
    description: campaign?.description || "",
    goal_amount: campaign?.goal_amount || "",
    start_date: campaign?.start_date ? campaign.start_date.split("T")[0] : "",
    end_date: campaign?.end_date ? campaign.end_date.split("T")[0] : "",
    status: campaign?.status || "draft",
  });
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        goal_amount: Number(form.goal_amount),
        start_date: form.start_date,
        end_date: form.end_date,
        status: form.status,
      };
      if (isEdit) {
        await api.updateCampaign(token, campaign.id, payload);
      } else {
        await api.createCampaign(token, payload);
      }
      onSave();
      onClose();
    } catch (err) {
      if (err.body?.error?.fields?.fieldErrors) {
        setFieldErrors(err.body.error.fields.fieldErrors);
      } else {
        alert("Failed to save campaign: " + (err.message || "Unknown error"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit Campaign" : "New Campaign"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="form">
        <div className="form-row">
          <label>Campaign Name *</label>
          <input
            type="text"
            required
            maxLength={255}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
          />
          {fieldErrors.name && (
            <span className="field-error">{fieldErrors.name[0]}</span>
          )}
        </div>
        <div className="form-row">
          <label>Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="form-row">
          <label>Goal Amount (₱) *</label>
          <input
            type="number"
            min="1"
            required
            value={form.goal_amount}
            onChange={(e) => setForm({ ...form, goal_amount: e.target.value })}
          />
          {fieldErrors.goal_amount && (
            <span className="field-error">{fieldErrors.goal_amount[0]}</span>
          )}
        </div>
        <div className="form-row">
          <label>Start Date *</label>
          <input
            type="date"
            required
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
          />
        </div>
        <div className="form-row">
          <label>End Date *</label>
          <input
            type="date"
            required
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
          />
          {fieldErrors.end_date && (
            <span className="field-error">{fieldErrors.end_date[0]}</span>
          )}
        </div>
        <div className="form-row">
          <label>Status *</label>
          <select
            required
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Campaign"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ============================== raised vs goal horizontal bar chart ============================== */
function RaisedVsGoalChart({ campaigns }) {
  const active = campaigns.filter((c) => c.status === "active");
  const maxValue = Math.max(
    ...active.map((c) =>
      Math.max(Number(c.goal_amount), Number(c.raised_amount)),
    ),
    1,
  );

  if (active.length === 0) {
    return (
      <div className="chart-empty">
        <p>No active campaigns yet.</p>
      </div>
    );
  }

  return (
    <div className="hbar-chart">
      <div className="hbar-legend">
        <span className="hbar-legend-item">
          <i className="hbar-swatch hbar-swatch-goal" /> Goal
        </span>
        <span className="hbar-legend-item">
          <i className="hbar-swatch hbar-swatch-raised" /> Raised
        </span>
      </div>
      {active.map((c) => {
        const goalPct = (Number(c.goal_amount) / maxValue) * 100;
        const raisedPct = (Number(c.raised_amount) / maxValue) * 100;
        return (
          <div key={c.id} className="hbar-row">
            <span className="hbar-label" title={c.name}>
              {c.name}
            </span>
            <div className="hbar-track">
              <div className="hbar-goal" style={{ width: `${goalPct}%` }} />
              <div className="hbar-raised" style={{ width: `${raisedPct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================== campaign timeline ============================== */
function CampaignTimeline({ campaigns }) {
  const active = campaigns.filter((c) => c.status === "active");
  if (active.length === 0) {
    return (
      <div className="chart-empty">
        <p>No active campaigns to show on the timeline.</p>
      </div>
    );
  }

  const allDates = active.flatMap((c) => [
    new Date(c.start_date),
    new Date(c.end_date),
  ]);
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));
  const totalSpan = Math.max(maxDate - minDate, 1);

  return (
    <div className="timeline-chart">
      {active.map((c) => {
        const start = new Date(c.start_date);
        const end = new Date(c.end_date);
        const offsetPct = ((start - minDate) / totalSpan) * 100;
        const widthPct = Math.max(((end - start) / totalSpan) * 100, 2);
        return (
          <div key={c.id} className="timeline-row">
            <span className="timeline-label">{c.name}</span>
            <div className="timeline-track">
              <div
                className="timeline-bar"
                style={{ marginLeft: `${offsetPct}%`, width: `${widthPct}%` }}
              />
            </div>
            <span className="timeline-range">
              {formatDate(c.start_date)} – {formatDate(c.end_date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ============================== campaigns page ============================== */
function CampaignsPage({ token, campaigns, loading, onRefresh }) {
  const [tab, setTab] = useState("all"); // 'all' | 'performance'
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);

  const filtered = useMemo(() => {
    let rows = campaigns;
    if (statusFilter) rows = rows.filter((c) => c.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((c) => c.name.toLowerCase().includes(q));
    }
    return rows;
  }, [campaigns, search, statusFilter]);

  const activeCount = campaigns.filter((c) => c.status === "active").length;
  const totalRaised = campaigns.reduce(
    (acc, c) => acc + Number(c.raised_amount || 0),
    0,
  );
  const avgCompletion =
    campaigns.length === 0
      ? 0
      : Math.round(
          (campaigns.reduce((acc, c) => {
            const goal = Number(c.goal_amount) || 1;
            return acc + Math.min(Number(c.raised_amount || 0) / goal, 1);
          }, 0) /
            campaigns.length) *
            100,
        );

  const percentComplete = (c) => {
    const goal = Number(c.goal_amount) || 1;
    return Math.round((Number(c.raised_amount || 0) / goal) * 100);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Campaigns</h1>
          <p className="page-subtitle">
            Create and track fundraising campaigns against their goals
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingCampaign(null);
            setShowForm(true);
          }}
        >
          <Icon name="plus" size={18} /> New campaign
        </button>
      </div>

      <div className="tabs">
        <button
          className={classNames("tab", tab === "all" && "active")}
          onClick={() => setTab("all")}
        >
          All Campaigns
        </button>
        <button
          className={classNames("tab", tab === "performance" && "active")}
          onClick={() => setTab("performance")}
        >
          Performance
        </button>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{activeCount}</div>
          <div className="stat-label">Active Campaigns</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatCurrency(totalRaised)}</div>
          <div className="stat-label">Total Raised This Year</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{avgCompletion}%</div>
          <div className="stat-label">Average Campaign Completion</div>
        </div>
      </div>

      {tab === "all" ? (
        <div className="card">
          <div className="table-toolbar">
            <h3 className="table-title">All Campaigns</h3>
            <div className="table-filters">
              <div className="search-box">
                <Icon name="search" size={16} />
                <input
                  type="text"
                  placeholder="Search campaigns..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Goal</th>
                  <th>Raised</th>
                  <th>% Complete</th>
                  <th>Status</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th className="actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="empty">
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty">
                      No campaigns found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td className="amount">
                        {formatCurrency(c.goal_amount)}
                      </td>
                      <td className="amount">
                        {formatCurrency(c.raised_amount)}
                      </td>
                      <td>{percentComplete(c)}%</td>
                      <td>
                        <CampaignStatusPill status={c.status} />
                      </td>
                      <td>{formatDate(c.start_date)}</td>
                      <td>{formatDate(c.end_date)}</td>
                      <td className="actions">
                        <button
                          className="link"
                          onClick={() => {
                            setEditingCampaign(c);
                            setShowForm(true);
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          <div className="card">
            <h3 className="table-title">Raised vs Goal by Campaign</h3>
            <p className="page-subtitle">Active campaigns</p>
            <RaisedVsGoalChart campaigns={campaigns} />
          </div>
          <div className="card">
            <h3 className="table-title">Campaign Timeline</h3>
            <p className="page-subtitle">Start / end dates</p>
            <CampaignTimeline campaigns={campaigns} />
          </div>
        </>
      )}

      {showForm && (
        <CampaignFormModal
          token={token}
          campaign={editingCampaign}
          onClose={() => setShowForm(false)}
          onSave={onRefresh}
        />
      )}
    </div>
  );
}

/* ============================== pledge status pill ==============================
   Pledge statuses (pending/partially_fulfilled/fulfilled) come from a
   Postgres generated column on donation_pledges — a different set from
   both donation statuses and campaign statuses, so it gets its own pill. */
function PledgeStatusPill({ status }) {
  const map = {
    pending: { cls: "status-pending", label: "Pending" },
    partially_fulfilled: {
      cls: "status-partial",
      label: "Partially Fulfilled",
    },
    fulfilled: { cls: "status-fulfilled", label: "Fulfilled" },
  };
  const s = map[status] || { cls: "status-pending", label: status };
  return <span className={classNames("status-pill", s.cls)}>{s.label}</span>;
}

/* ============================== pledge fulfillment donut chart ============================== */
function PledgeDonutChart({ fulfilled, outstanding }) {
  const total = Number(fulfilled) + Number(outstanding);

  if (total <= 0) {
    return (
      <div className="chart-empty">
        <p>No pledges recorded yet.</p>
      </div>
    );
  }

  const radius = 70;
  const stroke = 26;
  const circumference = 2 * Math.PI * radius;
  const fulfilledLen = circumference * (Number(fulfilled) / total);

  return (
    <div className="donut-chart-wrap">
      <svg viewBox="0 0 180 180" width="180" height="180">
        <g transform="rotate(-90 90 90)">
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={stroke}
          />
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="#10b981"
            strokeWidth={stroke}
            strokeDasharray={`${fulfilledLen} ${circumference - fulfilledLen}`}
            strokeLinecap="butt"
          />
        </g>
      </svg>
      <div className="donut-legend">
        <div className="donut-legend-item">
          <span
            className="donut-legend-swatch"
            style={{ background: "#10b981" }}
          />
          Fulfilled{" "}
          <span className="donut-legend-value">
            {formatCurrency(fulfilled)}
          </span>
        </div>
        <div className="donut-legend-item">
          <span
            className="donut-legend-swatch"
            style={{ background: "#f59e0b" }}
          />
          Outstanding{" "}
          <span className="donut-legend-value">
            {formatCurrency(outstanding)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================== pledge form modal ============================== */
function PledgeFormModal({
  token,
  donors,
  campaigns,
  pledge,
  onClose,
  onSave,
}) {
  const isEdit = !!pledge;
  const [form, setForm] = useState({
    donor_id: pledge?.donor_id || "",
    campaign_id: pledge?.campaign_id || "",
    amount_pledged: pledge?.amount_pledged || "",
    pledge_date: pledge?.pledge_date
      ? pledge.pledge_date.split("T")[0]
      : new Date().toISOString().split("T")[0],
    due_date: pledge?.due_date ? pledge.due_date.split("T")[0] : "",
  });
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      const payload = {
        donor_id: form.donor_id,
        campaign_id: form.campaign_id || undefined,
        amount_pledged: Number(form.amount_pledged),
        pledge_date: form.pledge_date,
        due_date: form.due_date || undefined,
      };
      if (isEdit) {
        await api.updatePledge(token, pledge.id, payload);
      } else {
        await api.createPledge(token, payload);
      }
      onSave();
      onClose();
    } catch (err) {
      if (err.body?.error?.fields?.fieldErrors) {
        setFieldErrors(err.body.error.fields.fieldErrors);
      } else {
        alert("Failed to save pledge: " + (err.message || "Unknown error"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit Pledge" : "New Pledge"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="form">
        <div className="form-row">
          <label>Donor *</label>
          <select
            required
            value={form.donor_id}
            onChange={(e) => setForm({ ...form, donor_id: e.target.value })}
          >
            <option value="">Select donor</option>
            {donors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.display_name}
              </option>
            ))}
          </select>
          {fieldErrors.donor_id && (
            <span className="field-error">{fieldErrors.donor_id[0]}</span>
          )}
        </div>
        <div className="form-row">
          <label>Campaign</label>
          <select
            value={form.campaign_id}
            onChange={(e) => setForm({ ...form, campaign_id: e.target.value })}
          >
            <option value="">No campaign</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>Amount Pledged (₱) *</label>
          <input
            type="number"
            min="1"
            required
            value={form.amount_pledged}
            onChange={(e) =>
              setForm({ ...form, amount_pledged: e.target.value })
            }
          />
          {fieldErrors.amount_pledged && (
            <span className="field-error">{fieldErrors.amount_pledged[0]}</span>
          )}
        </div>
        <div className="form-row">
          <label>Pledge Date *</label>
          <input
            type="date"
            required
            value={form.pledge_date}
            onChange={(e) => setForm({ ...form, pledge_date: e.target.value })}
          />
        </div>
        <div className="form-row">
          <label>Due Date</label>
          <input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />
          {fieldErrors.due_date && (
            <span className="field-error">{fieldErrors.due_date[0]}</span>
          )}
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Pledge"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ============================== pledge detail modal ============================== */
function PledgeDetailModal({ pledge, donations, onClose }) {
  if (!pledge) return null;
  const outstanding = Math.max(
    Number(pledge.amount_pledged) - Number(pledge.amount_fulfilled),
    0,
  );
  const linkedDonations = donations
    .filter((d) => d.pledge_id === pledge.id)
    .sort((a, b) => new Date(b.donation_date) - new Date(a.donation_date));

  return (
    <Modal title="Pledge Details" onClose={onClose} size="lg">
      <div className="detail-grid">
        <div className="detail-item">
          <span className="detail-label">Donor</span>
          <span className="detail-value">{pledge.donor_name}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Campaign</span>
          <span className="detail-value">{pledge.campaign_name || "—"}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Amount Pledged</span>
          <span className="detail-value">
            {formatCurrency(pledge.amount_pledged)}
          </span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Amount Fulfilled</span>
          <span className="detail-value">
            {formatCurrency(pledge.amount_fulfilled)}
          </span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Outstanding</span>
          <span className="detail-value">{formatCurrency(outstanding)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Status</span>
          <span className="detail-value">
            <PledgeStatusPill status={pledge.status} />
          </span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Pledge Date</span>
          <span className="detail-value">{formatDate(pledge.pledge_date)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Due Date</span>
          <span
            className={classNames(
              "detail-value",
              pledge.is_overdue && "overdue-text",
            )}
          >
            {pledge.due_date ? formatDate(pledge.due_date) : "—"}
          </span>
        </div>
      </div>

      <h4 className="modal-section-title">Donations Fulfilling This Pledge</h4>
      {linkedDonations.length === 0 ? (
        <p className="empty-text">
          No donations recorded against this pledge yet.
        </p>
      ) : (
        <table className="table modal-table">
          <thead>
            <tr>
              <th>Amount</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {linkedDonations.map((d) => (
              <tr key={d.id}>
                <td className="amount">{formatCurrency(d.amount)}</td>
                <td>
                  <StatusPill status={d.status} />
                </td>
                <td>{formatDate(d.donation_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

/* ============================== pledges page ============================== */
function PledgesPage({
  token,
  donors,
  campaigns,
  pledges,
  donations,
  summary,
  loading,
  onRefresh,
}) {
  const [tab, setTab] = useState("all"); // 'all' | 'overdue'
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingPledge, setEditingPledge] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const filtered = useMemo(() => {
    let rows = [...pledges];
    if (tab === "overdue") rows = rows.filter((p) => p.is_overdue);
    if (campaignFilter)
      rows = rows.filter((p) => p.campaign_id === campaignFilter);
    if (statusFilter) rows = rows.filter((p) => p.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((p) => (p.donor_name || "").toLowerCase().includes(q));
    }
    return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [pledges, tab, search, campaignFilter, statusFilter]);

  // Prefer the server-computed summary (matches backend's definition of
  // "outstanding" exactly); fall back to a client-side estimate only if
  // the summary endpoint hasn't loaded yet.
  const overdueCount =
    summary?.overdue_count ?? pledges.filter((p) => p.is_overdue).length;
  const totalOutstanding =
    summary?.total_outstanding ??
    pledges.reduce(
      (acc, p) =>
        acc +
        Math.max(Number(p.amount_pledged) - Number(p.amount_fulfilled), 0),
      0,
    );
  const totalFulfilled =
    summary?.total_fulfilled ??
    pledges.reduce((acc, p) => acc + Number(p.amount_fulfilled), 0);

  const handleDelete = async (pledge) => {
    if (
      !window.confirm(
        `Delete the pledge from ${pledge.donor_name}? This cannot be undone.`,
      )
    )
      return;
    setDeleting(pledge.id);
    try {
      await api.deletePledge(token, pledge.id);
      onRefresh();
    } catch (err) {
      alert("Failed to delete pledge: " + (err.message || "Unknown error"));
    } finally {
      setDeleting(null);
    }
  };

  const detailPledge = pledges.find((p) => p.id === detailId);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Pledges</h1>
          <p className="page-subtitle">
            Track donor commitments separately from received funds
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingPledge(null);
            setShowForm(true);
          }}
        >
          <Icon name="plus" size={18} /> New pledge
        </button>
      </div>

      <div className="tabs">
        <button
          className={classNames("tab", tab === "all" && "active")}
          onClick={() => setTab("all")}
        >
          All Pledges
        </button>
        <button
          className={classNames("tab", tab === "overdue" && "active")}
          onClick={() => setTab("overdue")}
        >
          Overdue
        </button>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon amber">
            <Icon name="clock" size={22} />
          </div>
          <div className="stat-value">{formatCurrency(totalOutstanding)}</div>
          <div className="stat-label">Total Outstanding</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">
            <Icon name="alert" size={22} />
          </div>
          <div className="stat-value">{overdueCount}</div>
          <div className="stat-label">Overdue Pledges</div>
        </div>
      </div>

      <div className="card chart-card">
        <div className="card-header">
          <h3>Pledge Fulfillment Rate</h3>
          <p className="card-subtitle">Fulfilled vs. outstanding amount</p>
        </div>
        <PledgeDonutChart
          fulfilled={totalFulfilled}
          outstanding={totalOutstanding}
        />
      </div>

      <div className="card">
        <div className="table-toolbar">
          <h3 className="table-title">
            {tab === "overdue" ? "Overdue Pledges" : "All Pledges"}
          </h3>
          <div className="table-filters">
            <div className="search-box">
              <Icon name="search" size={16} />
              <input
                type="text"
                placeholder="Search donor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
            >
              <option value="">All campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="partially_fulfilled">Partially Fulfilled</option>
              <option value="fulfilled">Fulfilled</option>
            </select>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Donor</th>
                <th>Campaign</th>
                <th>Amount Pledged</th>
                <th>Amount Fulfilled</th>
                <th>Due Date</th>
                <th>Status</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="empty">
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    No pledges found.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id}>
                    <td>{p.donor_name}</td>
                    <td>{p.campaign_name || "—"}</td>
                    <td className="amount">
                      {formatCurrency(p.amount_pledged)}
                    </td>
                    <td className="amount">
                      {formatCurrency(p.amount_fulfilled)}
                    </td>
                    <td className={classNames(p.is_overdue && "overdue-text")}>
                      {p.due_date ? formatDate(p.due_date) : "—"}
                    </td>
                    <td>
                      <PledgeStatusPill status={p.status} />
                    </td>
                    <td className="actions">
                      <button
                        className="link"
                        onClick={() => setDetailId(p.id)}
                      >
                        View
                      </button>
                      <button
                        className="link"
                        onClick={() => {
                          setEditingPledge(p);
                          setShowForm(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="link danger"
                        disabled={deleting === p.id}
                        onClick={() => handleDelete(p)}
                      >
                        {deleting === p.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <PledgeFormModal
          token={token}
          donors={donors}
          campaigns={campaigns}
          pledge={editingPledge}
          onClose={() => setShowForm(false)}
          onSave={onRefresh}
        />
      )}
      {detailId && (
        <PledgeDetailModal
          pledge={detailPledge}
          donations={donations}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

/* ============================== reports page ============================== */
function MonthlyFinancialChart({ data }) {
  const maxValue = useMemo(
    () => Math.max(...data.map((d) => Math.max(d.confirmed, d.refunded, 1)), 1),
    [data],
  );

  if (data.every((d) => d.confirmed === 0 && d.refunded === 0)) {
    return (
      <div className="chart-empty">
        <p>No confirmed or refunded donations for this year.</p>
      </div>
    );
  }

  return (
    <div
      className="chart-container"
      style={{ height: 320, padding: "16px 20px 20px" }}
    >
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 12,
          fontSize: 12,
          color: "var(--text-muted)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: "#3b82f6",
            }}
          />{" "}
          Confirmed
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: "#14b8a6",
            }}
          />{" "}
          Refunded
        </span>
      </div>
      <div
        className="chart-bars"
        style={{ height: "calc(100% - 28px)", gap: 12 }}
      >
        {data.map((m, i) => {
          const cPct = Math.max((m.confirmed / maxValue) * 100, 3);
          const rPct = Math.max((m.refunded / maxValue) * 100, 3);
          return (
            <div key={i} className="chart-bar-wrapper" style={{ gap: 6 }}>
              <div
                className="chart-bar-track"
                style={{
                  height: 220,
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  gap: 3,
                  padding: "0 4px",
                }}
              >
                <div
                  style={{
                    width: "38%",
                    maxWidth: 22,
                    height: `${cPct}%`,
                    background: "linear-gradient(180deg, #3b82f6, #60a5fa)",
                    borderRadius: "6px 6px 0 0",
                    minHeight: 4,
                  }}
                  title={`Confirmed: ${formatCurrency(m.confirmed)}`}
                />
                <div
                  style={{
                    width: "38%",
                    maxWidth: 22,
                    height: `${rPct}%`,
                    background: "linear-gradient(180deg, #14b8a6, #2dd4bf)",
                    borderRadius: "6px 6px 0 0",
                    minHeight: 4,
                  }}
                  title={`Refunded: ${formatCurrency(m.refunded)}`}
                />
              </div>
              <span className="chart-bar-label">{m.shortLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopDonorsChart({ donorStats }) {
  const top5 = donorStats.slice(0, 5);
  const maxValue = Math.max(...top5.map((s) => s.totalDonated), 1);

  if (top5.length === 0) {
    return (
      <div className="chart-empty">
        <p>No confirmed donations yet.</p>
      </div>
    );
  }

  return (
    <div className="hbar-chart">
      {top5.map((s) => {
        const pct = (s.totalDonated / maxValue) * 100;
        return (
          <div key={s.donor.id} className="hbar-row">
            <span className="hbar-label" title={s.donor.display_name}>
              {s.donor.display_name}
            </span>
            <div className="hbar-track">
              <div className="hbar-raised" style={{ width: `${pct}%` }} />
            </div>
            <span
              className="hbar-label"
              style={{ textAlign: "right", minWidth: 90, fontWeight: 600 }}
            >
              {formatCurrency(s.totalDonated)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ReportsPage({ donations, donors, campaigns, organizations, loading }) {
  const currentYear = new Date().getFullYear();
  const [tab, setTab] = useState("financial");
  const [yearFilter, setYearFilter] = useState(currentYear);
  const [donorSearch, setDonorSearch] = useState("");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState("");

  /* ---------- Financial Summary ---------- */
  const availableYears = useMemo(() => {
    const years = new Set([currentYear]);
    donations.forEach((d) => {
      const y = new Date(d.donation_date).getFullYear();
      if (!isNaN(y)) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [donations, currentYear]);

  const monthlyData = useMemo(() => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      months.push({
        monthIndex: i,
        label: new Date(yearFilter, i, 1).toLocaleDateString("en-US", {
          month: "long",
        }),
        shortLabel: new Date(yearFilter, i, 1).toLocaleDateString("en-US", {
          month: "short",
        }),
        confirmed: 0,
        refunded: 0,
        net: 0,
      });
    }
    donations.forEach((d) => {
      const date = new Date(d.donation_date);
      if (date.getFullYear() !== yearFilter) return;
      const m = date.getMonth();
      if (d.status === "confirmed")
        months[m].confirmed += Number(d.amount || 0);
      if (d.status === "refunded") months[m].refunded += Number(d.amount || 0);
    });
    months.forEach((m) => {
      m.net = m.confirmed - m.refunded;
    });
    return months;
  }, [donations, yearFilter]);

  const financialTotals = useMemo(() => {
    return monthlyData.reduce(
      (acc, m) => ({
        confirmed: acc.confirmed + m.confirmed,
        refunded: acc.refunded + m.refunded,
        net: acc.net + m.net,
      }),
      { confirmed: 0, refunded: 0, net: 0 },
    );
  }, [monthlyData]);

  /* ---------- Campaign Performance ---------- */
  const campaignReportStats = useMemo(() => {
    const totalRaised = campaigns.reduce(
      (acc, c) => acc + Number(c.raised_amount || 0),
      0,
    );
    const avgCompletion =
      campaigns.length === 0
        ? 0
        : Math.round(
            (campaigns.reduce((acc, c) => {
              const goal = Number(c.goal_amount) || 1;
              return acc + Math.min(Number(c.raised_amount || 0) / goal, 1);
            }, 0) /
              campaigns.length) *
              100,
          );
    return { totalRaised, avgCompletion, count: campaigns.length };
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    let rows = [...campaigns];
    if (campaignStatusFilter)
      rows = rows.filter((c) => c.status === campaignStatusFilter);
    return rows.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
  }, [campaigns, campaignStatusFilter]);

  const percentComplete = (c) => {
    const goal = Number(c.goal_amount) || 1;
    return Math.round((Number(c.raised_amount || 0) / goal) * 100);
  };

  /* ---------- Donor Giving History ---------- */
  const donorReportStats = useMemo(() => {
    const stats = {};
    donors.forEach((d) => {
      stats[d.id] = {
        donor: d,
        totalDonated: 0,
        count: 0,
        firstDate: null,
        lastDate: null,
      };
    });
    donations.forEach((d) => {
      if (d.status !== "confirmed") return;
      const s = stats[d.donor_id];
      if (!s) return;
      s.totalDonated += Number(d.amount || 0);
      s.count += 1;
      const date = new Date(d.donation_date);
      if (!s.firstDate || date < s.firstDate) s.firstDate = date;
      if (!s.lastDate || date > s.lastDate) s.lastDate = date;
    });
    return Object.values(stats)
      .filter((s) => s.count > 0)
      .sort((a, b) => b.totalDonated - a.totalDonated);
  }, [donors, donations]);

  const filteredDonorStats = useMemo(() => {
    if (!donorSearch.trim()) return donorReportStats;
    const q = donorSearch.toLowerCase();
    return donorReportStats.filter((s) => {
      const orgName =
        organizations.find((o) => o.id === s.donor.organization_id)?.name || "";
      return (
        (s.donor.display_name || "").toLowerCase().includes(q) ||
        (s.donor.email || "").toLowerCase().includes(q) ||
        orgName.toLowerCase().includes(q)
      );
    });
  }, [donorReportStats, donorSearch, organizations]);

  const totalConfirmedAll = useMemo(
    () =>
      donations
        .filter((d) => d.status === "confirmed")
        .reduce((acc, d) => acc + Number(d.amount || 0), 0),
    [donations],
  );

  const avgDonationAll = useMemo(() => {
    const confirmed = donations.filter((d) => d.status === "confirmed");
    return confirmed.length ? totalConfirmedAll / confirmed.length : 0;
  }, [donations, totalConfirmedAll]);

  /* ---------- Export ---------- */
  const handleExport = () => {
    if (tab === "financial") {
      const headers = ["Month", "Confirmed Total", "Refunded Total", "Net"];
      const rows = monthlyData.map((m) => [
        m.label,
        m.confirmed,
        m.refunded,
        m.net,
      ]);
      rows.push([
        "Total",
        financialTotals.confirmed,
        financialTotals.refunded,
        financialTotals.net,
      ]);
      const csv = [
        headers.join(","),
        ...rows.map((r) => r.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `financial-summary-${yearFilter}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (tab === "campaigns") {
      const headers = [
        "Name",
        "Goal",
        "Raised",
        "% Complete",
        "Status",
        "Start Date",
        "End Date",
      ];
      const rows = filteredCampaigns.map((c) => [
        c.name,
        c.goal_amount,
        c.raised_amount,
        percentComplete(c) + "%",
        c.status,
        c.start_date,
        c.end_date,
      ]);
      const csv = [
        headers.join(","),
        ...rows.map((r) => r.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `campaign-performance-${currentYear}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (tab === "donors") {
      const headers = [
        "Donor",
        "Organization",
        "Total Donated",
        "# Donations",
        "Average Donation",
        "Last Donation",
      ];
      const rows = filteredDonorStats.map((s) => [
        s.donor.display_name,
        organizations.find((o) => o.id === s.donor.organization_id)?.name || "",
        s.totalDonated,
        s.count,
        (s.totalDonated / s.count).toFixed(2),
        s.lastDate ? s.lastDate.toISOString().split("T")[0] : "",
      ]);
      const csv = [
        headers.join(","),
        ...rows.map((r) => r.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `donor-giving-history-${currentYear}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p className="page-subtitle">
            Aggregate financial and campaign reporting for leadership and audit
          </p>
        </div>
        <button className="btn btn-secondary" onClick={handleExport}>
          Export
        </button>
      </div>

      <div className="tabs">
        <button
          className={classNames("tab", tab === "financial" && "active")}
          onClick={() => setTab("financial")}
        >
          Financial Summary
        </button>
        <button
          className={classNames("tab", tab === "campaigns" && "active")}
          onClick={() => setTab("campaigns")}
        >
          Campaign Performance
        </button>
        <button
          className={classNames("tab", tab === "donors" && "active")}
          onClick={() => setTab("donors")}
        >
          Donor Giving History
        </button>
      </div>

      {tab === "financial" && (
        <>
          <div className="card">
            <div
              className="card-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <h3>Confirmed vs. Refunded</h3>
                <p className="card-subtitle">By month</p>
              </div>
              <div className="table-filters">
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(Number(e.target.value))}
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {loading ? (
              <div className="chart-empty">
                <p>Loading...</p>
              </div>
            ) : (
              <MonthlyFinancialChart data={monthlyData} />
            )}
          </div>

          <div className="card">
            <div className="table-toolbar">
              <h3 className="table-title">Monthly Summary</h3>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Confirmed Total</th>
                    <th>Refunded Total</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="empty">
                        Loading...
                      </td>
                    </tr>
                  ) : monthlyData.every(
                      (m) => m.confirmed === 0 && m.refunded === 0,
                    ) ? (
                    <tr>
                      <td colSpan={4} className="empty">
                        No data for {yearFilter}.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {monthlyData.map((m, i) => (
                        <tr key={i}>
                          <td>{m.label}</td>
                          <td className="amount">
                            {formatCurrency(m.confirmed)}
                          </td>
                          <td className="amount">
                            {formatCurrency(m.refunded)}
                          </td>
                          <td
                            className="amount"
                            style={{
                              color: m.net < 0 ? "var(--danger)" : "inherit",
                            }}
                          >
                            {formatCurrency(m.net)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ fontWeight: 700, background: "#f8fafc" }}>
                        <td>Total</td>
                        <td className="amount">
                          {formatCurrency(financialTotals.confirmed)}
                        </td>
                        <td className="amount">
                          {formatCurrency(financialTotals.refunded)}
                        </td>
                        <td
                          className="amount"
                          style={{
                            color:
                              financialTotals.net < 0
                                ? "var(--danger)"
                                : "inherit",
                          }}
                        >
                          {formatCurrency(financialTotals.net)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "campaigns" && (
        <>
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-icon blue">
                <Icon name="campaigns" size={22} />
              </div>
              <div className="stat-value">{campaignReportStats.count}</div>
              <div className="stat-label">Total Campaigns</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green">
                <Icon name="receipts" size={22} />
              </div>
              <div className="stat-value">
                {formatCurrency(campaignReportStats.totalRaised)}
              </div>
              <div className="stat-label">Total Raised</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon purple">
                <Icon name="reports" size={22} />
              </div>
              <div className="stat-value">
                {campaignReportStats.avgCompletion}%
              </div>
              <div className="stat-label">Average Completion</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Raised vs Goal</h3>
              <p className="card-subtitle">Active campaigns</p>
            </div>
            <RaisedVsGoalChart campaigns={campaigns} />
          </div>

          <div className="card">
            <div className="table-toolbar">
              <h3 className="table-title">All Campaigns</h3>
              <div className="table-filters">
                <select
                  value={campaignStatusFilter}
                  onChange={(e) => setCampaignStatusFilter(e.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Goal</th>
                    <th>Raised</th>
                    <th>% Complete</th>
                    <th>Status</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="empty">
                        Loading...
                      </td>
                    </tr>
                  ) : filteredCampaigns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty">
                        No campaigns found.
                      </td>
                    </tr>
                  ) : (
                    filteredCampaigns.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td className="amount">
                          {formatCurrency(c.goal_amount)}
                        </td>
                        <td className="amount">
                          {formatCurrency(c.raised_amount)}
                        </td>
                        <td>{percentComplete(c)}%</td>
                        <td>
                          <CampaignStatusPill status={c.status} />
                        </td>
                        <td>{formatDate(c.start_date)}</td>
                        <td>{formatDate(c.end_date)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "donors" && (
        <>
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-icon blue">
                <Icon name="donors" size={22} />
              </div>
              <div className="stat-value">{donorReportStats.length}</div>
              <div className="stat-label">Donors with Gifts</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green">
                <Icon name="receipts" size={22} />
              </div>
              <div className="stat-value">
                {formatCurrency(totalConfirmedAll)}
              </div>
              <div className="stat-label">Total Confirmed Donations</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon purple">
                <Icon name="reports" size={22} />
              </div>
              <div className="stat-value">{formatCurrency(avgDonationAll)}</div>
              <div className="stat-label">Average Donation</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Top Donors</h3>
              <p className="card-subtitle">By total confirmed giving</p>
            </div>
            <TopDonorsChart donorStats={donorReportStats} />
          </div>

          <div className="card">
            <div className="table-toolbar">
              <h3 className="table-title">Donor Giving History</h3>
              <div className="table-filters">
                <div className="search-box">
                  <Icon name="search" size={16} />
                  <input
                    type="text"
                    placeholder="Search donor..."
                    value={donorSearch}
                    onChange={(e) => setDonorSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Donor</th>
                    <th>Organization</th>
                    <th>Total Donated</th>
                    <th># Donations</th>
                    <th>Average</th>
                    <th>Last Donation</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="empty">
                        Loading...
                      </td>
                    </tr>
                  ) : filteredDonorStats.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty">
                        No donor data available.
                      </td>
                    </tr>
                  ) : (
                    filteredDonorStats.map((s) => (
                      <tr key={s.donor.id}>
                        <td>
                          <div className="donor-cell">
                            <span className="donor-name">
                              {s.donor.display_name}
                            </span>
                            {s.donor.email && (
                              <span className="donor-org">{s.donor.email}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {organizations.find(
                            (o) => o.id === s.donor.organization_id,
                          )?.name || "—"}
                        </td>
                        <td className="amount">
                          {formatCurrency(s.totalDonated)}
                        </td>
                        <td>{s.count}</td>
                        <td className="amount">
                          {formatCurrency(s.totalDonated / s.count)}
                        </td>
                        <td>
                          {s.lastDate
                            ? formatDate(s.lastDate.toISOString())
                            : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================== settings: role matrix modal ============================== */
function RolePermissionMatrixModal({ token, role, onClose, onSaved }) {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getRolePermissions(token, role)
      .then((res) => {
        if (!cancelled) setPermissions(res.permissions || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, role]);

  const toggle = (permission) => {
    setPermissions((prev) =>
      prev.map((p) =>
        p.permission === permission ? { ...p, granted: !p.granted } : p,
      ),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const granted = permissions
        .filter((p) => p.granted)
        .map((p) => p.permission);
      await api.updateRolePermissions(token, role, granted);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Permissions — ${role}`} onClose={onClose} size="md">
      {loading ? (
        <div className="empty">Loading...</div>
      ) : (
        <>
          <div
            className="detail-list"
            style={{ maxHeight: 360, overflowY: "auto" }}
          >
            {permissions.map((p) => (
              <label
                key={p.permission}
                className="detail-row"
                style={{ cursor: "pointer" }}
              >
                <span className="detail-label">
                  <code>{p.permission}</code>
                </span>
                <input
                  type="checkbox"
                  checked={p.granted}
                  onChange={() => toggle(p.permission)}
                />
              </label>
            ))}
          </div>
          {error && <div className="error-text">{error}</div>}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ============================== settings page ============================== */
function SettingsPage({ token, role }) {
  const [tab, setTab] = useState("roles");

  /* ---- roles ---- */
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState(null);
  const [editingRole, setEditingRole] = useState(null);

  const loadRoles = useCallback(() => {
    setRolesLoading(true);
    setRolesError(null);
    api
      .getRolePermissions(token)
      .then((res) => setRoles(Array.isArray(res?.data) ? res.data : []))
      .catch((err) =>
        setRolesError(
          err.status === 403
            ? "You don't have permission to view this."
            : err.message,
        ),
      )
      .finally(() => setRolesLoading(false));
  }, [token]);

  /* ---- payment channels ---- */
  const [channels, setChannels] = useState([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelsError, setChannelsError] = useState(null);
  const [channelsSaving, setChannelsSaving] = useState(false);

  const loadChannels = useCallback(() => {
    setChannelsLoading(true);
    setChannelsError(null);
    api
      .getPaymentChannels(token)
      .then((res) => setChannels(Array.isArray(res?.data) ? res.data : []))
      .catch((err) =>
        setChannelsError(
          err.status === 403
            ? "You don't have permission to view this."
            : err.message,
        ),
      )
      .finally(() => setChannelsLoading(false));
  }, [token]);

  const toggleChannel = (channel) => {
    setChannels((prev) =>
      prev.map((c) =>
        c.channel === channel ? { ...c, is_active: !c.is_active } : c,
      ),
    );
  };

  const saveChannels = async () => {
    setChannelsSaving(true);
    setChannelsError(null);
    try {
      const updated = await api.updatePaymentChannels(token, channels);
      setChannels(Array.isArray(updated?.data) ? updated.data : channels);
    } catch (err) {
      setChannelsError(err.message);
    } finally {
      setChannelsSaving(false);
    }
  };

  /* ---- receipt numbering ---- */
  const [receiptSettings, setReceiptSettings] = useState(null);
  const [receiptPrefix, setReceiptPrefix] = useState("");
  const [receiptLoading, setReceiptLoading] = useState(true);
  const [receiptError, setReceiptError] = useState(null);
  const [receiptSaving, setReceiptSaving] = useState(false);

  const loadReceiptSettings = useCallback(() => {
    setReceiptLoading(true);
    setReceiptError(null);
    api
      .getReceiptSettings(token)
      .then((res) => {
        setReceiptSettings(res);
        setReceiptPrefix(res?.prefix || "");
      })
      .catch((err) =>
        setReceiptError(
          err.status === 403
            ? "You don't have permission to view this."
            : err.message,
        ),
      )
      .finally(() => setReceiptLoading(false));
  }, [token]);

  const saveReceiptPrefix = async (e) => {
    e.preventDefault();
    setReceiptSaving(true);
    setReceiptError(null);
    try {
      const updated = await api.updateReceiptSettings(token, receiptPrefix);
      setReceiptSettings(updated);
    } catch (err) {
      setReceiptError(err.message);
    } finally {
      setReceiptSaving(false);
    }
  };

  useEffect(() => {
    // Non-admins can't call any of these endpoints (backend requires
    // settings.view / settings.manage, held only by the administrator
    // role) — skip the fetches entirely instead of racing to a 403.
    if (role !== "administrator") return;
    if (tab === "roles" && roles.length === 0) loadRoles();
    if (tab === "channels" && channels.length === 0) loadChannels();
    if (tab === "receipt" && receiptSettings === null) loadReceiptSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, role]);

  if (role !== "administrator") {
    return (
      <div className="page">
        <div className="card empty-state">
          <h2>Access Restricted</h2>
          <p>
            Only administrators can view or change organization settings.
            Contact your org's administrator if you need something changed here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="page-subtitle">
            Roles & permissions, payment channels, and receipt numbering for
            your organization
          </p>
        </div>
      </div>

      <div className="tabs">
        <button
          className={classNames("tab", tab === "roles" && "active")}
          onClick={() => setTab("roles")}
        >
          Roles & Permissions
        </button>
        <button
          className={classNames("tab", tab === "channels" && "active")}
          onClick={() => setTab("channels")}
        >
          Payment Channels
        </button>
        <button
          className={classNames("tab", tab === "receipt" && "active")}
          onClick={() => setTab("receipt")}
        >
          Receipt Numbering
        </button>
      </div>

      {tab === "roles" && (
        <div className="card">
          <div className="table-toolbar">
            <h3 className="table-title">Roles</h3>
          </div>
          {rolesError && <div className="error-text">{rolesError}</div>}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Permissions</th>
                  <th>Last Modified</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rolesLoading ? (
                  <tr>
                    <td colSpan={4} className="empty">
                      Loading...
                    </td>
                  </tr>
                ) : roles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty">
                      No roles found.
                    </td>
                  </tr>
                ) : (
                  roles.map((r) => (
                    <tr key={r.role}>
                      <td className="capitalize">
                        {r.role.replace(/_/g, " ")}
                      </td>
                      <td>{r.permission_count}</td>
                      <td>
                        {r.last_modified ? formatDate(r.last_modified) : "—"}
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost"
                          onClick={() => setEditingRole(r.role)}
                        >
                          View / Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "channels" && (
        <div className="card">
          <div className="table-toolbar">
            <h3 className="table-title">Payment Channels</h3>
            <button
              className="btn btn-primary"
              onClick={saveChannels}
              disabled={channelsSaving || channelsLoading}
            >
              {channelsSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
          {channelsError && <div className="error-text">{channelsError}</div>}
          <div className="detail-list">
            {channelsLoading ? (
              <div className="empty">Loading...</div>
            ) : channels.length === 0 ? (
              <div className="empty">No channels found.</div>
            ) : (
              channels.map((c) => (
                <div key={c.channel} className="detail-row">
                  <span className="detail-label capitalize">
                    {c.channel.replace(/_/g, " ")}
                  </span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={c.is_active}
                      onChange={() => toggleChannel(c.channel)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "receipt" && (
        <div className="card" style={{ maxWidth: 480 }}>
          {receiptLoading ? (
            <div className="empty">Loading...</div>
          ) : (
            <form onSubmit={saveReceiptPrefix}>
              <div className="form-group">
                <label>Receipt Prefix</label>
                <input
                  type="text"
                  className="input"
                  value={receiptPrefix}
                  onChange={(e) => setReceiptPrefix(e.target.value)}
                  maxLength={20}
                  required
                />
              </div>
              <div className="detail-row">
                <span className="detail-label">Next Sequence</span>
                <span className="detail-value text-muted">
                  {receiptSettings?.next_sequence ?? "—"} (server-generated, not
                  editable)
                </span>
              </div>
              {receiptError && <div className="error-text">{receiptError}</div>}
              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={receiptSaving}
                >
                  {receiptSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {editingRole && (
        <RolePermissionMatrixModal
          token={token}
          role={editingRole}
          onClose={() => setEditingRole(null)}
          onSaved={loadRoles}
        />
      )}
    </div>
  );
}

/* ============================== app ============================== */
export default function App() {
  const [page, setPage] = useState("dashboard");
  const [token, setToken] = useState("");
  const [donations, setDonations] = useState([]);
  const [donors, setDonors] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [pledges, setPledges] = useState([]);
  const [pledgeSummary, setPledgeSummary] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const fetchAll = useCallback(
    async (currentToken) => {
      const t = currentToken || token;
      if (!t) return;
      setLoading(true);
      try {
        const [dons, dors, org, camps, pldgs, pldgSummary] = await Promise.all([
          api.listDonations(t),
          api.listDonors(t),
          api.getMyOrganization(t),
          api.listCampaigns(t),
          api.listPledges(t),
          api.getPledgeSummary(t),
        ]);

        setDonations(Array.isArray(dons?.data) ? dons.data : []);
        setDonors(Array.isArray(dors?.data) ? dors.data : []);
        setCampaigns(Array.isArray(camps?.data) ? camps.data : []);
        setPledges(Array.isArray(pldgs?.data) ? pldgs.data : []);
        setPledgeSummary(pldgSummary || null);
        setOrganization(org || null);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    const saved = localStorage.getItem("giving_token");
    if (saved) {
      setToken(saved);
      setUser(decodeToken(saved));
      fetchAll(saved);
    } else {
      setLoading(false);
    }
  }, [fetchAll]);

  const handleTokenPaste = (e) => {
    const val = e.target.value.trim();
    setToken(val);
    if (val) {
      localStorage.setItem("giving_token", val);
      setUser(decodeToken(val));
      fetchAll(val);
    }
  };

  const pendingCount = useMemo(
    () => donations.filter((d) => d.status === "pending").length,
    [donations],
  );
  const organizations = organization ? [organization] : [];

  if (!token) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="brand-logo-lg">
            <Icon name="donations" size={32} />
          </div>
          <h2>Donation Management</h2>
          <p>Paste your platform JWT to continue</p>
          <input
            type="text"
            placeholder="eyJhbGciOiJIUzI1NiIs..."
            onChange={handleTokenPaste}
            autoFocus
          />
          <p className="login-hint">
            Run <code>npm run seed</code> in your backend to generate a token.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app min-h-screen bg-canvas font-sans">
      <Sidebar
        page={page}
        setPage={setPage}
        pendingCount={pendingCount}
        role={user?.role}
      />
      <div className="main bg-canvas flex-1">
        <Header user={user} organizations={organizations} />
        <div className="content">
          {page === "dashboard" && (
            <DashboardPage
              organizations={organizations}
              donors={donors}
              donations={donations}
              loading={loading}
            />
          )}
          {page === "donations" && (
            <DonationsPage
              token={token}
              donors={donors}
              campaigns={campaigns}
              pledges={pledges}
              donations={donations}
              organizations={organizations}
              loading={loading}
              onRefresh={() => fetchAll(token)}
            />
          )}
          {page === "campaigns" && (
            <CampaignsPage
              token={token}
              campaigns={campaigns}
              loading={loading}
              onRefresh={() => fetchAll(token)}
            />
          )}
          {page === "pledges" && (
            <PledgesPage
              token={token}
              donors={donors}
              campaigns={campaigns}
              pledges={pledges}
              donations={donations}
              summary={pledgeSummary}
              loading={loading}
              onRefresh={() => fetchAll(token)}
            />
          )}
          {page === "donors" && (
            <DonorsPage
              token={token}
              donors={donors}
              donations={donations}
              organizations={organizations}
              loading={loading}
              onRefresh={() => fetchAll(token)}
            />
          )}
          {page === "organizations" && (
            <MyOrganizationPage
              organization={organization}
              loading={loading}
              onUpdate={setOrganization}
            />
          )}
          {page === "receipts" && (
            <ReceiptsPage
              token={token}
              donations={donations}
              donors={donors}
              loading={loading}
              onRefresh={() => fetchAll(token)}
            />
          )}
          {page === "reports" && (
            <ReportsPage
              donations={donations}
              donors={donors}
              campaigns={campaigns}
              organizations={organizations}
              loading={loading}
            />
          )}
          {page === "settings" && (
            <SettingsPage token={token} role={user?.role} />
          )}
          {page !== "dashboard" &&
            page !== "donations" &&
            page !== "campaigns" &&
            page !== "pledges" &&
            page !== "donors" &&
            page !== "organizations" &&
            page !== "receipts" &&
            page !== "reports" &&
            page !== "settings" && (
              <div className="page">
                <div className="card empty-state">
                  <h2>Coming Soon</h2>
                  <p>
                    This module hasn't been built yet. Switch to Donations or
                    Donors to continue.
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={() => setPage("donations")}
                  >
                    Go to Donations
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
