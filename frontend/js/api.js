/* ============================================================
   PE_ORIGINALS — js/api.js
   API client: auth (login/signup/forgot/reset), products from
   backend, checkout. Designed to WORK WITHOUT a backend too:
   every call falls back gracefully to the local products.js
   data so the static site never breaks.
   ============================================================ */

(function () {
  "use strict";

  // Backend base URL: same origin when served by Express, or set
  // window.PEO_API_URL before this file loads for a separate API.
  const BASE = window.PEO_API_URL || "";

  const ACCESS_KEY = "peo_access";
  const REFRESH_KEY = "peo_refresh";

  const API = {
    BASE,
    ACCESS_KEY,
    REFRESH_KEY,

    /* ---- token helpers ---- */
    getAccess() {
      return localStorage.getItem(ACCESS_KEY) || "";
    },
    getRefresh() {
      return localStorage.getItem(REFRESH_KEY) || "";
    },
    isLoggedIn() {
      return !!this.getAccess();
    },
    saveTokens(access, refresh) {
      localStorage.setItem(ACCESS_KEY, access);
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    },
    clearTokens() {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    },

    /* ---- core request ---- */
    async request(method, path, body) {
      const headers = {};
      const access = this.getAccess();
      if (access) headers.Authorization = "Bearer " + access;
      if (body !== undefined) headers["Content-Type"] = "application/json";

      let res;
      try {
        res = await fetch(BASE + path, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      } catch (err) {
        const e = new Error("Cannot reach the server. Please try again later.");
        e.network = true;
        throw e;
      }

      // Try one silent refresh on 401 (skip auth endpoints)
      if (res.status === 401 && this.getRefresh() && !path.includes("/auth/")) {
        const ok = await this.refresh();
        if (ok) return this.request(method, path, body);
        this.clearTokens();
        throw new Error("Your session has expired. Please sign in again.");
      }

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          (data && data.error && data.error.message) ||
          "Request failed (" + res.status + ")";
        throw new Error(msg);
      }
      return data ? data.data : null;
    },

    async refresh() {
      try {
        const res = await fetch(BASE + "/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: this.getRefresh() }),
        });
        const data = await res.json();
        if (!res.ok || !data.data) return false;
        this.saveTokens(data.data.accessToken, data.data.refreshToken);
        return true;
      } catch {
        return false;
      }
    },

    /* ---- auth ---- */
    register(payload) {
      return this.request("POST", "/api/auth/register", payload);
    },
    login(email, password) {
      return this.request("POST", "/api/auth/login", { email, password });
    },
    forgotPassword(email) {
      return this.request("POST", "/api/auth/forgot-password", { email });
    },
    resetPassword(token, password) {
      return this.request("POST", "/api/auth/reset-password", { token, password });
    },
    me() {
      return this.request("GET", "/api/auth/me");
    },
    updateProfile(payload) {
      return this.request("PATCH", "/api/auth/profile", payload);
    },
    logout() {
      this.clearTokens();
    },

    /* ---- products ---- */
    async getProducts(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request("GET", "/api/products" + (qs ? "?" + qs : ""));
    },
    getProduct(idOrSlug) {
      return this.request("GET", "/api/products/" + idOrSlug);
    },
    getFeatured() {
      return this.request("GET", "/api/products/featured");
    },
    getCategories() {
      return this.request("GET", "/api/categories");
    },
    getContent() {
      return this.request("GET", "/api/content");
    },

    /* ---- cart (server-side, logged-in users) ---- */
    getServerCart() {
      return this.request("GET", "/api/cart");
    },
    addServerCartItem(payload) {
      return this.request("POST", "/api/cart/items", payload);
    },

    /* ---- orders / checkout ---- */
    checkout(payload) {
      return this.request("POST", "/api/orders/checkout", payload);
    },
    verifyPayment(reference) {
      return this.request("GET", "/api/orders/verify/" + encodeURIComponent(reference));
    },
    myOrders() {
      return this.request("GET", "/api/orders");
    },

    /* ---- payments (Paystack) ---- */
    initializePayment(payload) {
      return this.request("POST", "/api/payments/initialize", payload);
    },
    verifyPaystackPayment(reference) {
      return this.request("GET", "/api/payments/verify/" + encodeURIComponent(reference));
    },

    /* ---- coupons ---- */
    validateCoupon(code, subtotal) {
      return this.request("POST", "/api/coupons/validate", { code, subtotal });
    },
  };

  window.PEOAPI = API;
})();