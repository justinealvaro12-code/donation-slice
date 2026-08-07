import React, { useState, useEffect } from 'react';
import { api } from './api';

/* ---------- Simple SVG Bar Chart ---------- */
const BarChart = ({ data, xKey, yKey, height = 200 }) => {
  if (!data?.length) return <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No data for selected period.</p>;
  const max = Math.max(...data.map(d => d[yKey] || 0));
  const padding = 40;
  const chartWidth = Math.max(data.length * 60, 400);
  const chartHeight = height;
  const barWidth = (chartWidth - padding * 2) / data.length - 10;

  return (
    <svg width="100%" height={chartHeight + 40} viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`} preserveAspectRatio="xMidYMid meet">
      <line x1={padding} y1={chartHeight} x2={chartWidth - padding} y2={chartHeight} stroke="#e5e7eb" strokeWidth={1} />
      {data.map((d, i) => {
        const barHeight = max ? ((d[yKey] || 0) / max) * (chartHeight - 20) : 0;
        const x = padding + i * (barWidth + 10) + 5;
        const y = chartHeight - barHeight;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={barHeight} fill="#4f46e5" rx={4} />
            <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize={11} fill="#374151">{(d[yKey] || 0).toLocaleString()}</text>
            <text x={x + barWidth / 2} y={chartHeight + 18} textAnchor="middle" fontSize={11} fill="#6b7280">{d[xKey]}</text>
          </g>
        );
      })}
    </svg>
  );
};

/* ---------- Simple SVG Pie Chart ---------- */
const PieChart = ({ data, nameKey, valueKey, colors = ['#4f46e5','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'] }) => {
  if (!data?.length) return <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No data for selected period.</p>;
  const total = data.reduce((s, d) => s + (d[valueKey] || 0), 0);
  if (!total) return <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No data for selected period.</p>;

  let cumulativeAngle = 0;
  const radius = 80, center = 100;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <svg width={200} height={200} viewBox="0 0 200 200">
        {data.map((d, i) => {
          const value = d[valueKey] || 0;
          const angle = (value / total) * 2 * Math.PI;
          const startAngle = cumulativeAngle - Math.PI / 2;
          cumulativeAngle += angle;
          const endAngle = cumulativeAngle - Math.PI / 2;
          const x1 = center + radius * Math.cos(startAngle);
          const y1 = center + radius * Math.sin(startAngle);
          const x2 = center + radius * Math.cos(endAngle);
          const y2 = center + radius * Math.sin(endAngle);
          const largeArc = angle > Math.PI ? 1 : 0;
          return (
            <path key={i}
              d={`M${center},${center} L${x1},${y1} A${radius},${radius} 0 ${largeArc},1 ${x2},${y2} Z`}
              fill={colors[i % colors.length]} stroke="white" strokeWidth={2}
            />
          );
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: colors[i % colors.length], display: 'inline-block' }} />
            <span style={{ color: '#374151', fontWeight: 500 }}>{d[nameKey]}</span>
            <span style={{ color: '#6b7280' }}>
              ${(d[valueKey] || 0).toLocaleString()} ({Math.round(((d[valueKey] || 0) / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------- Main Page ---------- */
const ReportsPage = () => {
  // Adjust this if your app passes token via Context/Props instead of localStorage
  const token = localStorage.getItem('token');

  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [channels, setChannels] = useState([]);
  const [topDonors, setTopDonors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadReports = async () => {
    if (!token) { setError('No authentication token found.'); return; }
    setLoading(true); setError(null);
    try {
      const [s, t, c, ch, d] = await Promise.all([
        api.getReportSummary(token, { from, to }),
        api.getReportTrends(token, { from, to }),
        api.getReportCampaigns(token, { from, to }),
        api.getReportChannels(token, { from, to }),
        api.getReportTopDonors(token, { from, to, limit: 10 }),
      ]);
      setSummary(s.data || s);
      setTrends(t.data || t);
      setCampaigns(c.data || c);
      setChannels(ch.data || ch);
      setTopDonors(d.data || d);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReports(); }, []); // eslint-disable-line

  const fmt = (v) => {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return isNaN(n) ? '$0.00' : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24, color: '#111827' }}>Giving Summary Report</h1>

      {/* Date Filter */}
      <form onSubmit={(e) => { e.preventDefault(); loadReports(); }}
        style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 32, padding: 20, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase' }}>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase' }}>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
        </div>
        <button type="submit" disabled={loading}
          style={{ padding: '10px 24px', background: loading ? '#9ca3af' : '#4f46e5', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Loading…' : 'Generate Report'}
        </button>
      </form>

      {error && (
        <div style={{ padding: 16, background: '#fef2f2', color: '#991b1b', borderRadius: 6, marginBottom: 24, border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Total Donations', value: fmt(summary.totalDonations), sub: `${summary.donationCount || 0} donations` },
            { label: 'Total Pledges', value: fmt(summary.totalPledges), sub: `${summary.pledgeCount || 0} pledges` },
            { label: 'Pledge Fulfillment', value: `${summary.pledgeFulfillmentRate || 0}%`, sub: `${fmt(summary.pledgePaid)} paid` },
            { label: 'Active Donors', value: summary.activeDonors || 0, sub: 'unique donors' },
          ].map((c, i) => (
            <div key={i} style={{ background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>{c.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{c.value}</div>
              <div style={{ fontSize: 13, color: '#9ca3af' }}>{c.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Trends */}
      <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, marginTop: 0 }}>Monthly Trends</h2>
        <BarChart data={trends} xKey="month" yKey="total" />
      </div>

      {/* Breakdowns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 24 }}>
        <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, marginTop: 0 }}>By Campaign</h2>
          <PieChart data={campaigns.filter(c => (c.total || 0) > 0)} nameKey="name" valueKey="total" />
        </div>
        <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, marginTop: 0 }}>By Payment Channel</h2>
          <PieChart data={channels.filter(c => (c.total || 0) > 0)} nameKey="channel" valueKey="total" />
        </div>
      </div>

      {/* Top Donors */}
      <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, marginTop: 0 }}>Top Donors</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: '12px 8px', color: '#6b7280', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>Donor</th>
                <th style={{ padding: '12px 8px', color: '#6b7280', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>Email</th>
                <th style={{ padding: '12px 8px', color: '#6b7280', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', textAlign: 'right' }}>Total Given</th>
                <th style={{ padding: '12px 8px', color: '#6b7280', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', textAlign: 'right' }}>Donations</th>
              </tr>
            </thead>
            <tbody>
              {topDonors.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 8px', fontWeight: 500, color: '#111827' }}>{d.name}</td>
                  <td style={{ padding: '12px 8px', color: '#6b7280' }}>{d.email}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>{fmt(d.total)}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', color: '#6b7280' }}>{d.count}</td>
                </tr>
              ))}
              {!topDonors.length && (
                <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>No donor data for selected period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;