const { pool } = require("../db");

// Every donation now generates a notification on creation — no amount
// threshold. Capped at 50 most recent so this stays cheap; older
// donations age out of the feed naturally.
async function getDonationNotifications(organizationId) {
  const result = await pool.query(
    `SELECT d.id, d.amount, d.status, d.created_at,
            don.display_name AS donor_name
     FROM donation_donations d
     JOIN donation_donors don ON don.id = d.donor_id
     WHERE d.organization_id = $1 AND d.deleted_at IS NULL
     ORDER BY d.created_at DESC
     LIMIT 50`,
    [organizationId],
  );
  return result.rows.map((r) => ({
    key: `donation:${r.id}`,
    type: "donation_received",
    title: "Donation received",
    message: `${r.donor_name} — ₱${Number(r.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })} (${r.status})`,
    created_at: r.created_at,
  }));
}

async function getOverduePledgeNotifications(organizationId) {
  const result = await pool.query(
    `SELECT p.id, p.due_date, d.display_name AS donor_name
     FROM donation_pledges p
     JOIN donation_donors d ON d.id = p.donor_id
     WHERE p.organization_id = $1 AND p.deleted_at IS NULL
       AND p.due_date IS NOT NULL AND p.due_date < CURRENT_DATE
       AND p.amount_fulfilled < p.amount_pledged
     ORDER BY p.due_date ASC
     LIMIT 50`,
    [organizationId],
  );
  return result.rows.map((r) => ({
    key: `pledge_overdue:${r.id}`,
    type: "pledge_overdue",
    title: "Pledge overdue",
    message: `${r.donor_name}'s pledge was due ${new Date(r.due_date).toLocaleDateString("en-PH")}`,
    created_at: r.due_date,
  }));
}

// Fires once a campaign's confirmed-donation total reaches its goal.
// Recomputed live each request, so it naturally stays "on" for a
// campaign that's over goal rather than firing once and disappearing.
async function getCampaignGoalNotifications(organizationId) {
  const result = await pool.query(
    `SELECT c.id, c.name, c.goal_amount,
            COALESCE(SUM(d.amount) FILTER (WHERE d.status = 'confirmed'), 0) AS raised_amount
     FROM donation_campaigns c
     LEFT JOIN donation_donations d ON d.campaign_id = c.id AND d.deleted_at IS NULL
     WHERE c.organization_id = $1 AND c.deleted_at IS NULL AND c.goal_amount IS NOT NULL
     GROUP BY c.id
     HAVING COALESCE(SUM(d.amount) FILTER (WHERE d.status = 'confirmed'), 0) >= c.goal_amount
     ORDER BY c.name`,
    [organizationId],
  );
  return result.rows.map((r) => ({
    key: `campaign_goal:${r.id}`,
    type: "campaign_goal_reached",
    title: "Campaign goal reached",
    message: `${r.name} hit its goal of ₱${Number(r.goal_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
    created_at: null,
  }));
}

async function getReadKeys(organizationId, userId) {
  const result = await pool.query(
    `SELECT notification_key FROM donation_notification_reads
     WHERE organization_id = $1 AND user_id = $2`,
    [organizationId, userId],
  );
  return new Set(result.rows.map((r) => r.notification_key));
}

async function list(organizationId, userId) {
  const [donations, pledges, campaigns, readKeys] = await Promise.all([
    getDonationNotifications(organizationId),
    getOverduePledgeNotifications(organizationId),
    getCampaignGoalNotifications(organizationId),
    getReadKeys(organizationId, userId),
  ]);

  const items = [...donations, ...pledges, ...campaigns]
    .map((n) => ({ ...n, read: readKeys.has(n.key) }))
    .sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

  return { items, unread_count: items.filter((n) => !n.read).length };
}

async function markRead(organizationId, userId, key) {
  await pool.query(
    `INSERT INTO donation_notification_reads (organization_id, user_id, notification_key)
     VALUES ($1, $2, $3)
     ON CONFLICT (organization_id, user_id, notification_key) DO NOTHING`,
    [organizationId, userId, key],
  );
}

async function markAllRead(organizationId, userId) {
  const { items } = await list(organizationId, userId);
  const unreadKeys = items.filter((n) => !n.read).map((n) => n.key);
  if (unreadKeys.length === 0) return;

  const values = unreadKeys.map((_, i) => `($1, $2, $${i + 3})`).join(", ");
  await pool.query(
    `INSERT INTO donation_notification_reads (organization_id, user_id, notification_key)
     VALUES ${values}
     ON CONFLICT (organization_id, user_id, notification_key) DO NOTHING`,
    [organizationId, userId, ...unreadKeys],
  );
}

module.exports = { list, markRead, markAllRead };
