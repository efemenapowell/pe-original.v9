// ============================================================
// services/authService.js — JWT issuance & verification
// Access token (short) + refresh token (long, rotation-capable).
// ============================================================
const jwt = require('jsonwebtoken');
const config = require('../config');

function sign(payload, secret, ttl) {
  return jwt.sign(payload, secret, {
    expiresIn: ttl,
    issuer: config.jwt.issuer,
  });
}

/** Issue a pair of tokens for a User. */
function issueUserTokens(user) {
  const access = sign(
    { sub: user.id, email: user.email, type: 'user', role: user.role || 'CUSTOMER' },
    config.jwt.accessSecret,
    config.jwt.accessTtl
  );
  const refresh = sign(
    { sub: user.id, type: 'refresh', kind: 'user' },
    config.jwt.refreshSecret,
    config.jwt.refreshTtl
  );
  return { accessToken: access, refreshToken: refresh };
}

/** Issue a pair of tokens for an Admin. */
function issueAdminTokens(admin) {
  const access = sign(
    { sub: admin.id, email: admin.email, type: 'admin', role: admin.role || 'ADMIN' },
    config.jwt.accessSecret,
    config.jwt.accessTtl
  );
  const refresh = sign(
    { sub: admin.id, type: 'refresh', kind: 'admin' },
    config.jwt.refreshSecret,
    config.jwt.refreshTtl
  );
  return { accessToken: access, refreshToken: refresh };
}

/**
 * Rotate a refresh token into a new pair.
 * kind: 'user' | 'admin'
 */
function rotateRefresh(token, kind) {
  try {
    const payload = jwt.verify(token, config.jwt.refreshSecret, { issuer: config.jwt.issuer });
    if (payload.type !== 'refresh' || payload.kind !== kind) return null;
    return { sub: payload.sub, kind: payload.kind };
  } catch {
    return null;
  }
}

module.exports = { issueUserTokens, issueAdminTokens, rotateRefresh };
