const express = require("express");
const bcrypt = require("bcryptjs");
const { authenticate, permissionsForOrgRole } = require("../middleware/auth");
const { generateAccessToken } = require("../lib/tokens");
const { loginSchema } = require("../validators/authSchema");
const userRepository = require("../repositories/userRepository");

const router = express.Router();

// POST /api/auth/login — public, standalone email/password login.
// Replaces the old "paste your platform JWT" developer flow: the
// backend is now the source of truth for whether credentials are valid.
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_FAILED",
        message: parsed.error.errors[0]?.message || "Invalid request",
      },
    });
  }

  const { email, password } = parsed.data;

  try {
    const user = await userRepository.findByEmail(email);

    // Same generic response whether the email doesn't exist, the account
    // has no password set yet, or the password is wrong — never reveal
    // which one it was.
    if (!user || !user.password_hash) {
      return res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        },
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        },
      });
    }

    const token = generateAccessToken(user);
    // Same org-role permission lookup the authenticate middleware uses on
    // every subsequent request (organization_role_permissions, falling
    // back to ROLE_PERMISSIONS defaults) — sent once here so the frontend
    // can build its nav without a second round trip after login.
    const permissions = await permissionsForOrgRole(
      user.organization_id,
      user.role,
    );
    res.status(200).json({
      token,
      user: userRepository.toSafeUser(user),
      permissions,
    });
  } catch (err) {
    console.error("Login failed:", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
  }
});

// GET /api/auth/me — requires a valid JWT. The backend re-verifies the
// token (signature + expiry, via authenticate) and re-fetches the user
// from the database, so a client can never restore a session just by
// trusting whatever is decoded locally from a stored token.
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await userRepository.findById(req.auth.user_id);
    if (!user) {
      return res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "User not found" },
      });
    }
    // req.auth.permissions was already computed by authenticate() for this
    // same request (re-derived from the DB, never trusted from the token) —
    // reuse it rather than querying again.
    res
      .status(200)
      .json({
        user: userRepository.toSafeUser(user),
        permissions: req.auth.permissions,
      });
  } catch (err) {
    console.error("Fetching current user failed:", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
  }
});

module.exports = router;
