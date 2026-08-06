// ============================================================
// routes/content.routes.js
//   GET /api/content — public site content (hero, about, banners…)
//   Admin CRUD under /api/admin/content (see admin.routes.js)
// ============================================================
const { Router } = require('express');
const prisma = require('../lib/prisma');
const cache = require('../lib/cache');
const { asyncHandler } = require('../utils/helpers');

const router = Router();

/**
 * Returns all active content blocks keyed by `key`:
 *   { "hero.title": "…", "hero.subtitle": "…", "banners": "[...]", … }
 * The frontend can look up any block it needs.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const cacheKey = 'content:all';
    const cached = await cache.get(cacheKey);
    if (cached) return res.json({ success: true, data: cached, cached: true });

    const blocks = await prisma.contentBlock.findMany({ where: { isActive: true } });

    const content = {};
    for (const b of blocks) {
      content[b.key] = b.type === 'json' ? JSON.parse(b.value || '{}') : b.value;
    }

    await cache.set(cacheKey, content);
    res.json({ success: true, data: content });
  })
);

module.exports = router;
