/* ============================================================
   PE_ORIGINALS — js/account.js
   Account page logic: order history, profile, sign out.
   Requires login — shows a friendly prompt otherwise.
   ============================================================ */
(function () {
  "use strict";

  const API = window.PEOAPI;
  const root = () => document.getElementById("acctRoot");
  const greet = () => document.getElementById("acctGreeting");

  function money(n) {
    return "₦" + Number(n || 0).toLocaleString("en-NG");
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function statusPill(status) {
    return `<span class="oc-status status-${esc(status)}">${esc(status)}</span>`;
  }

  async function renderOrders() {
    const el = root();
    el.innerHTML = '<p style="text-align:center;color:var(--ink-500)">Loading your orders…</p>';
    try {
      const orders = await API.myOrders();
      if (!orders.length) {
        el.innerHTML = `
          <div class="card" style="padding:40px;text-align:center">
            <div style="font-size:40px">🛍️</div>
            <h3 style="margin:10px 0 4px">No orders yet</h3>
            <p style="color:var(--ink-500);margin-bottom:16px">Your beautiful pieces are waiting.</p>
            <a href="shop.html" class="btn btn-pink">Shop the collection</a>
          </div>`;
        return;
      }
      el.innerHTML = `<div class="orders-list">${orders
        .map(
          (o) => `
        <div class="order-card">
          <div class="oc-head">
            <span class="oc-num">${esc(o.orderNumber)}</span>
            ${statusPill(o.status)}
          </div>
          <div class="oc-items">
            ${o.items
              .map((i) => `${esc(i.name)} (${esc(i.size)}) × ${i.qty}`)
              .join(" · ")}
          </div>
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <span style="color:var(--ink-500);font-size:13px">${new Date(o.createdAt).toLocaleString()}</span>
            <span class="oc-total">${money(o.total)}</span>
          </div>
        </div>`
        )
        .join("")}</div>`;
    } catch (err) {
      el.innerHTML = `<p style="text-align:center;color:var(--danger,#c0392b)">${esc(err.message)}</p>`;
    }
  }

  function renderProfile(user) {
    const el = root();
    el.innerHTML = `
      <form class="profile-form card" style="padding:24px" id="profileForm">
        <h3>Your details</h3>
        <label>First name <input name="firstName" value="${esc(user.firstName || "")}" /></label>
        <label>Last name <input name="lastName" value="${esc(user.lastName || "")}" /></label>
        <label>Phone <input name="phone" value="${esc(user.phone || "")}" /></label>
        <p class="auth-modal-error" id="profErr"></p>
        <button type="submit" class="btn btn-pink">Save changes</button>
      </form>`;
    document.getElementById("profileForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const err = document.getElementById("profErr");
      err.textContent = "";
      try {
        const res = await API.updateProfile({
          firstName: f.firstName.value.trim(),
          lastName: f.lastName.value.trim(),
          phone: f.phone.value.trim(),
        });
        const u = res.user || res;
        window._peoUser = u;
        greet().textContent = `Welcome back, ${u.firstName || "lovely"}`;
        err.style.color = "var(--ok,#2e8b57)";
        err.textContent = "Profile updated ✨";
        setTimeout(() => (err.textContent = ""), 2500);
      } catch (ex) {
        err.textContent = ex.message || "Could not update profile.";
      }
    });
  }

  function renderPanel(panel, user) {
    const el = root();
    el.innerHTML = `
      <div class="account-layout">
        <nav class="account-nav">
          <button data-panel="orders" class="${panel === "orders" ? "active" : ""}">📦 My orders</button>
          <button data-panel="profile" class="${panel === "profile" ? "active" : ""}">👤 Profile</button>
          <button data-panel="logout">🚪 Sign out</button>
        </nav>
        <div class="account-panel" id="acctPanel"></div>
      </div>`;
    el.querySelectorAll(".account-nav button").forEach((b) => {
      b.addEventListener("click", () => {
        if (b.dataset.panel === "logout") {
          API.logout();
          window.dispatchEvent(new CustomEvent("peo:auth", { detail: { user: null } }));
          renderAuthRequired();
          return;
        }
        renderPanel(b.dataset.panel, user);
      });
    });
    const panelEl = document.getElementById("acctPanel");
    if (panel === "orders") {
      panelEl.innerHTML = '<h3 style="margin-bottom:14px">Order history</h3>';
      // Fetch orders into this panel
      API.myOrders()
        .then((orders) => {
          if (!orders.length) {
            panelEl.innerHTML = `
              <div class="card" style="padding:30px;text-align:center">
                <div style="font-size:36px">🛍️</div>
                <h3 style="margin:8px 0">No orders yet</h3>
                <p style="color:var(--ink-500);margin-bottom:14px">Your beautiful pieces are waiting.</p>
                <a href="shop.html" class="btn btn-pink">Shop the collection</a>
              </div>`;
            return;
          }
          panelEl.innerHTML = `<div class="orders-list">${orders
            .map(
              (o) => `
            <div class="order-card">
              <div class="oc-head">
                <span class="oc-num">${esc(o.orderNumber)}</span>
                ${statusPill(o.status)}
              </div>
              <div class="oc-items">${o.items
                .map((i) => `${esc(i.name)} (${esc(i.size)}) × ${i.qty}`)
                .join(" · ")}</div>
              <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
                <span style="color:var(--ink-500);font-size:13px">${new Date(o.createdAt).toLocaleString()}</span>
                <span class="oc-total">${money(o.total)}</span>
              </div>
            </div>`
            )
            .join("")}</div>`;
        })
        .catch((err) => {
          panelEl.innerHTML = `<p style="color:var(--danger,#c0392b)">${esc(err.message)}</p>`;
        });
    } else {
      renderProfile(user);
    }
  }

  function renderAuthRequired() {
    greet().textContent = "Welcome back";
    root().innerHTML = `
      <div class="auth-required">
        <div class="icon">💗</div>
        <h2>Sign in to see your account</h2>
        <p style="color:var(--ink-500);margin:8px 0 18px">View your orders, save your details, and check out faster.</p>
        <button class="btn btn-pink" data-open-auth>Sign in / Create account</button>
      </div>`;
  }

  async function init() {
    if (!API || !API.isLoggedIn()) {
      renderAuthRequired();
      return;
    }
    try {
      const me = await API.me();
      const user = me.user || me;
      window._peoUser = user;
      greet().textContent = `Welcome back, ${user.firstName || user.email || "lovely"} 💕`;
      renderPanel("orders", user);
    } catch {
      API.logout();
      renderAuthRequired();
    }
  }

  document.addEventListener("peo:auth", (e) => {
    if (e.detail && e.detail.user) init();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
