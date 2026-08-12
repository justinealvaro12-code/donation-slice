const db = require('../db'); // adjust path to your db connection

class ReportRepository {
  _dateConditions(from, to) {
    const conditions = [];
    const params = [];
    if (from) { conditions.push('created_at >= ?'); params.push(from); }
    if (to)   { conditions.push('created_at <= ?'); params.push(to); }
    return { clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
  }

  async getSummary(from, to) {
    const d = this._dateConditions(from, to);
    
    const [[donations]] = await db.query(
      `SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count FROM donations ${d.clause}`,
      d.params
    );
    
    const [[pledges]] = await db.query(
      `SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count,
              COALESCE(SUM(amount_paid),0) AS paid_total FROM pledges ${d.clause}`,
      d.params
    );
    
    const [[donors]] = await db.query(
      `SELECT COUNT(DISTINCT donor_id) AS count FROM donations ${d.clause}`,
      d.params
    );

    return {
      totalDonations: parseFloat(donations.total),
      donationCount: donations.count,
      totalPledges: parseFloat(pledges.total),
      pledgeCount: pledges.count,
      pledgePaid: parseFloat(pledges.paid_total),
      activeDonors: donors.count,
      pledgeFulfillmentRate: pledges.total > 0
        ? Math.round((pledges.paid_total / pledges.total) * 100)
        : 0
    };
  }

  async getMonthlyTrends(from, to) {
    const d = this._dateConditions(from, to);
    const [rows] = await db.query(
      `SELECT DATE_FORMAT(created_at,'%Y-%m') AS month,
              COALESCE(SUM(amount),0) AS total, COUNT(*) AS count
       FROM donations ${d.clause}
       GROUP BY month ORDER BY month`,
      d.params
    );
    return rows.map(r => ({ month: r.month, total: parseFloat(r.total), count: r.count }));
  }

  async getCampaignBreakdown(from, to) {
    const params = [];
    let onClause = 'c.id = d.campaign_id';
    if (from) { onClause += ' AND d.created_at >= ?'; params.push(from); }
    if (to)   { onClause += ' AND d.created_at <= ?'; params.push(to); }
    
    const [rows] = await db.query(
      `SELECT c.id, c.name,
              COALESCE(SUM(d.amount),0) AS total,
              COUNT(d.id) AS count
       FROM campaigns c
       LEFT JOIN donations d ON ${onClause}
       GROUP BY c.id, c.name
       ORDER BY total DESC`,
      params
    );
    return rows.map(r => ({ id: r.id, name: r.name, total: parseFloat(r.total), count: r.count }));
  }

  async getChannelBreakdown(from, to) {
    const d = this._dateConditions(from, to);
    const [rows] = await db.query(
      `SELECT payment_channel AS channel,
              COALESCE(SUM(amount),0) AS total, COUNT(*) AS count
       FROM donations ${d.clause}
       GROUP BY payment_channel ORDER BY total DESC`,
      d.params
    );
    return rows.map(r => ({ channel: r.channel || 'Unknown', total: parseFloat(r.total), count: r.count }));
  }

  async getTopDonors(from, to, limit = 10) {
    const d = this._dateConditions(from, to);
    const [rows] = await db.query(
      `SELECT dnr.id, dnr.name, dnr.email,
              COALESCE(SUM(d.amount),0) AS total, COUNT(*) AS count
       FROM donors dnr
       JOIN donations d ON dnr.id = d.donor_id
       ${d.clause}
       GROUP BY dnr.id, dnr.name, dnr.email
       ORDER BY total DESC LIMIT ?`,
      [...d.params, parseInt(limit)]
    );
    return rows.map(r => ({ id: r.id, name: r.name, email: r.email, total: parseFloat(r.total), count: r.count }));
  }
}

module.exports = new ReportRepository();