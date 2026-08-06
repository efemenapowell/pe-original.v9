// ============================================================
// config/index.js — centralised environment configuration
// All secrets & settings are read from process.env (dotenv).
// ============================================================
require('dotenv').config();

function required(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    // In dev, fail loudly so misconfiguration is caught early.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[config] Missing env var ${name} — using empty value`);
      return '';
    }
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  publicUrl: required('PUBLIC_URL', 'http://localhost:5000'),

  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5500')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  databaseUrl: required('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/pe_originals'),

  redis: {
    // Empty/absent REDIS_URL disables the cache entirely (Railway-friendly).
    url: process.env.REDIS_URL || '',
    cacheTtl: parseInt(process.env.REDIS_CACHE_TTL || '300', 10),
  },

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev_access_secret_please_change'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev_refresh_secret_please_change'),
    accessTtl: required('JWT_ACCESS_TTL', '15m'),
    refreshTtl: required('JWT_REFRESH_TTL', '7d'),
    issuer: required('JWT_ISSUER', 'pe-originals-api'),
  },

  smtp: {
    host: required('SMTP_HOST', 'smtp.gmail.com'),
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: required('SMTP_USER', ''),
    pass: required('SMTP_PASS', ''),
    from: required('MAIL_FROM', '"PE_ORIGINALS" <no-reply@peoriginals.com>'),
    devMode: process.env.MAIL_DEV_MODE === 'true',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '120', 10),
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
  },

  uploadDir: require('path').join(__dirname, '../../uploads'),

  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY || '',
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
  },
};