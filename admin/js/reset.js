// ============================================================
// admin/js/reset.js — admin reset-password page logic
// (External file so nothing depends on inline scripts.)
// ============================================================
(function () {
  "use strict";

  const API = new AdminAPI();

  const token = new URLSearchParams(window.location.search).get("token");
  if (!token) {
    const errEl = document.getElementById("formError");
    if (errEl)
      errEl.textContent = "Missing reset token. Request a new link.";
  }

  const form = document.getElementById("resetForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("formError");
    const okEl = document.getElementById("formSuccess");
    const pass = document.getElementById("password").value;
    const confirm = document.getElementById("confirm").value;
    errEl.textContent = "";
    okEl.textContent = "";

    if (pass.length < 8) {
      errEl.textContent = "Password must be at least 8 characters.";
      return;
    }
    if (pass !== confirm) {
      errEl.textContent = "Passwords do not match.";
      return;
    }

    const btn = document.getElementById("submitBtn");
    btn.disabled = true;
    btn.textContent = "Resetting…";
    try {
      await API.resetPassword(token, pass);
      okEl.textContent = "Password updated! Redirecting to sign in…";
      setTimeout(() => window.location.replace("login.html"), 1600);
    } catch (err) {
      errEl.textContent = err.message || "Reset failed. The link may have expired.";
      btn.disabled = false;
      btn.textContent = "Reset password";
    }
  });
})();
