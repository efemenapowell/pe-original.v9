/* ============================================================
   PE_ORIGINALS — js/paystack-inline.js
   Loads the Paystack Inline JS SDK (https://js.paystack.co/v1/inline.js)
   once, then exposes a small promise-based helper to open the
   Paystack payment popup.

   Usage:
     const result = await window.PeoPaystack.popup({
       key: publicKey,        // pk_… from the backend
       email, amount,         // amount in NAIRA (converted to kobo inside)
       reference,             // unique order reference
       onSuccess: (tx) => {}, // called when payment succeeds
       onCancel: () => {},    // called when the user closes the popup
     });

   The popup never exposes card details to our server — Paystack
   handles PCI compliance end-to-end.
   ============================================================ */
(function () {
  "use strict";

  let sdkPromise = null;

  /** Dynamically inject the Paystack inline script (idempotent). */
  function loadSdk() {
    if (window.PaystackPop) return Promise.resolve(window.PaystackPop);
    if (sdkPromise) return sdkPromise;

    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.async = true;
      script.onload = () => resolve(window.PaystackPop);
      script.onerror = () => {
        sdkPromise = null;
        reject(new Error("Could not load Paystack. Please try again or choose another payment method."));
      };
      document.head.appendChild(script);
    });
    return sdkPromise;
  }

  /**
   * Open the Paystack popup.
   * @param {object} opts { key, email, amount (naira), reference, onSuccess, onCancel }
   */
  async function popup(opts) {
    const PaystackPop = await loadSdk();

    return new Promise((resolve, reject) => {
      const handler = PaystackPop.setup({
        key: opts.key,
        email: opts.email,
        amount: Math.round(Number(opts.amount || 0) * 100), // naira → kobo
        currency: "NGN",
        ref: opts.reference,
        metadata: opts.metadata || {},
        callback: (tx) => {
          // Called when payment is successful — verify on the backend
          if (typeof opts.onSuccess === "function") opts.onSuccess(tx);
          resolve(tx);
        },
        onClose: () => {
          if (typeof opts.onCancel === "function") opts.onCancel();
          resolve(null);
        },
      });
      handler.openIframe();
    });
  }

  window.PeoPaystack = { loadSdk, popup };
})();
