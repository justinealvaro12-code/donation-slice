const express = require('express');
const cors = require('cors');
const { authenticate } = require('./middleware/auth');
const donationsRouter = require('./routes/donations');
const donorsRouter = require('./routes/donors');
const receiptsRouter = require('./routes/receipts');
const organizationsRouter = require('./routes/organizations');
const campaignsRouter = require('./routes/campaigns');
const pledgesRouter = require('./routes/pledges');
const settingsRouter = require('./routes/settings');

function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cors({ origin: true, credentials: true }));

  // Attach req.auth to all routes
  app.use(authenticate);

  // Routes
  app.use('/api/donations', donationsRouter);
  app.use('/api/donors', donorsRouter);
  app.use('/api/receipts', receiptsRouter);
  app.use('/api/organizations', organizationsRouter);
  app.use('/api/campaigns', campaignsRouter);
  app.use('/api/pledges', pledgesRouter);
  app.use('/api/reports', require('./routes/reports'));
  app.use('/api/settings', settingsRouter);
  // 404 handler

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
  });

  return app;
}

module.exports = { createApp };