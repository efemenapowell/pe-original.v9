/* ============================================================
   PE_ORIGINALS — js/settings.js
   Site-wide settings that the admin can change from the admin
   panel (Settings → Shipping), stored as ContentBlock rows and
   served via GET /api/content:
     shipping.freeThreshold — order subtotal (₦) that unlocks
                               free shipping
     shipping.flatRate      — flat shipping fee (₦) charged
                               below that threshold

   Design (same "never breaks" philosophy as api.js):
   • Sensible hardcoded defaults so the site works even if the
     backend is unreachable (static hosting / demo mode).
   • Everything that displays or calculates shipping should read
     from window.PEO_SETTINGS.shipping instead of hardcoding a
     number, and can `await window.PEO_SETTINGS.ready()` before
     doing money math (e.g. at checkout).
   • Dispatches "peo:settings-ready" once the real values are in
     so already-rendered UI (cart drawer, banners) can refresh.
   Runs AFTER api.js, BEFORE main.js / checkout.js / checkout-page.js.
   ============================================================ */

(function () {
  "use strict";

  const DEFAULTS = {
    freeShipThreshold: 550000,
    flatShipRate: 5000,
  };

  const Settings = {
    shipping: Object.assign({}, DEFAULTS),
    _readyPromise: null,

    /** Await this before doing shipping math that must reflect the
     *  latest admin-configured values (e.g. checkout totals). UI
     *  that renders immediately (cart drawer) can just read
     *  `Settings.shipping` directly and listen for the ready event. */
    ready() {
      if (!this._readyPromise) this._readyPromise = this._load();
      return this._readyPromise;
    },

    async _load() {
      try {
        const api = window.PEOAPI || window.API;
        if (api && typeof api.getContent === "function" && window.location.protocol !== "file:") {
          const content = await api.getContent();
          if (content) {
            const threshold = parseFloat(content["shipping.freeThreshold"]);
            const flat = parseFloat(content["shipping.flatRate"]);
            if (!isNaN(threshold) && threshold >= 0) this.shipping.freeShipThreshold = threshold;
            if (!isNaN(flat) && flat >= 0) this.shipping.flatShipRate = flat;
          }
        }
      } catch (err) {
        console.info("[settings] backend unavailable, using default shipping settings");
      }
      document.dispatchEvent(
        new CustomEvent("peo:settings-ready", { detail: this.shipping })
      );
      return this.shipping;
    },
  };

  window.PEO_SETTINGS = Settings;
  Settings.ready();
})();
