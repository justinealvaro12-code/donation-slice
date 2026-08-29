const { pool } = require('../db');

class ReportRepository {
  _dateConditions(organizationId, from, to, alias = '') {
    const prefix = alias ? `${alias}.` : '';
    const conditions = [`${prefix}organization_id = $1`, `${prefix}deleted_at IS NULL`];
    const params = [organizationId];
    if (from) {
      params.push(from);
      conditions.push(`${prefix}donation_date >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`${prefix}donation_date <= $${params.length}`);
    }
    return { clause: `WHERE ${conditions.join(' AND ')}`, params };
  }

  async getSummary(organizationId, from, to) {
    const d = this._dateConditions(organizationId, from, to);

    const donationsResult = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count
       FROM donation_donations
       ${d.clause}`,
      d.params,
    );
    const donations = donationsResult.rows[0];

    const pledgeConditions = ['organization_id = $1', 'deleted_at IS NULL'];
    const pledgeParams = [organizationId];
    if (from) {
      pledgeParams.push(from);
      pledgeConditions.push(`pledge_date >= $${pledgeParams.length}`);
    }
    if (to) {
      pledgeParams.push(to);
      pledgeConditions.push(`pledge_date <= $${pledgeParams.length}`);
    }
    const pledgesResult = await pool.query(
      `SELECT COALESCE(SUM(amount_pledged),0) AS total, COUNT(*) AS count,
              COALESCE(SUM(amount_fulfilled),0) AS paid_total
       FROM donation_pledges
       WHERE ${pledgeConditions.join(' AND ')}`,
      pledgeParams,
    );
    const pledges = pledgesResult.rows[0];

    const donorsResult = await pool.query(
      `SELECT COUNT(DISTINCT donor_id) AS count
       FROM donation_donations
       ${d.clause}`,
      d.params,
    );
    const donors = donorsResult.rows[0];

    return {
      totalDonations: parseFloat(donations.total),
      donationCount: parseInt(donations.count, 10),
      totalPledges: parseFloat(pledges.total),
      pledgeCount: parseInt(pledges.count, 10),
      pledgePaid: parseFloat(pledges.paid_total),
      activeDonors: parseInt(donors.count, 10),
      pledgeFulfillmentRate:
        pledges.total > 0
          ? Math.round((pledges.paid_total / pledges.total) * 100)
          : 0,
    };
  }

  async getMonthlyTrends(organizationId, from, to) {
    const d = this._dateConditions(organizationId, from, to);
    const result = await pool.query(
      `SELECT to_char(donation_date, 'YYYY-MM') AS month,
              COALESCE(SUM(amount),0) AS total, COUNT(*) AS count
       FROM donation_donations
       ${d.clause}
       GROUP BY month ORDER BY month`,
      d.params,
    );
    return result.rows.map((r) => ({
      month: r.month,
      total: parseFloat(r.total),
      count: parseInt(r.count, 10),
    }));
  }

  async getCampaignBreakdown(organizationId, from, to) {
    const params = [organizationId];
    let onClause = 'c.id = d.campaign_id AND d.organization_id = $1 AND d.deleted_at IS NULL';
    if (from) {
      params.push(from);
      onClause += ` AND d.donation_date >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      onClause += ` AND d.donation_date <= $${params.length}`;
    }

    const result = await pool.query(
      `SELECT c.id, c.name,
              COALESCE(SUM(d.amount),0) AS total,
              COUNT(d.id) AS count
       FROM donation_campaigns c
       LEFT JOIN donation_donations d ON ${onClause}
       WHERE c.organization_id = $1 AND c.deleted_at IS NULL
       GROUP BY c.id, c.name
       ORDER BY total DESC`,
      params,
    );
    return result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      total: parseFloat(r.total),
      count: parseInt(r.count, 10),
    }));
  }

  async getChannelBreakdown(organizationId, from, to) {
    const d = this._dateConditions(organizationId, from, to);
    const result = await pool.query(
      `SELECT payment_channel AS channel,
              COALESCE(SUM(amount),0) AS total, COUNT(*) AS count
       FROM donation_donations
       ${d.clause}
       GROUP BY payment_channel ORDER BY total DESC`,
      d.params,
    );
    return result.rows.map((r) => ({
      channel: r.channel || 'Unknown',
      total: parseFloat(r.total),
      count: parseInt(r.count, 10),
    }));
  }

  async getTopDonors(organizationId, from, to, limit = 10) {
    const d = this._dateConditions(organizationId, from, to, 'd');
    const params = [...d.params, parseInt(limit, 10)];
    const result = await pool.query(
      `SELECT dnr.id, dnr.display_name AS name, dnr.email,
              COALESCE(SUM(d.amount),0) AS total, COUNT(*) AS count
       FROM donation_donors dnr
       JOIN donation_donations d ON dnr.id = d.donor_id
       ${d && d.clause ? d.clause : ''}
       GROUP BY dnr.id, dnr.display_name, dnr.email
       ORDER BY total DESC LIMIT $${params.length}`,
      params,
    );
    return result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      total: parseFloat(r.total),
      count: parseInt(r.count, 10),
    }));
  }
}

module.exports = new ReportRepository();
