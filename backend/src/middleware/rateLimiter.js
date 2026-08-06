// ============================================================
// middleware/rateLimiter.js — express-rate-limit instances
//   • global limiter → all API routes
//   • authLimiter   → login / register / forgot-password
//                     (brute-force protection)
//   • adminLimiter  → admin endpoints
// ============================================================
const rateLimit = require('express-rate-limit');
const config = require('../config');

const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests — slow down and try again shortly.' } },
});

const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many auth attempts — try again in a minute.' } },
});

const adminLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many admin requests — try again shortly.' } },
});

module.exports = { globalLimiter, authLimiter, adminLimiter };
