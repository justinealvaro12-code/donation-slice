// Every mutating/sensitive route declares exactly one required permission.
// A user lacking it always gets 403, checked before the route handler runs.
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.auth || !req.auth.permissions.includes(permission)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: `Missing required permission: ${permission}` },
      });
    }
    next();
  };
}

module.exports = { requirePermission };
