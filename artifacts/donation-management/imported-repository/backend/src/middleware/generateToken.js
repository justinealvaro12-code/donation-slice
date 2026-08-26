require("dotenv").config();
const jwt = require("jsonwebtoken");

const VALID_ROLES = [
  "viewer",
  "fundraising_staff",
  "finance_staff",
  "manager",
  "administrator",
];
const DEFAULT_ORG_ID = "376bfbb0-5bff-41e7-905d-d4bf495c31b1";
// created_by / updated_by columns across every table are typed UUID, not
// text — this has to be a real UUID or any write action (donations,
// donors, campaigns, pledges, etc.) throws a Postgres type error and
// 500s. Fixed placeholder is fine since there's no real user accounts
// table in this slice yet.
const DEFAULT_USER_ID = "8f14e45f-ceea-467e-9a3a-1b4b3d5a2f61";

const role = process.argv[2] || "administrator";
const organizationId = process.argv[3] || DEFAULT_ORG_ID;

if (!VALID_ROLES.includes(role)) {
  console.error(
    `Invalid role "${role}". Must be one of: ${VALID_ROLES.join(", ")}`,
  );
  process.exit(1);
}

const token = jwt.sign(
  {
    sub: DEFAULT_USER_ID,
    organization_id: organizationId,
    role,
  },
  process.env.JWT_SECRET,
  { expiresIn: "1h" },
);

console.log(token);
