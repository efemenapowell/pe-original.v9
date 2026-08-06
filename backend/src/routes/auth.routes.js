// ============================================================
// routes/auth.routes.js — public user auth endpoints
//   POST /api/auth/register
//   POST /api/auth/login
//   POST /api/auth/refresh
//   POST /api/auth/logout
//   GET  /api/auth/me            (protected)
//   PATCH /api/auth/profile      (protected)
//   POST /api/auth/forgot-password
//   POST /api/auth/reset-password
// ============================================================
const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { validate } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const { requireAuth } = require('../middleware/auth');
const { issueUserTokens, rotateRefresh } = require('../services/authService');
const { createResetToken, consumeResetToken, invalidateAllFor } = require('../services/tokenService');
const { sendPasswordResetEmail } = require('../services/emailService');
const { ApiError } = require('../middleware/errorHandler');
const { asyncHandler, publicUser } = require('../utils/helpers');
const config = require('../config');

const router = Router();

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().max(80).optional().default(''),
  lastName: z.string().max(80).optional().default(''),
  phone: z.string().max(30).optional().default(''),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const forgotSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const profileSchema = z.object({
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(255).optional(),
  city: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
});

// ---- Register -------------------------------------------------
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName, phone } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (exists) throw new ApiError(409, 'An account with this email already exists');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email: normalizedEmail, passwordHash, firstName, lastName, phone },
    });

    const tokens = issueUserTokens(user);
    res.status(201).json({ success: true, data: { user: publicUser(user), ...tokens } });
  })
);

// ---- Login ----------------------------------------------------
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.isActive) throw new ApiError(401, 'Invalid email or password');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new ApiError(401, 'Invalid email or password');

    const tokens = issueUserTokens(user);
    res.json({ success: true, data: { user: publicUser(user), ...tokens } });
  })
);

// ---- Refresh token --------------------------------------------
router.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const result = rotateRefresh(req.body.refreshToken, 'user');
    if (!result) throw new ApiError(401, 'Invalid or expired refresh token');

    const user = await prisma.user.findUnique({
      where: { id: result.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) throw new ApiError(401, 'Account unavailable');

    const tokens = issueUserTokens(user);
    res.json({ success: true, data: tokens });
  })
);

// ---- Logout (stateless — client discards tokens) --------------
router.post('/logout', (req, res) => {
  res.json({ success: true, data: { message: 'Logged out' } });
});

// ---- Me -------------------------------------------------------
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json({ success: true, data: { user: publicUser(user) } });
  })
);

// ---- Update profile -------------------------------------------
router.patch(
  '/profile',
  requireAuth,
  validate(profileSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: req.body,
    });
    res.json({ success: true, data: { user: publicUser(user) } });
  })
);

// ---- Forgot password ------------------------------------------
router.post(
  '/forgot-password',
  authLimiter,
  validate(forgotSchema),
  asyncHandler(async (req, res) => {
    const email = req.body.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success — don't reveal whether an account exists.
    if (user) {
      const { rawToken } = await createResetToken({ userId: user.id });
      const resetUrl = `${config.publicUrl}/reset-password.html?token=${rawToken}`;
      await sendPasswordResetEmail(email, resetUrl, false);
    }

    res.json({
      success: true,
      data: { message: 'If that email is registered, a reset link has been sent.' },
    });
  })
);

// ---- Reset password -------------------------------------------
router.post(
  '/reset-password',
  authLimiter,
  validate(resetSchema),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    const owner = await consumeResetToken(token);
    if (!owner || owner.kind !== 'user') throw new ApiError(400, 'Invalid or expired reset token');

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { id: owner.id }, data: { passwordHash } });
    await invalidateAllFor({ userId: owner.id });

    res.json({ success: true, data: { message: 'Password updated. You can now sign in.' } });
  })
);

module.exports = router;