// ============================================================
// routes/adminAuth.routes.js — admin login + password reset
//   POST /api/admin/auth/login
//   POST /api/admin/auth/refresh
//   GET  /api/admin/auth/me        (protected)
//   POST /api/admin/auth/forgot-password
//   POST /api/admin/auth/reset-password
// ============================================================
const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { validate } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const { requireAdmin } = require('../middleware/auth');
const { issueAdminTokens, rotateRefresh } = require('../services/authService');
const { createResetToken, consumeResetToken, invalidateAllFor } = require('../services/tokenService');
const { sendPasswordResetEmail } = require('../services/emailService');
const { ApiError } = require('../middleware/errorHandler');
const { asyncHandler } = require('../utils/helpers');
const config = require('../config');

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({ refreshToken: z.string().min(10) });
const forgotSchema = z.object({ email: z.string().email('Invalid email address') });
const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// ---- Admin login ----------------------------------------------
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const email = req.body.email.toLowerCase().trim();
    const admin = await prisma.admin.findUnique({ where: { email } });

    if (!admin || !admin.isActive) throw new ApiError(401, 'Invalid credentials');
    const ok = await bcrypt.compare(req.body.password, admin.passwordHash);
    if (!ok) throw new ApiError(401, 'Invalid credentials');

    await prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    const tokens = issueAdminTokens(admin);

    res.json({
      success: true,
      data: { admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role }, ...tokens },
    });
  })
);

// ---- Admin refresh --------------------------------------------
router.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const result = rotateRefresh(req.body.refreshToken, 'admin');
    if (!result) throw new ApiError(401, 'Invalid or expired refresh token');

    const admin = await prisma.admin.findUnique({
      where: { id: result.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!admin || !admin.isActive) throw new ApiError(401, 'Account unavailable');

    res.json({ success: true, data: issueAdminTokens(admin) });
  })
);

// ---- Admin me -------------------------------------------------
router.get(
  '/me',
  requireAdmin,
  (req, res) => {
    res.json({
      success: true,
      data: { admin: { id: req.admin.id, email: req.admin.email, role: req.admin.role } },
    });
  }
);

// ---- Admin forgot password ------------------------------------
router.post(
  '/forgot-password',
  authLimiter,
  validate(forgotSchema),
  asyncHandler(async (req, res) => {
    const email = req.body.email.toLowerCase().trim();
    const admin = await prisma.admin.findUnique({ where: { email } });

    if (admin) {
      const { rawToken } = await createResetToken({ adminId: admin.id });
      const resetUrl = `${config.publicUrl}/admin/reset-password.html?token=${rawToken}`;
      await sendPasswordResetEmail(email, resetUrl, true);
    }

    res.json({
      success: true,
      data: { message: 'If that email is registered, a reset link has been sent.' },
    });
  })
);

// ---- Admin reset password -------------------------------------
router.post(
  '/reset-password',
  authLimiter,
  validate(resetSchema),
  asyncHandler(async (req, res) => {
    const owner = await consumeResetToken(req.body.token);
    if (!owner || owner.kind !== 'admin') throw new ApiError(400, 'Invalid or expired reset token');

    const passwordHash = await bcrypt.hash(req.body.password, 12);
    await prisma.admin.update({ where: { id: owner.id }, data: { passwordHash } });
    await invalidateAllFor({ adminId: owner.id });

    res.json({ success: true, data: { message: 'Password updated. You can now sign in.' } });
  })
);

module.exports = router;