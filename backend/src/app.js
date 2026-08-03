const express = require('express');
const cors = require('cors');
const { authenticate } = require('./middleware/auth');
const donationRoutes = require('./routes/donations');
const donorRoutes = require('./routes/donors');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Every route below is authenticated first — no route reads req.body's
  // organization_id, ever. That value always comes from req.auth.
  app.use('/api/donations', authenticate, donationRoutes);
  app.use('/api/donors', authenticate, donorRoutes);

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // Centralized error handler — never leaks stack traces to the client
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
  });

  return app;
}

module.exports = { createApp };
