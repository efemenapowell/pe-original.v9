// ============================================================
// services/paystackService.js
//   Thin wrapper around the Paystack Transactions API.
//   Docs: https://paystack.com/docs/api/transaction/
//   Uses the "Standard" (redirect) flow — we initialize on the
//   server, send the customer to Paystack's hosted page via
//   authorization_url, then verify the reference when they land
//   back on our callback URL. No card details ever touch our
//   server, and no extra CSP/script changes are needed on the
//   frontend since it's a full redirect, not an embedded widget.
// ============================================================
const config = require('../config');
const { ApiError } = require('../middleware/errorHandler');

const PAYSTACK_BASE = 'https://api.paystack.co';

async function paystackFetch(path, options = {}) {
  if (!config.paystack.secretKey) {
    throw new ApiError(503, 'Card payments are not configured yet — missing PAYSTACK_SECRET_KEY.');
  }
  const res = await fetch(PAYSTACK_BASE + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.paystack.secretKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === false) {
    throw new ApiError(res.status >= 400 ? res.status : 502, data.message || 'Paystack request failed');
  }
  return data;
}

/**
 * Starts a transaction. amountNaira is the order total in naira
 * (Paystack expects the smallest unit — kobo — so we multiply by 100).
 * Returns { authorization_url, access_code, reference }.
 */
async function initializeTransaction({ email, amountNaira, reference, callbackUrl, metadata }) {
  const data = await paystackFetch('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email,
      amount: Math.round(amountNaira * 100),
      reference,
      callback_url: callbackUrl,
      currency: 'NGN',
      metadata,
    }),
  });
  return data.data; // { authorization_url, access_code, reference }
}

/** Verifies a transaction by reference. Returns Paystack's transaction object. */
async function verifyTransaction(reference) {
  const data = await paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
  });
  return data.data; // { status: 'success'|'failed'|..., amount, reference, ... }
}

module.exports = { initializeTransaction, verifyTransaction };
