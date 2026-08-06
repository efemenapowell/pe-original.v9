/* ============================================================
   PE_ORIGINALS — js/checkout-page.js
   Full-page checkout: order summary → shipping form → payment
   (demo) → order confirmation. Calls POST /api/orders/checkout.
   Falls back to a demo confirmation when the backend is down.
   ============================================================ */
(function () {
  "use strict";

  const API = window.PEOAPI;

  // Admin-editable (Settings → Shipping in the admin panel), loaded by
  // js/settings.js. Read live so an admin change takes effect without a
  // deploy — falls back to a sane default until settings.js resolves.
  function getShippingFlat() {
    return (window.PEO_SETTINGS && window.PEO_SETTINGS.shipping.flatShipRate) || 5000;
  }
  function getFreeShipThreshold() {
    return (window.PEO_SETTINGS && window.PEO_SETTINGS.shipping.freeShipThreshold) || 550000;
  }

  function getCartItems() {
    const items = (window.PEO_CART && PEO_CART.get ? PEO_CART.get() : []) || [];
    return items
      .map((i) => {
        const p = window.getProductById ? getProductById(i.id) : null;
        return p ? { id: i.id, size: i.size, qty: i.qty, product: p } : null;
      })
      .filter(Boolean);
  }

  function money(n) {
    return "₦" + Number(n || 0).toLocaleString("en-NG");
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function openWhatsAppOrder(order) {
    const store = window.PEO_STORE || {};
    const num = (store.whatsappNumber || "").replace(/[^\d]/g, "");
    const lines = (order.items || []).map((i) => `• ${i.name} (${i.size}) x${i.qty}`).join("\n");
    const msg =
      `Hi PE_ORIGINALS! I just placed order ${order.orderNumber}.\n\n` +
      (lines ? lines + "\n\n" : "") +
      `Total: ${money(order.total)}\n` +
      `Name: ${order.shipFirstName || ""} ${order.shipLastName || ""}\n` +
      `Delivery: ${order.shipAddress || ""}, ${order.shipCity || ""}, ${order.shipState || ""}`;
    const url = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener");
  }

  const state = { step: "shipping", data: null, totals: null, verifying: false, coupon: null };

  // ---- Coupon helpers ----
  async function applyCoupon(code, subtotal) {
    if (!API || !API.validateCoupon) {
      throw new Error("Cannot reach the server. Coupons are unavailable right now.");
    }
    const result = await API.validateCoupon(code, subtotal);
    if (!result || !result.valid) throw new Error("This coupon cannot be applied.");
    return result;
  }

  function computeTotals(subtotal, coupon) {
    const shipping = subtotal >= getFreeShipThreshold() ? 0 : getShippingFlat();
    const discount = coupon && coupon.discount ? coupon.discount : 0;
    return { subtotal, shipping, discount, total: Math.max(0, subtotal + shipping - discount) };
  }

  function render() {
    const root = document.getElementById("coPageRoot");
    if (!root) return;
    const items = getCartItems();
    const totals = state.totals;

    if (!items.length && state.step !== "confirm") {
      root.innerHTML = `
        <div class="card co-empty">
          <div style="font-size:44px">🛍️</div>
          <h3>Your bag is empty</h3>
          <p>Add something beautiful before checking out.</p>
          <a href="shop.html" class="btn btn-pink">Shop the collection</a>
        </div>`;
      return;
    }

    if (state.step === "shipping") {
      const subtotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);
      state.totals = computeTotals(subtotal, state.coupon);
      const loggedIn = API && API.isLoggedIn ? API.isLoggedIn() : false;
      const user = window._peoUser || {};

      root.innerHTML = `
        <div class="co-layout">
          <div class="card co-summary-card">
            <h3>Your order</h3>
            ${items
              .map(
                (i) => `
              <div class="co-line">
                <img src="${esc(i.product.image)}" alt="" loading="lazy" />
                <div class="co-line-info">
                  <div class="co-line-name">${esc(i.product.name)}</div>
                  <div class="co-line-meta">${esc(i.product.brand)} · Size ${esc(i.size)} · Qty ${i.qty}</div>
                  <div class="co-line-price">${money(i.product.price * i.qty)}</div>
                </div>
              </div>`
              )
              .join("")}
            <div class="co-coupon">
              <input type="text" id="coCouponInput" placeholder="Coupon code (e.g. WELCOME10)" value="${esc(state.coupon?.code || "")}" ${state.coupon ? "disabled" : ""} />
              <button type="button" class="btn" id="coCouponBtn">${state.coupon ? "Remove" : "Apply"}</button>
            </div>
            <p class="co-coupon-msg" id="coCouponMsg">${state.coupon ? `🎉 ${esc(state.coupon.code)} applied — you save ${money(state.totals.discount)}` : ""}</p>
            <div class="co-totals">
              <div><span>Subtotal</span><span>${money(state.totals.subtotal)}</span></div>
              ${state.totals.discount > 0 ? `<div class="co-discount"><span>Discount (${esc(state.coupon?.code || "")})</span><span>−${money(state.totals.discount)}</span></div>` : ""}
              <div><span>Shipping</span><span>${state.totals.shipping === 0 ? "FREE" : money(state.totals.shipping)}</span></div>
              <div class="co-total"><span>Total</span><span>${money(state.totals.total)}</span></div>
            </div>
          </div>

          <div class="card co-form-card">
            <h3>Shipping details</h3>
            <form id="coForm">
              <div class="co-grid">
                <label>First name *<input name="firstName" required value="${esc(user.firstName || "")}" /></label>
                <label>Last name *<input name="lastName" required value="${esc(user.lastName || "")}" /></label>
              </div>
              <div class="co-grid">
                <label>Email *<input type="email" name="email" required value="${esc(user.email || "")}" /></label>
                <label>Phone *<input name="phone" required placeholder="+234…" /></label>
              </div>
              <label>Street address *<input name="address" required placeholder="12, Example Street" /></label>
              <div class="co-grid">
                <label>City *<input name="city" required /></label>
                <label>State *<input name="state" required /></label>
              </div>
              <label>Notes <textarea name="notes" rows="2" placeholder="Optional: landmark, delivery instructions…"></textarea></label>
              <p class="auth-modal-error" id="coErr"></p>
              <button type="submit" class="btn btn-pink btn-block">Continue to payment →</button>
            </form>
          </div>
        </div>`;

      document.getElementById("coForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const f = e.target;
        const err = document.getElementById("coErr");
        const d = {
          firstName: f.firstName.value.trim(),
          lastName: f.lastName.value.trim(),
          email: f.email.value.trim(),
          phone: f.phone.value.trim(),
          address: f.address.value.trim(),
          city: f.city.value.trim(),
          state: f.state.value.trim(),
          notes: f.notes.value.trim(),
          couponCode: state.coupon ? state.coupon.code : "",
          items: items.map((i) => ({
            productId: (window.PEO_PRODUCT_MAP && window.PEO_PRODUCT_MAP[i.id]) || String(i.id),
            size: i.size,
            qty: i.qty,
          })),
        };
        if (!d.firstName || !d.lastName || !d.email || !d.phone || !d.address || !d.city || !d.state) {
          err.textContent = "Please fill in all required fields.";
          return;
        }
        state.data = d;
        state.step = "payment";
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });

      // ---- Coupon apply / remove ----
      const couponBtn = document.getElementById("coCouponBtn");
      if (couponBtn) {
        couponBtn.addEventListener("click", async () => {
          const input = document.getElementById("coCouponInput");
          const msg = document.getElementById("coCouponMsg");
          if (state.coupon) {
            // Remove
            state.coupon = null;
            render();
            return;
          }
          const code = (input.value || "").trim();
          if (!code) { msg.textContent = "Enter a coupon code."; return; }
          couponBtn.disabled = true;
          msg.textContent = "Checking…";
          try {
            const result = await applyCoupon(code, state.totals.subtotal);
            state.coupon = { code: result.code, discount: result.discount };
            msg.textContent = `🎉 ${result.code} applied — you save ${money(result.discount)}`;
          } catch (ex) {
            msg.textContent = ex.message || "Invalid coupon code.";
          } finally {
            couponBtn.disabled = false;
            render();
          }
        });
      }
      return;
    }

    if (state.step === "payment") {
      const t = state.totals;
      const store = window.PEO_STORE || {};
      const bank = store.bank || {};
      root.innerHTML = `
        <div class="card co-pay-card">
          <h3>Payment</h3>
          <div class="co-totals">
            <div><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
            ${t.discount > 0 ? `<div class="co-discount"><span>Discount</span><span>−${money(t.discount)}</span></div>` : ""}
            <div><span>Shipping</span><span>${t.shipping === 0 ? "FREE" : money(t.shipping)}</span></div>
            <div class="co-total"><span>Total</span><span>${money(t.total)}</span></div>
          </div>
          <div class="co-pay-methods">
            <label class="co-pay"><input type="radio" name="pay" value="TRANSFER" checked /><span>🏦 Bank transfer</span></label>
            <label class="co-pay"><input type="radio" name="pay" value="WHATSAPP" /><span>💬 Order on WhatsApp</span></label>
            <label class="co-pay"><input type="radio" name="pay" value="CARD" /><span>💳 Card (Visa / Verve / Mastercard)</span></label>
          </div>

          <div id="coPayDetail-TRANSFER" class="co-pay-detail">
            <p class="co-sub">Transfer the total above to:</p>
            <div class="co-bank-box">
              <div><span>Bank</span><strong>${esc(bank.bankName || "")}</strong></div>
              <div><span>Account number</span><strong>${esc(bank.accountNumber || "")}</strong></div>
              <div><span>Account name</span><strong>${esc(bank.accountName || "")}</strong></div>
            </div>
            <p class="co-note">After you place the order, send your payment receipt to WhatsApp so we can confirm and start packing. We'll email you once it's confirmed.</p>
          </div>

          <div id="coPayDetail-WHATSAPP" class="co-pay-detail" style="display:none">
            <p class="co-sub">We'll open WhatsApp with your order details filled in — just hit send and we'll sort out payment and delivery with you directly.</p>
          </div>

          <div id="coPayDetail-CARD" class="co-pay-detail" style="display:none">
            <p class="co-sub">🔒 You'll be redirected to Paystack's secure checkout to pay by card.</p>
          </div>

          <p class="auth-modal-error" id="coPayErr"></p>
          <div class="co-actions">
            <button class="btn" id="coBack">← Back</button>
            <button class="btn btn-pink" id="coPlace">Place order</button>
          </div>
        </div>`;

      function syncPayDetail() {
        const val = (document.querySelector('input[name="pay"]:checked') || {}).value || "TRANSFER";
        ["TRANSFER", "WHATSAPP", "CARD"].forEach((k) => {
          const el = document.getElementById("coPayDetail-" + k);
          if (el) el.style.display = k === val ? "" : "none";
        });
        document.getElementById("coPlace").textContent =
          val === "WHATSAPP" ? "Place order & open WhatsApp" : val === "CARD" ? "Continue to card payment" : "Place order";
      }
      document.querySelectorAll('input[name="pay"]').forEach((r) => r.addEventListener("change", syncPayDetail));
      syncPayDetail();

      document.getElementById("coBack").addEventListener("click", () => {
        state.step = "shipping";
        render();
      });
      document.getElementById("coPlace").addEventListener("click", async () => {
        const pay = document.querySelector('input[name="pay"]:checked');
        const method = pay ? pay.value : "TRANSFER";
        const err = document.getElementById("coPayErr");
        const btn = document.getElementById("coPlace");
        err.textContent = "";
        btn.disabled = true;
        btn.textContent = "Placing order…";
        try {
          if (!API || !API.checkout) throw new Error("Cannot reach the server. Please try again later.");
          const payload = Object.assign({}, state.data, { paymentMethod: method });
          const result = await API.checkout(payload);

          if (method === "CARD") {
            // Paystack Inline popup — pay without leaving the page.
            // Falls back to a full redirect if the SDK is unavailable.
            if (!window.PeoPaystack) {
              if (!result.authorizationUrl) throw new Error("Could not start card payment. Please try again.");
              window.location.href = result.authorizationUrl;
              return;
            }
            const payInit = await API.initializePayment({ orderId: result.order.id, email: result.order.shipEmail });
            if (!payInit || !payInit.publicKey) throw new Error("Card payments are not configured yet. Please use bank transfer.");
            await window.PeoPaystack.popup({
              key: payInit.publicKey,
              email: result.order.shipEmail,
              amount: result.order.total,
              reference: payInit.reference,
              metadata: { orderId: result.order.id, orderNumber: result.order.orderNumber },
              onSuccess: async (tx) => {
                btn.disabled = false;
                btn.textContent = "Confirming payment…";
                const verified = await API.verifyPaystackPayment(tx.reference || payInit.reference);
                state.step = "confirm";
                state.order = verified.order;
                if (window.PEO_CART && PEO_CART.save) PEO_CART.save([]);
                if (window.PEO_CART && PEO_CART.renderDrawer) PEO_CART.renderDrawer();
                render();
                window.scrollTo({ top: 0, behavior: "smooth" });
              },
              onCancel: () => {
                btn.disabled = false;
                btn.textContent = "Continue to card payment";
                err.textContent = "Payment cancelled. Your order is saved — you can retry anytime.";
              },
            });
            return;
          }

          if (window.PEO_CART && PEO_CART.save) PEO_CART.save([]);
          if (window.PEO_CART && PEO_CART.renderDrawer) PEO_CART.renderDrawer();
          state.step = "confirm";
          state.order = result.order;
          render();
          window.scrollTo({ top: 0, behavior: "smooth" });

          if (method === "WHATSAPP") {
            openWhatsAppOrder(result.order);
          }
        } catch (ex) {
          err.textContent = ex.message || "Could not place order.";
          btn.disabled = false;
          btn.textContent = "Place order";
        }
      });
      return;
    }

    // confirm
    const o = state.order || {};
    const store = window.PEO_STORE || {};
    const bank = store.bank || {};
    const itemsHtml = (o.items || [])
      .map(
        (i) => `
        <div class="co-line"><div class="co-line-info">
          <div class="co-line-name">${esc(i.name)} · ${esc(i.size)}</div>
        </div><div class="co-line-price">×${i.qty}</div></div>`
      )
      .join("");

    let paymentNote = "";
    if (state.verifying) {
      paymentNote = `<p style="text-align:center">Confirming your payment…</p>`;
    } else if (o.paymentMethod === "CARD") {
      paymentNote =
        o.paymentStatus === "PAID" || o.status === "PAID"
          ? `<p style="color:var(--ink-500);font-size:13.5px;text-align:center">Payment received — thank you! 🎉</p>`
          : `<p class="auth-modal-error" style="text-align:center">We couldn't confirm this payment. If you were charged, message us on WhatsApp with your order number.</p>`;
    } else if (o.paymentMethod === "TRANSFER") {
      paymentNote = `
        <div class="co-bank-box">
          <div><span>Bank</span><strong>${esc(bank.bankName || "")}</strong></div>
          <div><span>Account number</span><strong>${esc(bank.accountNumber || "")}</strong></div>
          <div><span>Account name</span><strong>${esc(bank.accountName || "")}</strong></div>
        </div>
        <p style="color:var(--ink-500);font-size:13.5px;text-align:center">
          Please transfer <strong>${money(o.total)}</strong> and send your receipt on WhatsApp so we can confirm and start packing.
        </p>
        <div class="co-actions" style="justify-content:center">
          <button class="btn btn-pink" id="coWaReceipt">💬 Send receipt on WhatsApp</button>
        </div>`;
    } else if (o.paymentMethod === "WHATSAPP") {
      paymentNote = `
        <p style="color:var(--ink-500);font-size:13.5px;text-align:center">
          We've opened WhatsApp for you — didn't pop up? Tap below.
        </p>
        <div class="co-actions" style="justify-content:center">
          <button class="btn btn-pink" id="coWaReceipt">💬 Message us on WhatsApp</button>
        </div>`;
    }

    root.innerHTML = `
      <div class="card co-confirm">
        <div style="font-size:48px">💗</div>
        <h2>Order ${state.verifying ? "received" : "confirmed"}!</h2>
        <p class="co-sub">Order <strong>${esc(o.orderNumber)}</strong> · Total ${money(o.total)}</p>
        ${itemsHtml ? `<div class="co-summary">${itemsHtml}</div>` : ""}
        ${paymentNote}
        <p style="color:var(--ink-500);font-size:13.5px;text-align:center">
          A confirmation email is on its way to ${esc(o.shipEmail || "your inbox")}.
          We'll notify you the moment your order ships.
        </p>
        <div class="co-actions" style="justify-content:center">
          <a href="shop.html" class="btn btn-pink">Continue shopping</a>
          ${API && API.isLoggedIn() ? '<a href="account.html" class="btn">View my orders</a>' : ""}
        </div>
      </div>`;

    const waBtn = document.getElementById("coWaReceipt");
    if (waBtn) waBtn.addEventListener("click", () => openWhatsAppOrder(o));
  }

  // Re-render when the cart changes
  document.addEventListener("peo:cart", render);
  document.addEventListener("peo:products", render);
  document.addEventListener("peo:settings-ready", render);

  /** Handles the redirect back from Paystack's hosted checkout page. */
  async function handlePaystackCallback() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("paystack_callback")) return false;
    const reference = params.get("reference") || params.get("trxref");
    // Strip the query string so a page refresh doesn't re-verify.
    window.history.replaceState({}, "", window.location.pathname);
    if (!reference || !API || !API.verifyPayment) return false;

    state.step = "confirm";
    state.verifying = true;
    state.order = { orderNumber: reference };
    render();

    try {
      const result = await API.verifyPayment(reference);
      state.order = result.order;
      if (window.PEO_CART && PEO_CART.save) PEO_CART.save([]);
      if (window.PEO_CART && PEO_CART.renderDrawer) PEO_CART.renderDrawer();
    } catch (ex) {
      console.warn("[checkout] payment verification failed:", ex.message);
    } finally {
      state.verifying = false;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return true;
  }

  async function init() {
    // Make sure the admin-configured shipping settings have loaded before
    // the first render, so totals don't briefly show a fallback number.
    if (window.PEO_SETTINGS && typeof window.PEO_SETTINGS.ready === "function") {
      await window.PEO_SETTINGS.ready();
    }
    const handled = await handlePaystackCallback();
    if (!handled) render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.PEOCheckoutPage = { render };
})();