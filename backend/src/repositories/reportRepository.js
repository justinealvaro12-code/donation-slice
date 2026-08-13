const { pool } = require('../db');

class ReportRepository {
  async getSummary(organizationId, from, to) {
    const params = [organizationId];
    let idx = 2;
    let dateClause = '';
    if (from) { dateClause += ` AND created_at >= $${idx++}`; params.push(from); }
    if (to)   { dateClause += ` AND created_at <= $${idx++}`; params.push(to); }

    const { rows: [donations] } = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count 
       FROM donation_donations 
       WHERE organization_id = $1 AND deleted_at IS NULL${dateClause}`,
      params
    );

    const { rows: [pledges] } = await pool.query(
      `SELECT COALESCE(SUM(amount_pledged),0) AS total, COUNT(*) AS count,
              COALESCE(SUM(amount_fulfilled),0) AS paid_total 
       FROM donation_pledges 
       WHERE organization_id = $1 AND deleted_at IS NULL${dateClause}`,
      params
    );

    const { rows: [donors] } = await pool.query(
      `SELECT COUNT(DISTINCT donor_id) AS count 
       FROM donation_donations 
       WHERE organization_id = $1 AND deleted_at IS NULL${dateClause}`,
      params
    );

    return {
      totalDonations: parseFloat(donations.total),
      donationCount: parseInt(donations.count, 10),
      totalPledges: parseFloat(pledges.total),
      pledgeCount: parseInt(pledges.count, 10),
      pledgePaid: parseFloat(pledges.paid_total),
      activeDonors: parseInt(donors.count, 10),
      pledgeFulfillmentRate: parseFloat(pledges.total) > 0
        ? Math.round((parseFloat(pledges.paid_total) / parseFloat(pledges.total)) * 100)
        : 0
    };
  }

  async getMonthlyTrends(organizationId, from, to) {
    const params = [organizationId];
    let idx = 2;
    let dateClause = '';
    if (from) { dateClause += ` AND created_at >= $${idx++}`; params.push(from); }
    if (to)   { dateClause += ` AND created_at <= $${idx++}`; params.push(to); }

    const { rows } = await pool.query(
      `SELECT TO_CHAR(created_at,'YYYY-MM') AS month,
              COALESCE(SUM(amount),0) AS total, COUNT(*) AS count
       FROM donation_donations 
       WHERE organization_id = $1 AND deleted_at IS NULL${dateClause}
       GROUP BY month ORDER BY month`,
      params
    );
    return rows.map(r => ({ month: r.month, total: parseFloat(r.total), count: parseInt(r.count, 10) }));
  }

  async getCampaignBreakdown(organizationId, from, to) {
    const params = [organizationId];
    let idx = 2;
    let donationDateClause = '';
    if (from) { donationDateClause += ` AND d.created_at >= $${idx++}`; params.push(from); }
    if (to)   { donationDateClause += ` AND d.created_at <= $${idx++}`; params.push(to); }

    const { rows } = await pool.query(
      `SELECT c.id, c.name,
              COALESCE(SUM(d.amount),0) AS total,
              COUNT(d.id) AS count
       FROM donation_campaigns c
       LEFT JOIN donation_donations d ON c.id = d.campaign_id 
                             AND d.organization_id = $1 
                             AND d.deleted_at IS NULL${donationDateClause}
       WHERE c.organization_id = $1 AND c.deleted_at IS NULL
       GROUP BY c.id, c.name
       ORDER BY total DESC`,
      params
    );
    return rows.map(r => ({ id: r.id, name: r.name, total: parseFloat(r.total), count: parseInt(r.count, 10) }));
  }

  async getChannelBreakdown(organizationId, from, to) {
    const params = [organizationId];
    let idx = 2;
    let dateClause = '';
    if (from) { dateClause += ` AND created_at >= $${idx++}`; params.push(from); }
    if (to)   { dateClause += ` AND created_at <= $${idx++}`; params.push(to); }

    const { rows } = await pool.query(
      `SELECT payment_channel AS channel,
              COALESCE(SUM(amount),0) AS total, COUNT(*) AS count
       FROM donation_donations 
       WHERE organization_id = $1 AND deleted_at IS NULL${dateClause}
       GROUP BY payment_channel ORDER BY total DESC`,
      params
    );
    return rows.map(r => ({ channel: r.channel || 'Unknown', total: parseFloat(r.total), count: parseInt(r.count, 10) }));
  }

  async getTopDonors(organizationId, from, to, limit = 10) {
    const params = [organizationId];
    let idx = 2;
    let dateClause = '';
    if (from) { dateClause += ` AND d.created_at >= $${idx++}`; params.push(from); }
    if (to)   { dateClause += ` AND d.created_at <= $${idx++}`; params.push(to); }
    params.push(parseInt(limit, 10));

    const { rows } = await pool.query(
      `SELECT dnr.id, dnr.display_name AS name, dnr.email,
              COALESCE(SUM(d.amount),0) AS total, COUNT(*) AS count
       FROM donation_donors dnr
       JOIN donation_donations d ON dnr.id = d.donor_id 
                        AND d.organization_id = $1 
                        AND d.deleted_at IS NULL${dateClause}
       WHERE dnr.organization_id = $1 AND dnr.deleted_at IS NULL
       GROUP BY dnr.id, dnr.display_name, dnr.email
       ORDER BY total DESC LIMIT $${idx++}`,
      params
    );
    return rows.map(r => ({ id: r.id, name: r.name, email: r.email, total: parseFloat(r.total), count: parseInt(r.count, 10) }));
  }
}

module.exports = new ReportRepository();
