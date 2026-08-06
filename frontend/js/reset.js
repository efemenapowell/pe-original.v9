// ============================================================
// PE_ORIGINALS — js/reset.js
// Full-page password reset form (reset-password.html).
// External file so it works under the CSP (no inline scripts).
// ============================================================
(function () {
  "use strict";

  const API = window.PEOAPI;
  const token = new URLSearchParams(window.location.search).get("token");
  const msg = document.getElementById("msg");
  const form = document.getElementById("resetForm");
  if (!form) return;

  if (!token && msg) {
    msg.textContent = "Missing reset token — please request a new link.";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pass = document.getElementById("password").value;
    const confirm = document.getElementById("confirm").value;
    const btn = document.getElementById("submitBtn");
    msg.className = "msg err";
    msg.textContent = "";

    if (pass.length < 8) {
      msg.textContent = "Password must be at least 8 characters.";
      return;
    }
    if (pass !== confirm) {
      msg.textContent = "Passwords do not match.";
      return;
    }
    if (!token) return;

    btn.disabled = true;
    btn.textContent = "Resetting…";
    try {
      await API.resetPassword(token, pass);
      msg.className = "msg ok";
      msg.textContent = "Password updated! Redirecting to the store…";
      setTimeout(() => (window.location.href = "index.html"), 1600);
    } catch (err) {
      msg.textContent = err.message || "Reset failed — the link may have expired.";
      btn.disabled = false;
      btn.textContent = "Reset password";
    }
  });
})();
