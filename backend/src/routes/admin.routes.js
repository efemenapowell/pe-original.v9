// ============================================================
// routes/admin.routes.js — protected admin API
// All routes require a valid ADMIN JWT (requireAdmin).
//   Products : CRUD + image upload + soft delete
//   Categories : CRUD
//   Content  : CRUD content blocks (hero, about, banners…)
//   Orders   : list, view, update status
//   Users    : list (for support)
// ============================================================
const { Router } = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const cache = require('../lib/cache');
const { requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { uploadImages } = require('../middleware/upload');
const { adminLimiter } = require('../middleware/rateLimiter');
const { ApiError } = require('../middleware/errorHandler');
const { asyncHandler, slugify } = require('../utils/helpers');

const router = Router();
router.use(adminLimiter);
router.use(requireAdmin);

/**
 * Multipart/form-data (used for product create/update, since it also
 * carries image files) can only send plain strings — arrays like
 * `sizes` arrive as a JSON string (e.g. '["S","M"]') rather than a
 * real array. Parse those fields back into arrays before Zod
 * validation runs, or validation always rejects them.
 */
function parseJsonArrayFields(...fields) {
  return (req, res, next) => {
    for (const field of fields) {
      const val = req.body[field];
      if (typeof val === 'string' && val.trim() !== '') {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) req.body[field] = parsed;
        } catch {
          // leave as-is; validation will report a clear error
        }
      }
    }
    next();
  };
}

// --------------------------------------------------------------
// PRODUCTS
// --------------------------------------------------------------
const productSchema = z.object({
  name: z.string().min(2).max(200),
  brand: z.string().min(1).max(120),
  description: z.string().max(5000).optional().default(''),
  price: z.coerce.number().int().min(0),
  originalPrice: z.coerce.number().int().min(0).optional().default(0),
  categoryId: z.string().optional().nullable(),
  sizes: z.array(z.string().min(1).max(10)).optional(),
  soldSizes: z.array(z.string().min(1).max(10)).optional(),
  image: z.string().optional().default(''),
  gallery: z.array(z.string()).optional(),
  badge: z.enum(['', 'sale', 'new', 'sold']).optional().default(''),
  rating: z.coerce.number().min(0).max(5).optional().default(0),
  reviews: z.coerce.number().int().min(0).optional().default(0),
  condition: z.string().max(200).optional().default(''),
  featured: z.coerce.boolean().optional().default(false),
  isActive: z.coerce.boolean().optional().default(true),
  stock: z.coerce.number().int().min(0).optional().default(1),
});

/** Invalidate all product caches after any product change. */
async function bustProductCache() {
  await cache.delByPattern('products:*');
}

// ---- List products (active by default; deleted ones are hidden
//      unless ?status=all is explicitly requested) --------------
router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 24, search, category, status } = req.query;
    const where = {};
    if (status !== 'all') where.isActive = true;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) where.categoryId = category;

    const [total, items] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: { category: { select: { id: true, slug: true, name: true } } },
      }),
    ]);
    res.json({
      success: true,
      data: { items, pagination: { page: Number(page), limit: Number(limit), total } },
    });
  })
);

// ---- Create product (with optional image upload) ---------------
router.post(
  '/products',
  uploadImages('images', 8),
  parseJsonArrayFields('sizes', 'soldSizes', 'gallery'),
  validate(productSchema),
  asyncHandler(async (req, res) => {
    const data = req.body;

    // Use uploaded files if present, else keep provided image paths
    const uploaded = (req.files || []).map((f) => `/uploads/${f.filename}`);
    const image = uploaded[0] || data.image || '';
    const gallery = uploaded.length > 1 ? uploaded : data.gallery || (image ? [image] : []);

    // Ensure unique slug
    let slug = slugify(data.name);
    let existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const product = await prisma.product.create({
      data: {
        slug,
        name: data.name,
        brand: data.brand,
        description: data.description,
        price: data.price,
        originalPrice: data.originalPrice,
        categoryId: data.categoryId || null,
        sizes: data.sizes || ['S', 'M', 'L'],
        soldSizes: data.soldSizes || [],
        image,
        gallery,
        badge: data.badge,
        rating: data.rating,
        reviews: data.reviews,
        condition: data.condition,
        featured: data.featured,
        isActive: data.isActive,
        stock: data.stock,
      },
    });

    await bustProductCache();
    res.status(201).json({ success: true, data: product });
  })
);

