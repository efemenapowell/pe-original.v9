// ============================================================
// routes/order.routes.js
//   POST   /api/orders/checkout   — create order (auth OR guest)
//   GET    /api/orders            — my orders (auth)
//   GET    /api/orders/:id        — my order detail (auth)
//   GET    /api/orders/:id/confirm — public confirmation by orderNumber
//   Admin order management lives in admin.routes.js
// ============================================================
const { Router } = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const cache = require('../lib/cache');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ApiError } = require('../middleware/errorHandler');
const { asyncHandler, makeOrderNumber } = require('../utils/helpers');
const { sendOrderConfirmationEmail } = require('../services/emailService');
const paystack = require('../services/paystackService');
const { couponToOrderData, incrementCouponUsage } = require('../services/couponService');

const router = Router();

// Fallback defaults — used only if the admin hasn't set (or the DB is
// briefly unreachable for) these ContentBlock values. The admin panel's
// Settings → Shipping tab writes shipping.flatRate / shipping.freeThreshold
// as ContentBlock rows (see admin.routes.js content CRUD), so pricing can
// be changed without a code deploy.
const DEFAULT_SHIPPING_FLAT = 5000;
const DEFAULT_FREE_SHIP_THRESHOLD = 555000;

/** Reads the admin-configured shipping settings, cached alongside the rest
 *  of the public content (same 'content:*' cache-busting pattern used by
 *  content.routes.js / admin.routes.js content CRUD). */
async function getShippingSettings() {
  const cacheKey = 'content:shipping-settings';
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const rows = await prisma.contentBlock.findMany({
    where: { key: { in: ['shipping.flatRate', 'shipping.freeThreshold'] }, isActive: true },
  });
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const flatParsed = Number(byKey['shipping.flatRate']);
  const thresholdParsed = Number(byKey['shipping.freeThreshold']);

  const settings = {
    flatRate: Number.isFinite(flatParsed) && flatParsed >= 0 ? flatParsed : DEFAULT_SHIPPING_FLAT,
    freeThreshold:
      Number.isFinite(thresholdParsed) && thresholdParsed >= 0
        ? thresholdParsed
        : DEFAULT_FREE_SHIP_THRESHOLD,
  };

  await cache.set(cacheKey, settings);
  return settings;
}

const checkoutSchema = z.object({
  // shipping details
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().min(1, 'Last name is required').max(80),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(7, 'Valid phone number required').max(30),
  address: z.string().min(5, 'Street address is required').max(255),
  city: z.string().min(1, 'City is required').max(120),
  state: z.string().min(1, 'State is required').max(120),
  zip: z.string().max(20).optional().default(''),
  country: z.string().max(120).optional().default('Nigeria'),
  notes: z.string().max(1000).optional().default(''),
  // items — for guests; authenticated users may omit (server cart used)
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        size: z.string().min(1).max(10),
        qty: z.coerce.number().int().min(1).max(20),
      })
    )
    .min(1)
    .optional(),
  // CARD → paid via Paystack (redirect flow). TRANSFER → customer pays
  // into the store's bank account and the admin confirms manually.
  // WHATSAPP → customer sends the order over WhatsApp and pays/arranges
  // delivery there; also confirmed manually by the admin.
  paymentMethod: z.enum(['CARD', 'TRANSFER', 'WHATSAPP']).default('TRANSFER'),
  // optional discount code applied at checkout
  couponCode: z.string().trim().max(60).optional().default(''),
});

