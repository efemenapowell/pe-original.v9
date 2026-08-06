// ============================================================
// routes/coupon.routes.js — public coupon endpoints
//   POST /api/coupons/validate
//     body: { code: "WELCOME10", subtotal: 104000 }
//     → { valid: true, discount: 10400, coupon: {...} }
//     → 4xx with a customer-facing message when invalid
//   Admin CRUD lives under /api/admin/coupons (admin.routes.js).
// ============================================================
const { Router } = require('express');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const { validateCoupon } = require('../services/couponService');
const { asyncHandler } = require('../utils/helpers');

const router = Router();

const validateSchema = z.object({
  code: z.string().min(1, 'Coupon code is required').max(60),
  subtotal: z.coerce.number().int().min(0).max(100_000_000),
});

router.post(
  '/validate',
  validate(validateSchema),
  asyncHandler(async (req, res) => {
    const { code, subtotal } = req.body;
    const { coupon, discount } = await validateCoupon(code, subtotal);
    res.json({
      success: true,
      data: {
        valid: true,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        discount,
        minOrderAmount: coupon.minOrderAmount,
        maxDiscount: coupon.maxDiscount,
      },
    });
  })
);

module.exports = router;
