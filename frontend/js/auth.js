/* ============================================================
   PE_ORIGINALS — js/auth.js
   Auth UI: login / signup / forgot-password modals wired to the
   backend (js/api.js). Injects its own markup so the HTML files
   stay clean. Falls back to a friendly message if the backend
   is unreachable (static demo mode).
   ============================================================ */

(function () {
  "use strict";

  const API = window.PEOAPI;

  // ---- Build modal container (idempotent) ----
  function ensureModal() {
    if (document.getElementById("peoAuthModal")) return;
    const wrap = document.createElement("div");
    wrap.id = "peoAuthModal";
    wrap.className = "auth-modal-overlay";
    wrap.innerHTML = `
      <div class="auth-modal" role="dialog" aria-modal="true" aria-label="Account">
        <button class="auth-modal-close" data-auth-close aria-label="Close">&times;</button>
        <div class="auth-modal-brand">PE_<em>ORIGINALS</em></div>

        <!-- LOGIN -->
        <form class="auth-modal-form" data-auth-form="login" hidden>
          <h3>Welcome back</h3>
          <p class="auth-modal-sub">Sign in to check out faster and track orders.</p>
          <label>Email
            <input type="email" name="email" required placeholder="you@email.com" autocomplete="email" />
          </label>
          <label>Password
            <input type="password" name="password" required placeholder="••••••••" autocomplete="current-password" />
          </label>
          <div class="auth-modal-row">
            <a href="#" data-auth-goto="forgot" class="auth-modal-link">Forgot password?</a>
          </div>
          <button type="submit" class="btn btn-block">Sign in</button>
          <p class="auth-modal-error" data-auth-error></p>
          <p class="auth-modal-foot">New here? <a href="#" data-auth-goto="signup" class="auth-modal-link">Create an account</a></p>
        </form>

        <!-- SIGNUP -->
        <form class="auth-modal-form" data-auth-form="signup" hidden>
          <h3>Create your account</h3>
          <p class="auth-modal-sub">Join PE_ORIGINALS for faster checkout & order tracking.</p>
          <label>First name
            <input type="text" name="firstName" required placeholder="Ada" autocomplete="given-name" />
          </label>
          <label>Last name
            <input type="text" name="lastName" required placeholder="Okafor" autocomplete="family-name" />
          </label>
          <label>Email
            <input type="email" name="email" required placeholder="you@email.com" autocomplete="email" />
          </label>
          <label>Password
            <input type="password" name="password" required minlength="8" placeholder="8+ characters" autocomplete="new-password" />
          </label>
          <button type="submit" class="btn btn-block">Create account</button>
          <p class="auth-modal-error" data-auth-error></p>
          <p class="auth-modal-foot">Already have an account? <a href="#" data-auth-goto="login" class="auth-modal-link">Sign in</a></p>
        </form>

        <!-- FORGOT -->
        <form class="auth-modal-form" data-auth-form="forgot" hidden>
          <h3>Reset your password</h3>
          <p class="auth-modal-sub">Enter your email and we'll send a secure reset link.</p>
          <label>Email
            <input type="email" name="email" required placeholder="you@email.com" autocomplete="email" />
          </label>
          <button type="submit" class="btn btn-block">Send reset link</button>
          <p class="auth-modal-error" data-auth-error></p>
          <p class="auth-modal-foot"><a href="#" data-auth-goto="login" class="auth-modal-link">&larr; Back to sign in</a></p>
        </form>

        <!-- RESET CONFIRM (shown after submit) -->
        <div class="auth-modal-form" data-auth-form="sent" hidden>
          <h3>Check your inbox</h3>
          <p class="auth-modal-sub">If that email is registered, a password reset link is on its way. It expires in 30 minutes.</p>
          <button type="button" class="btn btn-block" data-auth-close>Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    // close behaviours
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap || e.target.closest("[data-auth-close]")) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  let current = "login";

  function open(formName) {
    ensureModal();
    current = formName || "login";
    show(current);
    const modal = document.getElementById("peoAuthModal");
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function close() {
    const modal = document.getElementById("peoAuthModal");
    if (!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
  }

  function show(name) {
    const modal = document.getElementById("peoAuthModal");
    modal.querySelectorAll("[data-auth-form]").forEach((f) => {
      f.hidden = f.dataset.authForm !== name;
    });
  }

  function setError(form, msg) {
    const el = form.querySelector("[data-auth-error]");
    if (el) {
      el.textContent = msg || "";
      el.classList.toggle("show", !!msg);
    }
  }

  // ---- Submit handlers ----
  async function handleSubmit(e) {
    const form = e.target.closest("form");
    // This listener is delegated on `document`, so every form submit on the
    // page bubbles through it (newsletter, contact, checkout…). Only handle
    // the auth modal's own forms — otherwise leave other forms' handlers
    // untouched instead of preventing/disabling things that aren't ours.
    if (!form || !form.dataset.authForm) return;
    e.preventDefault();
    const kind = form.dataset.authForm;
    const err = (msg) => setError(form, msg);
    const btn = form.querySelector('button[type="submit"]');
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Please wait…";
    err("");

    try {
      if (kind === "login") {
        const data = await API.login(
          form.email.value.trim(),
          form.password.value
        );
        API.saveTokens(data.accessToken, data.refreshToken);
        close();
        window.dispatchEvent(new CustomEvent("peo:auth", { detail: { user: data.user } }));
        const toast = document.getElementById("cartToast");
        if (toast) {
          toast.querySelector("span").textContent = "Signed in — welcome back!";
          toast.classList.add("show");
          setTimeout(() => toast.classList.remove("show"), 2400);
        }
      } else if (kind === "signup") {
        const data = await API.register({
          email: form.email.value.trim(),
          password: form.password.value,
          firstName: form.firstName.value.trim(),
          lastName: form.lastName.value.trim(),
        });
        API.saveTokens(data.accessToken, data.refreshToken);
        close();
        window.dispatchEvent(new CustomEvent("peo:auth", { detail: { user: data.user } }));
        const toast = document.getElementById("cartToast");
        if (toast) {
          toast.querySelector("span").textContent = "Account created — welcome!";
          toast.classList.add("show");
          setTimeout(() => toast.classList.remove("show"), 2400);
        }
      } else if (kind === "forgot") {
        await API.forgotPassword(form.email.value.trim());
        show("sent");
      }
    } catch (ex) {
      err(ex.message || "Something went wrong. Please try again.");
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  // ---- Wire up (event delegation, idempotent) ----
  function init() {
    document.addEventListener("click", (e) => {
      // open: [data-open-auth], [data-open-login], [data-open-signup]
      const opener = e.target.closest(
        "[data-open-auth],[data-open-login],[data-open-signup]"
      );
      if (opener) {
        e.preventDefault();
        const which = opener.hasAttribute("data-open-signup")
          ? "signup"
          : opener.hasAttribute("data-open-login")
            ? "login"
            : "login";
        open(which);
        return;
      }
      // switch tabs inside modal
      const goto = e.target.closest("[data-auth-goto]");
      if (goto && document.getElementById("peoAuthModal")) {
        e.preventDefault();
        show(goto.dataset.authGoto);
        return;
      }
    });
    document.addEventListener("submit", handleSubmit);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Public API
  window.PEOAuth = { open, close, isLoggedIn: () => API.isLoggedIn() };
})();