// ---- Update product -------------------------------------------
router.put(
  '/products/:id',
  uploadImages('images', 8),
  parseJsonArrayFields('sizes', 'soldSizes', 'gallery'),
  validate(productSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'Product not found');

    const data = req.body;
    const uploaded = (req.files || []).map((f) => `/uploads/${f.filename}`);
    const image = uploaded[0] || data.image || existing.image;
    const gallery =
      uploaded.length > 1 ? uploaded : data.gallery && data.gallery.length ? data.gallery : existing.gallery;

    const product = await prisma.product.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        brand: data.brand,
        description: data.description,
        price: data.price,
        originalPrice: data.originalPrice,
        categoryId: data.categoryId || null,
        sizes: data.sizes,
        soldSizes: data.soldSizes || [],
        image,
        gallery,
        badge: data.badge,
        rating: data.rating,
        reviews: data.reviews,
        condition: data.condition,
        featured: data.featured,
        isActive: data.isActive,
        stock: data.stock,
      },
    });

    await bustProductCache();
    res.json({ success: true, data: product });
  })
);

// ---- Soft delete product --------------------------------------
router.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    await bustProductCache();
    res.json({ success: true, data: { message: 'Product removed' } });
  })
);

// --------------------------------------------------------------
// CATEGORIES
// --------------------------------------------------------------
const categorySchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, hyphens').optional(),
  image: z.string().optional().default(''),
  order: z.coerce.number().int().min(0).optional().default(0),
  isActive: z.coerce.boolean().optional().default(true),
});

router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: { order: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    res.json({ success: true, data: categories });
  })
);

router.post(
  '/categories',
  uploadImages('image', 1),
  validate(categorySchema),
  asyncHandler(async (req, res) => {
    const uploaded = (req.files || []).map((f) => `/uploads/${f.filename}`);
    const image = uploaded[0] || req.body.image || '';
    const slug = req.body.slug || slugify(req.body.name);
    const category = await prisma.category.create({
      data: { name: req.body.name, slug, image, order: req.body.order, isActive: req.body.isActive },
    });
    await cache.delByPattern('categories:*');
    res.status(201).json({ success: true, data: category });
  })
);

router.put(
  '/categories/:id',
  uploadImages('image', 1),
  validate(categorySchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'Category not found');
    const uploaded = (req.files || []).map((f) => `/uploads/${f.filename}`);
    const category = await prisma.category.update({
      where: { id: existing.id },
      data: {
        name: req.body.name,
        slug: req.body.slug || existing.slug,
        image: uploaded[0] || req.body.image || existing.image,
        order: req.body.order,
        isActive: req.body.isActive,
      },
    });
    await cache.delByPattern('categories:*');
    await bustProductCache();
    res.json({ success: true, data: category });
  })
);

router.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    await prisma.category.delete({ where: { id: req.params.id } });
    await cache.delByPattern('categories:*');
    await bustProductCache();
    res.json({ success: true, data: { message: 'Category deleted' } });
  })
);

// --------------------------------------------------------------
// CONTENT BLOCKS (hero, about, banners, etc.)
// --------------------------------------------------------------
const contentSchema = z.object({
  key: z.string().min(2).max(120),
  // Optional here because image blocks may arrive as an uploaded file
  // instead of a text value — the handler fills `value` from req.files
  // and rejects the request if neither is present.
  value: z.string().optional().default(''),
  type: z.enum(['text', 'image', 'json']).default('text'),
  isActive: z.coerce.boolean().optional().default(true),
});

router.get(
  '/content',
  asyncHandler(async (req, res) => {
    const blocks = await prisma.contentBlock.findMany({ orderBy: { key: 'asc' } });
    res.json({ success: true, data: blocks });
  })
);

// ---- Create / overwrite a content block (supports image upload) ----
router.post(
  '/content',
  uploadImages('image', 1),
  validate(contentSchema),
  asyncHandler(async (req, res) => {
    const uploaded = (req.files || []).map((f) => `/uploads/${f.filename}`);
    const value = uploaded[0] || req.body.value;
    if (!value) throw new ApiError(400, 'Provide a value or upload an image');

    // upsert by key — admin can add or overwrite any block
    const block = await prisma.contentBlock.upsert({
      where: { key: req.body.key },
      create: { key: req.body.key, value, type: req.body.type, isActive: req.body.isActive },
      update: { value, type: req.body.type, isActive: req.body.isActive },
    });
    await cache.delByPattern('content:*');
    res.status(201).json({ success: true, data: block });
  })
);

router.put(
  '/content/:key',
  uploadImages('image', 1),
  validate(contentSchema),
  asyncHandler(async (req, res) => {
    const uploaded = (req.files || []).map((f) => `/uploads/${f.filename}`);
    const value = uploaded[0] || req.body.value;
    if (!value) throw new ApiError(400, 'Provide a value or upload an image');

    const block = await prisma.contentBlock.update({
      where: { key: req.params.key },
      data: { value, type: req.body.type, isActive: req.body.isActive },
    });
    await cache.delByPattern('content:*');
    res.json({ success: true, data: block });
  })
);

