// ============================================================
// routes/category.routes.js
//   GET /api/categories — public list (cached)
//   Admin CRUD under /api/admin/categories (see admin.routes.js)
// ============================================================
const { Router } = require('express');
const prisma = require('../lib/prisma');
const cache = require('../lib/cache');
const { asyncHandler } = require('../utils/helpers');

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const cacheKey = 'categories:all';
    const cached = await cache.get(cacheKey);
    if (cached) return res.json({ success: true, data: cached, cached: true });

    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: { _count: { select: { products: { where: { isActive: true } } } } },
    });

    await cache.set(cacheKey, categories);
    res.json({ success: true, data: categories });
  })
);

module.exports = router;
