// ============================================================
// services/couponService.js — coupon validation & discount math
// Shared by:
//   • routes/coupon.routes.js   (public POST /api/coupons/validate)
//   • routes/order.routes.js    (checkout applies the coupon)
//   • routes/admin.routes.js    (admin CRUD uses helpers here)
// ============================================================
const prisma = require('../lib/prisma');
const { ApiError } = require('../middleware/errorHandler');

/**
 * Normalise a coupon code: trim + uppercase, so "welcome10 " → "WELCOME10".
 */
function normaliseCode(code) {
  return String(code || '').trim().toUpperCase();
}

/**
 * Validate a coupon code against a cart subtotal.
 * Throws ApiError with a customer-facing message if the coupon
 * cannot be used. Returns the coupon row + computed discount when
 * everything checks out.
 *
 * @param {string} rawCode   the code the customer typed
 * @param {number} subtotal  cart subtotal in naira
 * @param {object} [opts]    { skipCountCheck: true } — used at
 *                           checkout right before incrementing usage
 */
async function validateCoupon(rawCode, subtotal, opts = {}) {
  const code = normaliseCode(rawCode);
  if (!code) throw new ApiError(400, 'Please enter a coupon code.');

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) throw new ApiError(404, 'Invalid coupon code.');

  if (!coupon.isActive) throw new ApiError(400, 'This coupon is no longer active.');

  const now = new Date();
  if (coupon.validFrom && coupon.validFrom > now) {
    throw new ApiError(400, 'This coupon is not valid yet.');
  }
  if (coupon.validUntil && coupon.validUntil < now) {
    throw new ApiError(400, 'This coupon has expired.');
  }

  if (!opts.skipCountCheck && coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    throw new ApiError(400, 'This coupon has reached its usage limit.');
  }

  if (coupon.minOrderAmount > 0 && subtotal < coupon.minOrderAmount) {
    throw new ApiError(
      400,
      `This coupon requires a minimum order of ₦${coupon.minOrderAmount.toLocaleString()}.`
    );
  }

  const discount = computeDiscount(coupon, subtotal);
  if (discount <= 0) throw new ApiError(400, 'This coupon does not apply to your order.');

  return { coupon, discount };
}

/**
 * Compute the discount in naira for a coupon against a subtotal.
 *   PERCENTAGE → value% of subtotal, capped at maxDiscount (if set)
 *   FIXED      → value naira, but never more than the subtotal
 * Never returns a negative discount.
 */
function computeDiscount(coupon, subtotal) {
  const value = Number(coupon.value) || 0;
  let discount = 0;

  if (coupon.type === 'PERCENTAGE') {
    discount = Math.round((subtotal * Math.min(value, 100)) / 100);
    const cap = Number(coupon.maxDiscount) || 0;
    if (cap > 0) discount = Math.min(discount, cap);
  } else {
    // FIXED
    discount = Math.min(value, subtotal);
  }

  return Math.max(0, Math.round(discount));
}

/**
 * Apply a coupon to an order create payload.
 * Validates, computes the discount, and returns the fields to
 * store on the Order row. Does NOT mutate the coupon usage count
 * here — that happens in checkout after the order is created.
 */
async function couponToOrderData(rawCode, subtotal) {
  if (!rawCode) return { couponId: null, couponCode: null, discount: 0 };
  const { coupon, discount } = await validateCoupon(rawCode, subtotal, { skipCountCheck: false });
  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    discount,
  };
}

/**
 * Increment a coupon's usage count by one (called when an order
 * using the coupon is placed). Wrapped in its own try/catch so a
 * race-condition failure here never fails the checkout.
 */
async function incrementCouponUsage(couponId) {
  if (!couponId) return;
  try {
    await prisma.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    });
  } catch (err) {
    console.warn('[coupon] failed to increment usage:', err.message);
  }
}

module.exports = {
  normaliseCode,
  validateCoupon,
  computeDiscount,
  couponToOrderData,
  incrementCouponUsage,
};