router.delete(
  '/content/:key',
  asyncHandler(async (req, res) => {
    await prisma.contentBlock.delete({ where: { key: req.params.key } });
    await cache.delByPattern('content:*');
    res.json({ success: true, data: { message: 'Content block deleted' } });
  })
);

// --------------------------------------------------------------
// ORDERS
// --------------------------------------------------------------
router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 24, status } = req.query;
    const where = status ? { status } : {};
    const [total, items] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: { items: true, user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
    ]);
    res.json({
      success: true,
      data: { items, pagination: { page: Number(page), limit: Number(limit), total } },
    });
  })
);

router.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true, user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } } },
    });
    if (!order) throw new ApiError(404, 'Order not found');
    res.json({ success: true, data: order });
  })
);

const statusSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).optional(),
});

router.patch(
  '/orders/:id/status',
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    const data = { ...req.body };
    // Marking an order PAID (e.g. after confirming a bank transfer or
    // WhatsApp payment) should also flip paymentStatus, unless the admin
    // explicitly set it themselves.
    if (data.status === 'PAID' && !data.paymentStatus) {
      data.paymentStatus = 'PAID';
    }
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, data: order });
  })
);

// --------------------------------------------------------------
// COUPONS — discount codes (admin CRUD)
// --------------------------------------------------------------
const couponSchema = z.object({
  code: z.string().trim().min(2).max(60),
  type: z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'),
  value: z.coerce.number().int().min(0),
  minOrderAmount: z.coerce.number().int().min(0).optional().default(0),
  maxDiscount: z.coerce.number().int().min(0).optional().default(0),
  usageLimit: z.coerce.number().int().min(0).optional().default(0),
  validFrom: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  isActive: z.coerce.boolean().optional().default(true),
});

const { normaliseCode, computeDiscount } = require('../services/couponService');

// ---- List coupons --------------------------------------------
router.get(
  '/coupons',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, search } = req.query;
    const where = search
      ? { code: { contains: String(search).toUpperCase(), mode: 'insensitive' } }
      : {};
    const [total, items] = await Promise.all([
      prisma.coupon.count({ where }),
      prisma.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
    ]);
    res.json({
      success: true,
      data: { items, pagination: { page: Number(page), limit: Number(limit), total } },
    });
  })
);

// ---- Create coupon -------------------------------------------
router.post(
  '/coupons',
  validate(couponSchema),
  asyncHandler(async (req, res) => {
    const data = req.body;
    const code = normaliseCode(data.code);

    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing) throw new ApiError(409, `Coupon code ${code} already exists`);

    const coupon = await prisma.coupon.create({
      data: {
        code,
        type: data.type,
        value: data.value,
        minOrderAmount: data.minOrderAmount,
        maxDiscount: data.maxDiscount,
        usageLimit: data.usageLimit,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        isActive: data.isActive,
      },
    });
    res.status(201).json({ success: true, data: coupon });
  })
);

// ---- Update coupon -------------------------------------------
router.put(
  '/coupons/:id',
  validate(couponSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'Coupon not found');

    const data = req.body;
    const code = normaliseCode(data.code);
    if (code !== existing.code) {
      const clash = await prisma.coupon.findUnique({ where: { code } });
      if (clash) throw new ApiError(409, `Coupon code ${code} already exists`);
    }

    const coupon = await prisma.coupon.update({
      where: { id: existing.id },
      data: {
        code,
        type: data.type,
        value: data.value,
        minOrderAmount: data.minOrderAmount,
        maxDiscount: data.maxDiscount,
        usageLimit: data.usageLimit,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        isActive: data.isActive,
      },
    });
    res.json({ success: true, data: coupon });
  })
);

// ---- Toggle active / deactivate ------------------------------
router.patch(
  '/coupons/:id/toggle',
  asyncHandler(async (req, res) => {
    const existing = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'Coupon not found');
    const coupon = await prisma.coupon.update({
      where: { id: existing.id },
      data: { isActive: !existing.isActive },
    });
    res.json({ success: true, data: coupon });
  })
);

// ---- Delete coupon -------------------------------------------
router.delete(
  '/coupons/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'Coupon not found');
    // Orders keep their couponCode snapshot; only the coupon row is removed.
    await prisma.coupon.delete({ where: { id: existing.id } });
    res.json({ success: true, data: { message: 'Coupon deleted' } });
  })
);

// --------------------------------------------------------------
// USERS (admin support view)
// --------------------------------------------------------------
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 24, search } = req.query;
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [total, items] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        select: {
          id: true, email: true, firstName: true, lastName: true, phone: true,
          isActive: true, createdAt: true, _count: { select: { orders: true } },
        },
      }),
    ]);
    res.json({ success: true, data: { items, pagination: { page: Number(page), limit: Number(limit), total } } });
  })
);

module.exports = router;