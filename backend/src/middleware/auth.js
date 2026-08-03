const jwt = require('jsonwebtoken');
const { permissionsForRole } = require('../rolePermissions');

// This middleware stands in for ARGO's platform authentication. Real ARGO
// verifies its own platform-issued JWT the same way; this module never
// implements its own login/session system, per the assessment constraint.
//
// CRITICAL: organization_id and user_id come ONLY from the verified token
// claims. They are never read from req.body, req.query, or any header.
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Missing bearer token' } });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { sub: user_id, organization_id, role } = payload;

    if (!user_id || !organization_id || !role) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Malformed token claims' } });
    }

    req.auth = {
      user_id,
      organization_id,
      role,
      permissions: permissionsForRole(role),
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Invalid or expired token' } });
  }
}

module.exports = { authenticate };
