import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { createApp } = require(
  path.resolve(__dirname, "../../donation-management/imported-repository/backend/src/app.js")
);

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const app = createApp();

app.listen(port, "0.0.0.0", () => {
  console.log(`Donation Management backend listening on port ${port}`);
});
