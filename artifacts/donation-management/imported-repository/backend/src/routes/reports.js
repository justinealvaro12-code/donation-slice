const express = require('express');
const router = express.Router();
const {requirePermission} = require('../middleware/requirePermission');
const reportRepository = require('../repositories/reportRepository');
router.get('/summary', requirePermission('report.view'), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    res.json({ data: await reportRepository.getSummary(req.auth.organization_id, from, to) });
  } catch (err) { next(err); }
});
router.get('/trends', requirePermission('report.view'), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    res.json({ data: await reportRepository.getMonthlyTrends(req.auth.organization_id, from, to) });
  } catch (err) { next(err); }
});
router.get('/campaigns', requirePermission('report.view'), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    res.json({ data: await reportRepository.getCampaignBreakdown(req.auth.organization_id, from, to) });
  } catch (err) { next(err); }
});
router.get('/channels', requirePermission('report.view'), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    res.json({ data: await reportRepository.getChannelBreakdown(req.auth.organization_id, from, to) });
  } catch (err) { next(err); }
});
router.get('/top-donors', requirePermission('report.view'), async (req, res, next) => {
  try {
    const { from, to, limit } = req.query;
    res.json({ data: await reportRepository.getTopDonors(req.auth.organization_id, from, to, limit || 10) });
  } catch (err) { next(err); }
});
module.exports = router;
