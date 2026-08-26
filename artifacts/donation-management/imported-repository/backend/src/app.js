const express = require("express");
const cors = require("cors");
const path = require("path");
const { authenticate } = require("./middleware/auth");
const donationsRouter = require("./routes/donations");
const donorsRouter = require("./routes/donors");
const receiptsRouter = require("./routes/receipts");
const organizationsRouter = require("./routes/organizations");
const campaignsRouter = require("./routes/campaigns");
const pledgesRouter = require("./routes/pledges");
const settingsRouter = require("./routes/settings");
const notificationsRouter = require("./routes/notifications");
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
  app.use("/api/notifications", authenticate, notificationsRouter);
  // Serve the built frontend. Must be registered BEFORE the JSON 404
  // handler below, or every non-API request (including "/") gets
  // swallowed by that catch-all first and the frontend never loads
  // in production.
  const staticDir = path.join(__dirname, "../../../dist/public");
  app.use(express.static(staticDir));
  // SPA fallback: any GET that isn't an API call falls through to
  // index.html so client-side routing works on refresh/deep links.
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
  // 404 handler - only reached now for unmatched /api/* requests,
  // since the static/SPA handlers above already caught everything else.
  app.use((req, res) => {
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Endpoint not found" } });
  });
  // Global error handler
  app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
  });
  return app;
}
module.exports = { createApp };
