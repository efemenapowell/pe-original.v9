// ============================================================
// admin/js/login.js — admin login page logic
// (Separate file so nothing depends on inline scripts.)
// ============================================================
(function () {
  "use strict";

  const API = new AdminAPI();

  // Already logged in? Go straight to dashboard.
  if (API.isAuthed()) {
    window.location.replace("index.html");
    return;
  }

  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("formError");
    const btn = document.getElementById("loginBtn");
    errEl.textContent = "";
    btn.disabled = true;
    btn.textContent = "Signing in…";

    try {
      const res = await API.login(
        document.getElementById("email").value.trim(),
        document.getElementById("password").value
      );
      API.saveTokens(res.accessToken, res.refreshToken);
      if (!document.getElementById("remember").checked) {
        sessionStorage.setItem("peo_admin_session", "1");
      }
      window.location.replace("index.html");
    } catch (err) {
      errEl.textContent = err.message || "Login failed. Check your credentials.";
      btn.disabled = false;
      btn.textContent = "Sign in";
    }
  });
})();
