// ============================================================
// routes/cart.routes.js — server-side cart (logged-in users)
// Guests keep their cart in localStorage (client-side).
//   GET  /api/cart            — my cart with product details
//   POST /api/cart/items      — add item { productId, size, qty }
//   PATCH /api/cart/items/:id — update qty
//   DELETE /api/cart/items/:id — remove item
//   DELETE /api/cart          — clear cart
// ============================================================
const { Router } = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ApiError } = require('../middleware/errorHandler');
const { asyncHandler } = require('../utils/helpers');

const router = Router();
router.use(requireAuth);

const addSchema = z.object({
  productId: z.string().min(1),
  size: z.string().min(1).max(10),
  qty: z.coerce.number().int().min(1).max(20).default(1),
});

const qtySchema = z.object({ qty: z.coerce.number().int().min(1).max(20) });

/** Get-or-create the user's cart, returning it with items. */
async function getOrCreateCart(userId) {
  let cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: { product: { include: { category: { select: { slug: true, name: true } } } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      include: { items: { include: { product: true } } },
    });
  }
  return cart;
}

function cartView(cart) {
  const items = cart.items.map((i) => ({
    id: i.id,
    productId: i.productId,
    size: i.size,
    qty: i.qty,
    product: {
      id: i.product.id,
      name: i.product.name,
      brand: i.product.brand,
      price: i.product.price,
      originalPrice: i.product.originalPrice,
      image: i.product.image,
      slug: i.product.slug,
      badge: i.product.badge,
      category: i.product.category,
    },
    lineTotal: i.product.price * i.qty,
  }));
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  return { items, subtotal, count: items.reduce((s, i) => s + i.qty, 0) };
}

// ---- GET cart -------------------------------------------------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req.user.id);
    res.json({ success: true, data: cartView(cart) });
  })
);

// ---- Add item -------------------------------------------------
router.post(
  '/items',
  validate(addSchema),
  asyncHandler(async (req, res) => {
    const { productId, size, qty } = req.body;

    const product = await prisma.product.findFirst({
      where: { id: productId, isActive: true },
    });
    if (!product) throw new ApiError(404, 'Product not found');

    // Validate size exists on product
    const sizes = Array.isArray(product.sizes) ? product.sizes : [];
    if (!sizes.includes(size)) throw new ApiError(400, `Size ${size} is not available for this product`);

    const cart = await getOrCreateCart(req.user.id);

    const existing = await prisma.cartItem.findUnique({
      where: { cartId_productId_size: { cartId: cart.id, productId, size } },
    });

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { qty: Math.min(existing.qty + qty, 20) },
      });
    } else {
      await prisma.cartItem.create({ data: { cartId: cart.id, productId, size, qty } });
    }

    const updated = await getOrCreateCart(req.user.id);
    res.status(201).json({ success: true, data: cartView(updated) });
  })
);

// ---- Update qty ------------------------------------------------
router.patch(
  '/items/:id',
  validate(qtySchema),
  asyncHandler(async (req, res) => {
    const item = await prisma.cartItem.findFirst({
      where: { id: req.params.id, cart: { userId: req.user.id } },
    });
    if (!item) throw new ApiError(404, 'Cart item not found');

    await prisma.cartItem.update({ where: { id: item.id }, data: { qty: req.body.qty } });

    const updated = await getOrCreateCart(req.user.id);
    res.json({ success: true, data: cartView(updated) });
  })
);

// ---- Remove item ----------------------------------------------
router.delete(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const item = await prisma.cartItem.findFirst({
      where: { id: req.params.id, cart: { userId: req.user.id } },
    });
    if (!item) throw new ApiError(404, 'Cart item not found');

    await prisma.cartItem.delete({ where: { id: item.id } });

    const updated = await getOrCreateCart(req.user.id);
    res.json({ success: true, data: cartView(updated) });
  })
);

// ---- Clear cart -----------------------------------------------
router.delete(
  '/',
  asyncHandler(async (req, res) => {
    const cart = await prisma.cart.findUnique({ where: { userId: req.user.id } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    res.json({ success: true, data: { items: [], subtotal: 0, count: 0 } });
  })
);

module.exports = router;
