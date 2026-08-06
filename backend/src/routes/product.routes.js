// ============================================================
// routes/product.routes.js
//   GET  /api/products            — public list (filters, sort, pagination)
//   GET  /api/products/featured   — public featured
//   GET  /api/products/:idOrSlug  — public detail
//   Admin CRUD under /api/admin/products (see admin.routes.js)
// ============================================================
const { Router } = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const cache = require('../lib/cache');
const { validate } = require('../middleware/validate');
const { ApiError } = require('../middleware/errorHandler');
const { asyncHandler } = require('../utils/helpers');

const router = Router();

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  category: z.string().optional(),
  brand: z.string().optional(),
  size: z.string().optional(),
  badge: z.string().optional(),
  search: z.string().max(100).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['newest', 'price-asc', 'price-desc', 'rating', 'featured']).default('newest'),
  featured: z.coerce.boolean().optional(),
});

// ---- List products (public, cached) ---------------------------
router.get(
  '/',
  validate(querySchema, 'query'),
  asyncHandler(async (req, res) => {
    const q = req.query;

    // Cache key includes every filter so different views cache separately.
    const cacheKey = `products:list:${JSON.stringify(q)}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json({ success: true, data: cached, cached: true });

    const where = { isActive: true };

    if (q.featured) where.featured = true;
    if (q.category) {
      where.category = { slug: q.category };
    }
    if (q.brand) where.brand = { equals: q.brand, mode: 'insensitive' };
    if (q.badge) where.badge = q.badge;
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { brand: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.size) {
      // JSON array containment — size appears in the sizes array
      where.sizes = { array_contains: [q.size] };
    }
    if (q.minPrice !== undefined || q.maxPrice !== undefined) {
      where.price = {};
      if (q.minPrice !== undefined) where.price.gte = q.minPrice;
      if (q.maxPrice !== undefined) where.price.lte = q.maxPrice;
    }

    const orderBy = {
      newest: { createdAt: 'desc' },
      'price-asc': { price: 'asc' },
      'price-desc': { price: 'desc' },
      rating: { rating: 'desc' },
      featured: [{ featured: 'desc' }, { createdAt: 'desc' }],
    }[q.sort];

    const skip = (q.page - 1) * q.limit;

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: q.limit,
        include: { category: { select: { slug: true, name: true } } },
      }),
    ]);

    const data = {
      items: products,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.limit)),
      },
    };

    await cache.set(cacheKey, data);
    res.json({ success: true, data });
  })
);

// ---- Featured (public, cached) --------------------------------
router.get(
  '/featured',
  asyncHandler(async (req, res) => {
    const cacheKey = 'products:featured';
    const cached = await cache.get(cacheKey);
    if (cached) return res.json({ success: true, data: cached, cached: true });

    const items = await prisma.product.findMany({
      where: { isActive: true, featured: true },
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: { category: { select: { slug: true, name: true } } },
    });

    await cache.set(cacheKey, items);
    res.json({ success: true, data: items });
  })
);

// ---- Product detail (public, cached) --------------------------
router.get(
  '/:idOrSlug',
  asyncHandler(async (req, res) => {
    const { idOrSlug } = req.params;
    const cacheKey = `products:one:${idOrSlug}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json({ success: true, data: cached, cached: true });

    const product = await prisma.product.findFirst({
      where: {
        isActive: true,
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: { category: { select: { slug: true, name: true } } },
    });

    if (!product) throw new ApiError(404, 'Product not found');

    // Related products — same category, exclude self, take 4
    const related = await prisma.product.findMany({
      where: {
        isActive: true,
        categoryId: product.categoryId || undefined,
        id: { not: product.id },
      },
      take: 4,
      include: { category: { select: { slug: true, name: true } } },
    });

    const data = { product, related };
    await cache.set(cacheKey, data);
    res.json({ success: true, data });
  })
);

module.exports = router;
