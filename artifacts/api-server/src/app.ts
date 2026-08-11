import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";

// @ts-ignore - legacy CommonJS module
import { authenticate } from "./legacy/middleware/auth.js";

// @ts-ignore
import donationsRouter from "./legacy/routes/donations.js";
// @ts-ignore
import donorsRouter from "./legacy/routes/donors.js";
// @ts-ignore
import receiptsRouter from "./legacy/routes/receipts.js";
// @ts-ignore
import organizationsRouter from "./legacy/routes/organizations.js";
// @ts-ignore
import campaignsRouter from "./legacy/routes/campaigns.js";
// @ts-ignore
import pledgesRouter from "./legacy/routes/pledges.js";
// @ts-ignore
import reportsRouter from "./legacy/routes/reports.js";
// @ts-ignore
import settingsRouter from "./legacy/routes/settings.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", authenticate);

app.use("/api/donations", donationsRouter);
app.use("/api/donors", donorsRouter);
app.use("/api/receipts", receiptsRouter);
app.use("/api/organizations", organizationsRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/pledges", pledgesRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/settings", settingsRouter);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
});

export default app;
