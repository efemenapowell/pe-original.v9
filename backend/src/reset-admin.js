// ============================================================
// reset-admin.js — force-create or force-reset the admin login
//   Unlike seed.js (which only creates an admin if none exists),
//   this ALWAYS sets the admin's email/password to match
//   ADMIN_EMAIL / ADMIN_PASSWORD from the environment — fixing
//   cases where those variables were changed after the first
//   seed already ran, leaving the DB with stale credentials.
//
// Run on Railway:
//   railway run npm run reset-admin
// Run locally:
//   npm run reset-admin   (from backend/, with .env loaded)
// ============================================================
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('./lib/prisma');

async function resetAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!email || !password) {
    console.error('❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('❌ ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.admin.upsert({
    where: { email },
    update: { passwordHash, isActive: true },
    create: {
      email,
      passwordHash,
      name: process.env.ADMIN_NAME || 'Store Admin',
      role: 'SUPER_ADMIN',
    },
  });

  console.log(`✅ Admin credentials reset for: ${admin.email}`);
  console.log(`   You can now sign in at /admin with this email and the ADMIN_PASSWORD you set.`);
  process.exit(0);
}

resetAdmin().catch((err) => {
  console.error('❌ Failed to reset admin:', err.message);
  process.exit(1);
});