/** Build an order from validated input + resolved products. */
async function buildOrder(user, body) {
  let lineItems;

  if (user) {
    // Server-side cart for authenticated users
    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: { items: true },
    });
    if (!cart || cart.items.length === 0) {
      throw new ApiError(400, 'Your cart is empty');
    }
    lineItems = cart.items.map((i) => ({ productId: i.productId, size: i.size, qty: i.qty }));
  } else {
    lineItems = body.items;
  }

  // Resolve products & validate availability
  const productIds = [...new Set(lineItems.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  const orderItemsData = [];
  for (const li of lineItems) {
    const product = productMap.get(li.productId);
    if (!product) throw new ApiError(400, `Product not found: ${li.productId}`);
    const sizes = Array.isArray(product.sizes) ? product.sizes : [];
    if (!sizes.includes(li.size)) {
      throw new ApiError(400, `Size ${li.size} not available for ${product.name}`);
    }
    const lineTotal = product.price * li.qty;
    subtotal += lineTotal;
    orderItemsData.push({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      image: product.image,
      size: li.size,
      qty: li.qty,
      price: product.price,
      subtotal: lineTotal,
    });
  }

  const { flatRate, freeThreshold } = await getShippingSettings();
  // Shipping is decided on the pre-discount subtotal (industry standard —
  // the free-shipping threshold shouldn't be reached by a discount).
  const shipping = subtotal >= freeThreshold || subtotal === 0 ? 0 : flatRate;

  // Apply coupon (if any) — validate against subtotal, compute discount
  const couponData = await couponToOrderData(body.couponCode || '', subtotal);
  const discount = couponData.discount;
  // Total = items + shipping − coupon discount (never below 0)
  const total = Math.max(0, subtotal + shipping - discount);

  const order = await prisma.order.create({
    data: {
      orderNumber: makeOrderNumber(),
      userId: user ? user.id : null,
      status: 'PENDING',
      subtotal,
      shipping,
      discount,
      total,
      couponId: couponData.couponId,
      couponCode: couponData.couponCode,
      shipFirstName: body.firstName,
      shipLastName: body.lastName,
      shipEmail: body.email,
      shipPhone: body.phone,
      shipAddress: body.address,
      shipCity: body.city,
      shipState: body.state,
      shipZip: body.zip || '',
      shipCountry: body.country || 'Nigeria',
      paymentMethod: body.paymentMethod,
      notes: body.notes || '',
      items: { create: orderItemsData },
    },
    include: { items: true },
  });

  // Clear the server cart for authenticated users
  if (user) {
    await prisma.cartItem.deleteMany({ where: { cart: { userId: user.id } } });
  }

  // Coupon was consumed by this order — bump usage count
  // (fire-and-forget so a race-condition failure never blocks checkout)
  await incrementCouponUsage(couponData.couponId);

  // Fire-and-forget confirmation email (never block checkout on email)
  sendOrderConfirmationEmail(order.shipEmail, order, order.items).catch((err) =>
    console.warn('[order] confirmation email failed:', err.message)
  );

  return order;
}

// ---- Checkout -------------------------------------------------
router.post(
  '/checkout',
  optionalAuth,
  validate(checkoutSchema),
  asyncHandler(async (req, res) => {
    const order = await buildOrder(req.user || null, req.body);

    // Bank transfer / WhatsApp: order stays PENDING until the admin
    // sees the payment (transfer receipt or WhatsApp chat) and
    // confirms it manually in the admin panel.
    // Card: the order is created as PENDING too. The frontend then
    // calls POST /api/payments/initialize to start the Paystack
    // transaction and opens the Inline popup — so a Paystack outage
    // never blocks the order from being saved. (Legacy hosted-page
    // redirects still work via the initialize endpoint's
    // authorizationUrl.)
    return res.status(201).json({
      success: true,
      data: { order, message: 'Order placed — proceed to payment' },
    });
  })
);

// ---- Verify a Paystack payment (called by the frontend after the
//      customer is redirected back from Paystack's hosted page) -----
router.get(
  '/verify/:reference',
  asyncHandler(async (req, res) => {
    const { reference } = req.params;
    const order = await prisma.order.findUnique({
      where: { orderNumber: reference },
      include: { items: true },
    });
    if (!order) throw new ApiError(404, 'Order not found');

    // Already confirmed (e.g. user refreshed the callback page) — don't
    // re-verify or re-charge accounting logic.
    if (order.paymentStatus === 'PAID') {
      return res.json({ success: true, data: { order, verified: true } });
    }

    const tx = await paystack.verifyTransaction(reference);
    const amountMatches = tx.amount === Math.round(order.total * 100);

    if (tx.status === 'success' && amountMatches) {
      const paidOrder = await prisma.order.update({
        where: { id: order.id },
        data: { status: 'PAID', paymentStatus: 'PAID', paymentRef: tx.reference },
        include: { items: true },
      });
      return res.json({ success: true, data: { order: paidOrder, verified: true } });
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'FAILED' },
    });
    return res.json({
      success: true,
      data: { order, verified: false, message: 'Payment was not successful' },
    });
  })
);

// ---- My orders ------------------------------------------------
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    res.json({ success: true, data: orders });
  })
);

// ---- My order detail ------------------------------------------
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { items: true },
    });
    if (!order) throw new ApiError(404, 'Order not found');
    res.json({ success: true, data: order });
  })
);

// ---- Public confirmation by orderNumber ------------------------
router.get(
  '/confirm/:orderNumber',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { orderNumber: req.params.orderNumber },
      include: { items: true },
    });
    if (!order) throw new ApiError(404, 'Order not found');
    res.json({ success: true, data: order });
  })
);

module.exports = router;