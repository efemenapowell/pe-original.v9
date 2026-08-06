// ============================================================
// middleware/auth.js — JWT auth + role guards
//   requireAuth          → any logged-in user (User table)
//   requireAdmin         → logged-in Admin (Admin table)
//   optionalAuth         → attach user if token present, else null
// ============================================================
const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../lib/prisma');
const { ApiError } = require('./errorHandler');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/** Verify a JWT and return its payload, or null. */
function verify(token, secret) {
  try {
    return jwt.verify(token, secret, { issuer: config.jwt.issuer });
  } catch {
    return null;
  }
}

/**
 * Require a valid User token.
 * Attaches req.user = { id, email, role }.
 */
async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw new ApiError(401, 'Authentication required');

    const payload = verify(token, config.jwt.accessSecret);
    if (!payload || payload.type !== 'user') {
      throw new ApiError(401, 'Invalid or expired token');
    }

    // Always re-check the user still exists & is active.
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) throw new ApiError(401, 'Account is disabled');

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Require a valid Admin token.
 * Attaches req.admin = { id, email, role }.
 */
async function requireAdmin(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw new ApiError(401, 'Admin authentication required');

    const payload = verify(token, config.jwt.accessSecret);
    if (!payload || payload.type !== 'admin') {
      throw new ApiError(401, 'Invalid or expired admin token');
    }

    const admin = await prisma.admin.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!admin || !admin.isActive) throw new ApiError(401, 'Admin account is disabled');

    req.admin = admin;
    return next();
  } catch (err) {
    return next(err);
  }
}

/** SUPER_ADMIN-only guard (for future use). */
function requireSuperAdmin(req, res, next) {
  if (!req.admin || req.admin.role !== 'SUPER_ADMIN') {
    return next(new ApiError(403, 'Super admin access required'));
  }
  return next();
}

/** Attach req.user if a valid token is present; never throw. */
async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (token) {
      const payload = verify(token, config.jwt.accessSecret);
      if (payload && payload.type === 'user') {
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, email: true, role: true },
        });
        if (user) req.user = user;
      }
    }
    return next();
  } catch {
    return next();
  }
}

module.exports = { requireAuth, requireAdmin, requireSuperAdmin, optionalAuth, verify, extractToken };
