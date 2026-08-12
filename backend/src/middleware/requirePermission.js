// Checks the permission array that authenticate() already attached to
// req.auth (see middleware/auth.js — req.auth.permissions comes from
// permissionsForRole(role) at login/token-verify time).
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Missing authentication' } });
    }

    if (!req.auth.permissions || !req.auth.permissions.includes(permission)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: `Missing required permission: ${permission}` },
      });
    }

    next();
  };
}

module.exports = { requirePermission };