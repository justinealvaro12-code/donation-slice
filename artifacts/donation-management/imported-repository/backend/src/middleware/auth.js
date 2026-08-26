const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { permissionsForRole } = require("../rolePermissions");
require("dotenv").config();

// Looks up this organization's actual permission grants for the role from
// organization_role_permissions (editable via Settings > Roles &
// Permissions). Falls back to the hardcoded ROLE_PERMISSIONS defaults if
// the org has no rows yet for this role.
async function permissionsForOrgRole(organizationId, role) {
  const result = await pool.query(
    `SELECT permission FROM organization_role_permissions
     WHERE organization_id = $1 AND role = $2`,
    [organizationId, role],
  );

  if (result.rows.length === 0) {
    return permissionsForRole(role);
  }

  return result.rows.map((r) => r.permission);
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res
      .status(401)
      .json({
        error: { code: "UNAUTHENTICATED", message: "Missing bearer token" },
      });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    const { sub: user_id, organization_id, role, name, email } = payload;

    if (!user_id || !organization_id || !role) {
      return res
        .status(401)
        .json({
          error: { code: "UNAUTHENTICATED", message: "Malformed token claims" },
        });
    }

    const permissions = await permissionsForOrgRole(organization_id, role);

    req.auth = {
      user_id,
      organization_id,
      role,
      name: name || null,
      email: email || null,
      permissions,
    };
    next();
  } catch (err) {
    if (
      err instanceof jwt.JsonWebTokenError ||
      err instanceof jwt.TokenExpiredError
    ) {
      return res
        .status(401)
        .json({
          error: {
            code: "UNAUTHENTICATED",
            message: "Invalid or expired token",
          },
        });
    }
    console.error("Auth lookup failed:", err);
    return res
      .status(500)
      .json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Authentication check failed",
        },
      });
  }
}

module.exports = { authenticate, permissionsForOrgRole };
