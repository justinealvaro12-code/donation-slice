const express = require("express");
const cors = require("cors");
const { authenticate } = require("./middleware/auth");
const donationsRouter = require("./routes/donations");
const donorsRouter = require("./routes/donors");
const receiptsRouter = require("./routes/receipts");
const organizationsRouter = require("./routes/organizations");
const campaignsRouter = require("./routes/campaigns");
const pledgesRouter = require("./routes/pledges");
const settingsRouter = require("./routes/settings");

function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cors({ origin: true, credentials: true }));

  // Health check - must respond without requiring auth, and before
  // authenticate is applied anywhere, so Replit's deployment healthcheck
  // (GET /api/healthz) always succeeds regardless of token state.
  app.get("/api/healthz", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Protected API routes - authenticate is applied per-router now,
  // not globally, so it never blocks health checks or static frontend
  // serving.
  app.use("/api/donations", authenticate, donationsRouter);
  app.use("/api/donors", authenticate, donorsRouter);
  app.use("/api/receipts", authenticate, receiptsRouter);
  app.use("/api/organizations", authenticate, organizationsRouter);
  app.use("/api/campaigns", authenticate, campaignsRouter);
  app.use("/api/pledges", authenticate, pledgesRouter);
  app.use("/api/reports", authenticate, require("./routes/reports"));
  app.use("/api/settings", authenticate, settingsRouter);

  // 404 handler
  app.use((req, res) => {
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Endpoint not found" } });
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res
      .status(500)
      .json({
        error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
      });
  });

  return app;
}

module.exports = { createApp };
