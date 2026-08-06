// ============================================================
// admin/js/forgot.js — admin forgot-password page logic
// (External file so nothing depends on inline scripts.)
// ============================================================
(function () {
  "use strict";

  const API = new AdminAPI();

  const form = document.getElementById("forgotForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("formError");
    const okEl = document.getElementById("formSuccess");
    const btn = document.getElementById("submitBtn");
    errEl.textContent = "";
    okEl.textContent = "";
    btn.disabled = true;
    btn.textContent = "Sending…";

    try {
      await API.forgotPassword(document.getElementById("email").value.trim());
      okEl.textContent =
        "If that email exists, a reset link is on its way. Check your inbox.";
    } catch (err) {
      errEl.textContent = err.message || "Something went wrong — please try again.";
    } finally {
      btn.disabled = false;
      btn.textContent = "Send reset link";
    }
  });
})();
