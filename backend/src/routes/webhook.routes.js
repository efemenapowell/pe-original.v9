// ============================================================
// routes/webhook.routes.js
//   POST /api/webhooks/paystack
//   Paystack calls this directly (server-to-server) once a charge
//   completes, regardless of whether the customer's browser ever
//   made it back to /checkout.html?paystack_callback=1. This is
//   what confirms payment if the customer closes the tab right
//   after paying on Paystack's hosted page.
//
//   IMPORTANT: this route needs the *raw* request body to verify
//   Paystack's signature, so it must be mounted in server.js
//   BEFORE the global express.json() parser — otherwise the body
//   would already be consumed/parsed and signature verification
//   would fail on every request.
//   Docs: https://paystack.com/docs/payments/webhooks/
// ============================================================
const { Router } = require('express');
const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const config = require('../config');

const router = Router();

router.post(
  '/paystack',
  express.raw({ type: '*/*', limit: '1mb' }), // req.body is a raw Buffer here
  async (req, res) => {
    try {
      const secret = config.paystack.secretKey;
      const signature = req.headers['x-paystack-signature'];

      // Not configured / no signature header — nothing we can verify.
      if (!secret || !signature) {
        return res.sendStatus(400);
      }

      // Paystack signs the raw body with your secret key (HMAC SHA512).
      // If this doesn't match, the request didn't come from Paystack.
      const expectedHash = crypto.createHmac('sha512', secret).update(req.body).digest('hex');
      if (expectedHash !== signature) {
        return res.sendStatus(401);
      }

      let event;
      try {
        event = JSON.parse(req.body.toString('utf8'));
      } catch {
        return res.sendStatus(400);
      }

      // We only care about successful charges. Everything else is
      // acknowledged so Paystack stops retrying, and ignored.
      if (event.event === 'charge.success') {
        const data = event.data || {};
        const reference = data.reference;

        const order = reference
          ? await prisma.order.findUnique({ where: { orderNumber: reference } })
          : null;

        // Idempotent: if we've already marked this order PAID (e.g. the
        // customer's browser already hit /verify/:reference), skip.
        if (order && order.paymentStatus !== 'PAID') {
          const amountMatches = data.amount === Math.round(order.total * 100);
          if (amountMatches && data.status === 'success') {
            await prisma.order.update({
              where: { id: order.id },
              data: { status: 'PAID', paymentStatus: 'PAID', paymentRef: data.reference },
            });
          } else {
            console.warn(
              `[webhook] charge.success for ${reference} but amount/status mismatch — not marking paid`
            );
          }
        }
      }

      // Always 200 once the signature checks out, so Paystack doesn't
      // keep retrying — even for event types we don't act on.
      return res.sendStatus(200);
    } catch (err) {
      // Log server-side; still ack with 200 so a transient bug on our
      // end doesn't trigger a Paystack retry storm. The charge itself
      // already succeeded on Paystack's side either way.
      console.error('[webhook] paystack handler error:', err.message);
      return res.sendStatus(200);
    }
  }
);

module.exports = router;
