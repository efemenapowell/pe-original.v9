// ============================================================
// services/tokenService.js — password reset tokens
// Stores only the SHA-256 hash of the raw token (so a DB leak
// doesn't expose usable tokens). One table serves both users
// and admins (userId XOR adminId).
// ============================================================
const crypto = require('crypto');
const prisma = require('../lib/prisma');

const TTL_MS = 30 * 60 * 1000; // 30 minutes

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Create a reset token record. Returns { rawToken, expiresAt }. */
async function createResetToken({ userId = null, adminId = null }) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TTL_MS);

  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashToken(rawToken),
      userId,
      adminId,
      expiresAt,
    },
  });

  return { rawToken, expiresAt };
}

/**
 * Consume a reset token. Marks it used, returns the owning
 * entity (user or admin). Returns null if invalid/expired.
 */
async function consumeResetToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt < new Date()) return null;

  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  if (record.userId) {
    return { kind: 'user', id: record.userId };
  }
  if (record.adminId) {
    return { kind: 'admin', id: record.adminId };
  }
  return null;
}

/** Invalidate all outstanding tokens for a user/admin (e.g. after reset). */
async function invalidateAllFor({ userId = null, adminId = null }) {
  await prisma.passwordResetToken.updateMany({
    where: userId ? { userId, usedAt: null } : { adminId, usedAt: null },
    data: { usedAt: new Date() },
  });
}

module.exports = { createResetToken, consumeResetToken, invalidateAllFor, hashToken, TTL_MS };
