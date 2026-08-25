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
    sub: "demo-user-1",
    organization_id: organizationId,
    role,
  },
  process.env.JWT_SECRET,
  { expiresIn: "1h" },
);

console.log(token);
