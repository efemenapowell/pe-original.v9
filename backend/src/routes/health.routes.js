// ============================================================
// routes/health.routes.js — uptime & dependency status
// ============================================================
const { Router } = require('express');
const prisma = require('../lib/prisma');
const { redis } = require('../lib/cache');

const router = Router();

router.get('/', async (req, res) => {
  let db = 'up';
  let cache = 'up';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = 'down';
  }
  try {
    if (redis) await redis.ping();
    else cache = 'down (disabled)';
  } catch {
    cache = 'down';
  }

  res.json({
    success: true,
    data: {
      status: db === 'up' ? 'ok' : 'degraded',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      db,
      cache,
    },
  });
});

module.exports = router;
