/* ============================================================
   PE_ORIGINALS — js/checkout.js
   Full checkout flow: cart → shipping → payment → confirmation.
   Calls POST /api/orders/checkout. Falls back to a demo
   confirmation if the backend is unreachable (static mode).
   ============================================================ */

(function () {
  "use strict";

  const API = window.PEOAPI;
  const Cart = window.PEO_CART || null;

  function ensureModal() {
    if (document.getElementById("peoCheckoutModal")) return;
    const wrap = document.createElement("div");
    wrap.id = "peoCheckoutModal";
    wrap.className = "auth-modal-overlay";
    wrap.innerHTML = `
      <div class="auth-modal checkout-modal" role="dialog" aria-modal="true" aria-label="Checkout">
        <button class="auth-modal-close" data-co-close aria-label="Close">&times;</button>
        <div id="coBody"></div>
      </div>
    `;
    document.body.appendChild(wrap);
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap || e.target.closest("[data-co-close]")) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  async function open() {
    ensureModal();
    const modal = document.getElementById("peoCheckoutModal");
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
    // Make sure the admin-configured shipping settings have loaded before
    // showing totals, so the modal doesn't briefly show a fallback number.
    if (window.PEO_SETTINGS && typeof window.PEO_SETTINGS.ready === "function") {
      await window.PEO_SETTINGS.ready();
    }
    renderStep("shipping");
  }

  function close() {
    const modal = document.getElementById("peoCheckoutModal");
    if (!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
  }

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
    const items = (Cart && Cart.get ? Cart.get() : []) || [];
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
      `Name: ${order.shipFirstName || ""}\n` +
      `Delivery: ${order.shipAddress || ""}, ${order.shipCity || ""}, ${order.shipState || ""}`;
    const url = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener");
  }

  function renderStep(step) {
    const body = document.getElementById("coBody");
    const items = getCartItems();
    if (!items.length) {
      body.innerHTML = `
        <h3>Your bag is empty</h3>
        <p style="color:var(--ink-500)">Add something beautiful before checking out.</p>
        <button class="btn btn-block" data-co-close>Continue shopping</button>`;
      return;
    }

    const subtotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);
    const shipping = subtotal >= getFreeShipThreshold() ? 0 : getShippingFlat();
    const coupon = renderStep._coupon || null;
    const discount = coupon && coupon.discount ? coupon.discount : 0;
    const total = Math.max(0, subtotal + shipping - discount);

    if (step === "shipping") {
      const loggedIn = API && API.isLoggedIn ? API.isLoggedIn() : false;
      body.innerHTML = `
        <h3>Checkout</h3>
        <p class="co-sub">Step 1 of 2 — where should we send it?</p>
        <div class="co-summary">
          ${items
            .map(
              (i) => `
            <div class="co-line">
              <img src="${i.product.image}" alt="" loading="lazy" />
              <div class="co-line-info">
                <div class="co-line-name">${i.product.name}</div>
                <div class="co-line-meta">${i.product.brand} · Size ${i.size} · Qty ${i.qty}</div>
              </div>
              <div class="co-line-price">${money(i.product.price * i.qty)}</div>
            </div>`
            )
            .join("")}
        </div>
        <form id="coShippingForm">
          <div class="co-grid">
            <label>First name <input name="firstName" required value="${loggedIn ? (window._peoUser && _peoUser.firstName) || "" : ""}" /></label>
            <label>Last name <input name="lastName" required /></label>
          </div>
          <div class="co-grid">
            <label>Email <input type="email" name="email" required /></label>
            <label>Phone <input name="phone" required placeholder="+234…" /></label>
          </div>
          <label>Street address <input name="address" required placeholder="12, Example Street" /></label>
          <div class="co-grid">
            <label>City <input name="city" required /></label>
            <label>State <input name="state" required /></label>
          </div>
          <label>Notes <textarea name="notes" rows="2" placeholder="Optional: landmark, delivery instructions…"></textarea></label>
          <div class="co-totals">
            <div><span>Subtotal</span><span>${money(subtotal)}</span></div>
            ${discount > 0 ? `<div class="co-discount"><span>Discount (${esc(coupon.code)})</span><span>−${money(discount)}</span></div>` : ""}
            <div><span>Shipping</span><span>${shipping === 0 ? "FREE" : money(shipping)}</span></div>
            <div class="co-total"><span>Total</span><span>${money(total)}</span></div>
          </div>
          <div class="co-coupon">
            <input type="text" id="coCouponInput" placeholder="Coupon code (e.g. WELCOME10)" value="${coupon ? esc(coupon.code) : ""}" ${coupon ? "disabled" : ""} />
            <button type="button" class="btn" id="coCouponBtn">${coupon ? "Remove" : "Apply"}</button>
          </div>
          <p class="co-coupon-msg" id="coCouponMsg">${coupon ? `🎉 ${esc(coupon.code)} applied — you save ${money(discount)}` : ""}</p>
          <p class="auth-modal-error" id="coError"></p>
          <button type="submit" class="btn btn-block">Continue to payment</button>
        </form>`;
      body.querySelector("#coShippingForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const f = e.target;
        const err = document.getElementById("coError");
        err.textContent = "";
        const data = {
          firstName: f.firstName.value.trim(),
          lastName: f.lastName.value.trim(),
          email: f.email.value.trim(),
          phone: f.phone.value.trim(),
          address: f.address.value.trim(),
          city: f.city.value.trim(),
          state: f.state.value.trim(),
          notes: f.notes.value.trim(),
          couponCode: (renderStep._coupon && renderStep._coupon.code) || "",
          items: items.map((i) => {
            // Prefer the real server UUID when the backend loaded it
            const serverId =
              (window.PEO_PRODUCT_MAP && window.PEO_PRODUCT_MAP[i.id]) ||
              String(i.id);
            return { productId: serverId, size: i.size, qty: i.qty };
          }),
        };
        if (!data.firstName || !data.lastName || !data.email || !data.phone || !data.address || !data.city || !data.state) {
          err.textContent = "Please fill in all required fields.";
          return;
        }
        renderStep("payment", data, { subtotal, shipping, discount, total, items });
      });

      // ---- Coupon apply / remove ----
      const couponBtn = body.querySelector("#coCouponBtn");
      if (couponBtn) {
        couponBtn.addEventListener("click", async () => {
          const input = body.querySelector("#coCouponInput");
          const msg = body.querySelector("#coCouponMsg");
          const err = body.querySelector("#coError");
          if (renderStep._coupon) {
            renderStep._coupon = null;
            renderStep("shipping");
            return;
          }
          const code = (input.value || "").trim();
          if (!code) { msg.textContent = "Enter a coupon code."; return; }
          couponBtn.disabled = true;
          msg.textContent = "Checking…";
          try {
            if (!API || !API.validateCoupon) throw new Error("Cannot reach the server. Coupons unavailable.");
            const result = await API.validateCoupon(code, subtotal);
            if (!result || !result.valid) throw new Error("This coupon cannot be applied.");
            renderStep._coupon = { code: result.code, discount: result.discount };
            msg.textContent = `🎉 ${result.code} applied — you save ${money(result.discount)}`;
          } catch (ex) {
            msg.textContent = "";
            err.textContent = ex.message || "Invalid coupon code.";
          } finally {
            renderStep("shipping");
          }
        });
      }
    } else if (step === "payment") {
      const data = arguments[1];
      const totals = arguments[2];
      const store = window.PEO_STORE || {};
      const bank = store.bank || {};
      body.innerHTML = `
        <h3>Payment</h3>
        <p class="co-sub">Step 2 of 2</p>
        <div class="co-totals">
          <div><span>Subtotal</span><span>${money(totals.subtotal)}</span></div>
          ${totals.discount > 0 ? `<div class="co-discount"><span>Discount</span><span>−${money(totals.discount)}</span></div>` : ""}
          <div><span>Shipping</span><span>${totals.shipping === 0 ? "FREE" : money(totals.shipping)}</span></div>
          <div class="co-total"><span>Total</span><span>${money(totals.total)}</span></div>
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
          <p class="co-note">After you place the order, send your payment receipt to WhatsApp so we can confirm and start packing.</p>
        </div>
        <div id="coPayDetail-WHATSAPP" class="co-pay-detail" style="display:none">
          <p class="co-sub">We'll open WhatsApp with your order details filled in — just hit send.</p>
        </div>
        <div id="coPayDetail-CARD" class="co-pay-detail" style="display:none">
          <p class="co-sub">🔒 You'll be redirected to Paystack's secure checkout to pay by card.</p>
        </div>

        <p class="auth-modal-error" id="coPayError"></p>
        <div class="co-actions">
          <button class="btn" id="coBack">← Back</button>
          <button class="btn btn-block" id="coPlace">Place order</button>
        </div>`;

      function syncPayDetail() {
        const val = (body.querySelector('input[name="pay"]:checked') || {}).value || "TRANSFER";
        ["TRANSFER", "WHATSAPP", "CARD"].forEach((k) => {
          const el = document.getElementById("coPayDetail-" + k);
          if (el) el.style.display = k === val ? "" : "none";
        });
        document.getElementById("coPlace").textContent =
          val === "WHATSAPP" ? "Place order & open WhatsApp" : val === "CARD" ? "Continue to card payment" : "Place order";
      }
      body.querySelectorAll('input[name="pay"]').forEach((r) => r.addEventListener("change", syncPayDetail));
      syncPayDetail();

      const back = document.getElementById("coBack");
      back.addEventListener("click", () => renderStep("shipping"));
      const place = document.getElementById("coPlace");
      place.addEventListener("click", async () => {
        const pay = body.querySelector('input[name="pay"]:checked');
        const method = pay ? pay.value : "TRANSFER";
        const err = document.getElementById("coPayError");
        err.textContent = "";
        place.disabled = true;
        place.textContent = "Placing order…";
        try {
          if (!API || !API.checkout) throw new Error("Cannot reach the server. Please try again later.");
          const payload = Object.assign({}, data, { paymentMethod: method });
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
                place.disabled = false;
                place.textContent = "Confirming payment…";
                const verified = await API.verifyPaystackPayment(tx.reference || payInit.reference);
                if (Cart && Cart.save) Cart.save([]);
                if (window.Cart && window.Cart.renderDrawer) window.Cart.renderDrawer();
                renderConfirm(verified.order);
              },
              onCancel: () => {
                place.disabled = false;
                place.textContent = "Continue to card payment";
                err.textContent = "Payment cancelled. Your order is saved — you can retry anytime.";
              },
            });
            return;
          }

          if (Cart && Cart.save) Cart.save([]);
          if (window.Cart && window.Cart.renderDrawer) window.Cart.renderDrawer();
          renderConfirm(result.order);
          if (method === "WHATSAPP") openWhatsAppOrder(result.order);
        } catch (ex) {
          err.textContent = ex.message || "Could not place order.";
          place.disabled = false;
          place.textContent = "Place order";
        }
      });
    }
  }

  function renderConfirm(order) {
    const body = document.getElementById("coBody");
    const store = window.PEO_STORE || {};
    const bank = store.bank || {};
    const items = (order.items || []).map(
      (i) =>
        `<div class="co-line"><div class="co-line-info"><div class="co-line-name">${esc(i.name)} · ${esc(i.size)}</div></div><div class="co-line-price">×${i.qty}</div></div>`
    ).join("");

    let paymentNote = "";
    if (order.paymentMethod === "TRANSFER") {
      paymentNote = `
        <div class="co-bank-box">
          <div><span>Bank</span><strong>${esc(bank.bankName || "")}</strong></div>
          <div><span>Account number</span><strong>${esc(bank.accountNumber || "")}</strong></div>
          <div><span>Account name</span><strong>${esc(bank.accountName || "")}</strong></div>
        </div>
        <p style="color:var(--ink-500);font-size:13px;text-align:center">
          Please transfer <strong>${money(order.total)}</strong> and send your receipt on WhatsApp so we can confirm and start packing.
        </p>
        <button class="btn btn-block" id="coWaReceipt" style="margin-bottom:10px">💬 Send receipt on WhatsApp</button>`;
    } else if (order.paymentMethod === "WHATSAPP") {
      paymentNote = `
        <p style="color:var(--ink-500);font-size:13px;text-align:center">
          We've opened WhatsApp for you — didn't pop up? Tap below.
        </p>
        <button class="btn btn-block" id="coWaReceipt" style="margin-bottom:10px">💬 Message us on WhatsApp</button>`;
    }

    body.innerHTML = `
      <div style="text-align:center;padding:10px 0 4px">
        <div style="font-size:46px">💗</div>
        <h3>Order confirmed!</h3>
        <p class="co-sub">Order <strong>${esc(order.orderNumber)}</strong> · Total ${money(order.total)}</p>
      </div>
      ${items ? `<div class="co-summary">${items}</div>` : ""}
      ${paymentNote}
      <p style="color:var(--ink-500);font-size:13px;text-align:center">
        A confirmation email is on its way to ${esc(order.shipEmail || "your inbox")}.
        We'll notify you the moment it ships.
      </p>
      <button class="btn btn-block" data-co-close>Continue shopping</button>`;

    const waBtn = document.getElementById("coWaReceipt");
    if (waBtn) waBtn.addEventListener("click", () => openWhatsAppOrder(order));
  }

  // ---- Wire the checkout buttons ----
  function init() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-checkout]");
      if (btn) {
        e.preventDefault();
        open();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.PEOCheckout = { open, close };
})();