// ============================================================
// routes/payment.routes.js — Paystack payment endpoints
//   POST /api/payments/initialize      — start a Paystack transaction
//   GET  /api/payments/verify/:reference — verify + mark order PAID
//
// Flow:
//   1. Frontend calls POST /api/orders/checkout with paymentMethod=CARD
//      → order is created (PENDING) with paymentRef = orderNumber.
//   2. Frontend (or checkout page) calls POST /api/payments/initialize
//      with { orderId } → Paystack returns authorization_url + access_code.
//   3. Paystack Inline JS opens a popup with the public key +
//      access_code (or authorization_url redirect), customer pays.
//   4. On success the frontend calls GET /api/payments/verify/:reference
//      (or Paystack calls our webhook) → order marked PAID.
// ============================================================
const { Router } = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { validate } = require('../middleware/validate');
const { ApiError } = require('../middleware/errorHandler');
const { asyncHandler } = require('../utils/helpers');
const paystack = require('../services/paystackService');
const config = require('../config');

const router = Router();

const initializeSchema = z.object({
  orderId: z.string().min(1),
  email: z.string().email('Invalid email').optional(), // fallback if order has none
});

/**
 * POST /api/payments/initialize
 * Starts a Paystack transaction for an order. Returns the
 * authorization_url + access_code for the Paystack Inline popup.
 * Only works for CARD orders that are still PENDING.
 */
router.post(
  '/initialize',
  validate(initializeSchema),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.body.orderId },
      include: { items: true },
    });
    if (!order) throw new ApiError(404, 'Order not found');
    if (order.paymentMethod !== 'CARD') {
      throw new ApiError(400, 'This order is not a card payment.');
    }
    if (order.paymentStatus === 'PAID') {
      throw new ApiError(400, 'This order has already been paid.');
    }

    const email = order.shipEmail || req.body.email;
    if (!email) throw new ApiError(400, 'A customer email is required to start payment.');

    // Reference must be unique per transaction — use the orderNumber
    const reference = order.orderNumber;
    const callbackUrl = `${config.publicUrl}/checkout.html?paystack_callback=1&reference=${encodeURIComponent(reference)}`;
    const paystackTx = await paystack.initializeTransaction({
      email,
      amountNaira: order.total,
      reference,
      callbackUrl,
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentRef: reference },
    });

    res.json({
      success: true,
      data: {
        authorizationUrl: paystackTx.authorization_url,
        accessCode: paystackTx.access_code,
        reference,
        publicKey: config.paystack.publicKey,
      },
    });
  })
);

/**
 * GET /api/payments/verify/:reference
 * Verifies a Paystack transaction by reference and — when the
 * amount matches and status is success — marks the order PAID.
 * Idempotent: returns immediately if already PAID.
 */
router.get(
  '/verify/:reference',
  asyncHandler(async (req, res) => {
    const { reference } = req.params;
    const order = await prisma.order.findUnique({
      where: { orderNumber: reference },
      include: { items: true },
    });
    if (!order) throw new ApiError(404, 'Order not found');

    if (order.paymentStatus === 'PAID') {
      return res.json({ success: true, data: { order, verified: true, alreadyPaid: true } });
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

module.exports = router;
