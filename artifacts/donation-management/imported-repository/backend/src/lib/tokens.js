const jwt = require("jsonwebtoken");
require("dotenv").config();

// Single place that knows how to mint an access token for an
// authenticated user. Used by POST /api/auth/login. Mirrors the claim
// shape middleware/auth.js already expects (sub, organization_id, role,
// name, email) and middleware/generateToken.js used for dev tokens —
// this is now the real, backend-driven equivalent of that script.
//
// Never put password_hash or any other sensitive field in the token:
// JWT payloads are base64, not encrypted, and are readable by anyone
// holding the token.
function generateAccessToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET must be set in environment. Check your .env file.",
    );
  }

  return jwt.sign(
    {
      sub: user.id,
      organization_id: user.organization_id,
      role: user.role,
      name: user.name || null,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

module.exports = { generateAccessToken };
