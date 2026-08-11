require('dotenv').config();
const path = require('path');
const express = require('express');
const { createApp } = require('./app');

const app = createApp();
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

// Serve built frontend static files
app.use(express.static(path.join(__dirname, '../../../dist/public')));

// API 404 handler — only for /api routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
});

// SPA fallback — serve index.html for non-API routes (React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../dist/public/index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Donation Management backend listening on http://${HOST}:${PORT}`);
});
