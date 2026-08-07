const express = require('express');
const { requirePermission } = require('../middleware/requirePermission');
const settingsRepository = require('../repositories/settingsRepository');

const router = express.Router();

router.param('role', (req, res, next, role) => {
  if (!settingsRepository.ALL_ROLES.includes(role)) {
    return res.status(400).json({ error: { code: 'INVALID_ROLE', message: `Unknown role '${role}'` } });
  }
  next();
});

/* ---------- Roles & Permissions ---------- */

// GET /api/settings/roles — list view (role, permission count, last modified)
router.get('/roles', requirePermission('settings.view'), async (req, res, next) => {
  try {
    const summary = await settingsRepository.getRolesSummary(req.auth.organization_id, req.auth.user_id);
    res.status(200).json({ data: summary });
  } catch (err) {
    next(err);
  }
});

// GET /api/settings/roles/:role — full permission matrix for "View matrix"
router.get('/roles/:role', requirePermission('settings.view'), async (req, res, next) => {
  try {
    const matrix = await settingsRepository.getRolePermissionMatrix(req.auth.organization_id, req.params.role, req.auth.user_id);
    res.status(200).json({ role: req.params.role, permissions: matrix });
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings/roles/:role — save edited permission matrix
router.put('/roles/:role', requirePermission('settings.manage'), async (req, res, next) => {
  try {
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'permissions must be an array of permission keys' } });
    }
    const updated = await settingsRepository.updateRolePermissions(req.auth.organization_id, req.params.role, permissions, req.auth.user_id);
    res.status(200).json({ role: req.params.role, permissions: updated });
  } catch (err) {
    next(err);
  }
});

/* ---------- Payment Channels ---------- */

// GET /api/settings/payment-channels
router.get('/payment-channels', requirePermission('settings.view'), async (req, res, next) => {
  try {
    const channels = await settingsRepository.getPaymentChannels(req.auth.organization_id);
    res.status(200).json({ data: channels });
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings/payment-channels — body: { channels: [{ channel, is_active }] }
router.put('/payment-channels', requirePermission('settings.manage'), async (req, res, next) => {
  try {
    const { channels } = req.body;
    if (!Array.isArray(channels)) {
      return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'channels must be an array of { channel, is_active }' } });
    }
    const invalid = channels.find(c => !settingsRepository.ALL_CHANNELS.includes(c.channel) || typeof c.is_active !== 'boolean');
    if (invalid) {
      return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: `Invalid channel entry: ${JSON.stringify(invalid)}` } });
    }
    const updated = await settingsRepository.updatePaymentChannels(req.auth.organization_id, channels, req.auth.user_id);
    res.status(200).json({ data: updated });
  } catch (err) {
    next(err);
  }
});

/* ---------- Receipt Numbering ---------- */

// GET /api/settings/receipt
router.get('/receipt', requirePermission('settings.view'), async (req, res, next) => {
  try {
    const settings = await settingsRepository.getReceiptSettings(req.auth.organization_id);
    res.status(200).json(settings);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings/receipt — body: { prefix } — next_sequence is NEVER
// client-writable (server-generated, per the mockup's own note).
router.put('/receipt', requirePermission('settings.manage'), async (req, res, next) => {
  try {
    const { prefix } = req.body;
    if (typeof prefix !== 'string' || prefix.length < 1 || prefix.length > 20) {
      return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'prefix must be a string between 1 and 20 characters' } });
    }
    const updated = await settingsRepository.updateReceiptPrefix(req.auth.organization_id, prefix, req.auth.user_id);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;