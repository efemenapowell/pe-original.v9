// ============================================================
// utils/helpers.js — shared small helpers
// ============================================================

/** Slugify a product name → url-safe slug. */
function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Human-readable unique order number, e.g. PE-20260805-A1B2. */
function makeOrderNumber() {
  const d = new Date();
  const ymd = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PE-${ymd}-${rand}`;
}

/** Async handler wrapper — forwards rejected promises to Express error handling. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Strip sensitive fields from a user object. */
function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

module.exports = { slugify, makeOrderNumber, asyncHandler, publicUser };
