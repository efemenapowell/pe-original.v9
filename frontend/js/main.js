/* ==========================================================
   PE_ORIGINALS — main.js
   Shared site logic: nav, mobile menu, cart (add/remove/qty/
   count badge/drawer/localStorage), filters, forms, accordions
   ========================================================== */

"use strict";

/* ── Utility ───────────────────────────────────────────── */
function $(sel, ctx) {
  return (ctx || document).querySelector(sel);
}
function $$(sel, ctx) {
  return Array.from((ctx || document).querySelectorAll(sel));
}
function money(n) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

/* ── Scroll lock (mobile menu + cart drawer) ──────────────
   Plain `body.style.overflow = "hidden"` does NOT stop touch-drag
   scrolling on iOS Safari — the page can still be dragged sideways/
   up-down while "locked," which is what caused the reported mobile
   bug (page shifting to the side, then feeling frozen once the
   layout and native scroll position disagree). Locking via
   position:fixed on the body is the standard reliable fix, with a
   counter so the menu and cart drawer can't unlock each other if
   both happen to be open at once. ────────────────────────────── */
const ScrollLock = {
  count: 0,
  scrollY: 0,
  lock() {
    if (this.count === 0) {
      this.scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = -this.scrollY + "px";
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
    }
    this.count++;
  },
  unlock() {
    this.count = Math.max(0, this.count - 1);
    if (this.count === 0) {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      window.scrollTo(0, this.scrollY);
    }
  },
};

/* ── Nav search icon (pages other than shop.html) ─────────
   Opens a small styled search modal (built lazily below, matching
   the cart-drawer / mobile-menu visual language) and sends the
   shopper to the shop page with ?search= applied on submit.
   Closes on: the × button, clicking the dimmed backdrop outside
   the panel, pressing Esc, or a successful search.
   On shop.html itself, the icon just focuses the inline search
   box instead (see shop.html's onclick). ──────────────────────── */
(function initSearchModal() {
  let overlay, panel, input, form, closeBtn;

  function build() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "search-overlay";
    overlay.innerHTML = `
      <div class="search-panel" role="dialog" aria-modal="true" aria-label="Search PE_ORIGINALS">
        <button type="button" class="search-panel-close" aria-label="Close search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <span class="search-panel-eyebrow">Find your next piece</span>
        <h3>Search PE_ORIGINALS</h3>
        <form class="search-panel-form">
          <svg class="search-panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input type="search" placeholder="Dresses, brands, "linen trousers"…" aria-label="Search products" />
        </form>
        <p class="search-panel-hint">Press <kbd>Enter</kbd> to search, or <kbd>Esc</kbd> to close</p>
      </div>`;
    document.body.appendChild(overlay);

    panel = overlay.querySelector(".search-panel");
    input = overlay.querySelector("input");
    form = overlay.querySelector(".search-panel-form");
    closeBtn = overlay.querySelector(".search-panel-close");

    // Close triggers — X button, clicking the dimmed backdrop
    // (i.e. anywhere outside the panel), and Esc.
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("active")) close();
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const query = input.value.trim();
      close();
      window.location.href = query
        ? "shop.html?search=" + encodeURIComponent(query)
        : "shop.html";
    });
  }

  function open() {
    build();
    overlay.classList.add("active");
    ScrollLock.lock();
    input.value = "";
    setTimeout(() => input.focus(), 250); // wait for the open transition
  }

  function close() {
    if (!overlay || !overlay.classList.contains("active")) return;
    overlay.classList.remove("active");
    ScrollLock.unlock();
    input.blur();
  }

  window.peoNavSearch = open;
})();

/* ── Sticky Nav ────────────────────────────────────────── */
(function initNav() {
  const nav = $("#nav");
  if (!nav) return;
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();

/* ── Mobile Menu ───────────────────────────────────────── */
(function initMobileMenu() {
  const toggle = $("#navToggle");
  const menu = $("#mobileMenu");
  const overlay = $("#menuOverlay");
  if (!toggle || !menu) return;

  function openMenu() {
    menu.classList.add("open");
    if (overlay) overlay.classList.add("active");
    toggle.classList.add("open");
    ScrollLock.lock();
    // stagger menu links
    $$(".m-link", menu).forEach((a, i) => {
      a.style.transitionDelay = 0.08 + i * 0.06 + "s";
    });
  }
  function closeMenu() {
    menu.classList.remove("open");
    if (overlay) overlay.classList.remove("active");
    toggle.classList.remove("open");
    ScrollLock.unlock();
    $$(".m-link", menu).forEach((a) => {
      a.style.transitionDelay = "0s";
    });
  }
  toggle.addEventListener("click", () =>
    menu.classList.contains("open") ? closeMenu() : openMenu(),
  );
  if (overlay) overlay.addEventListener("click", closeMenu);
  $$(".m-link", menu).forEach((a) => a.addEventListener("click", closeMenu));
})();

/* ════════════════════════════════════════════════════════
   CART SYSTEM
   Stores items in localStorage → persists across pages.
   Each cart item: { id, size, qty }
   ════════════════════════════════════════════════════════ */
const Cart = {
  KEY: "pe_originals_cart",
  // Admin-editable (Settings → Shipping in the admin panel). Falls back to
  // a sane default until js/settings.js resolves the real value.
  get FREE_SHIP_THRESHOLD() {
    return (window.PEO_SETTINGS && window.PEO_SETTINGS.shipping.freeShipThreshold) || 550000;
  },

  get() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch (e) {
      return [];
    }
  },
  save(items) {
    localStorage.setItem(this.KEY, JSON.stringify(items));
    this.renderBadge();
    if (typeof this.onChange === "function") this.onChange();
  },
  add(id, size, qty) {
    const items = this.get();
    const existing = items.find((i) => i.id === Number(id) && i.size === size);
    if (existing) {
      existing.qty += qty;
    } else {
      items.push({ id: Number(id), size: size, qty: qty });
    }
    this.save(items);
    this.showToast("Added to your bag");
  },
  remove(id, size) {
    this.save(
      this.get().filter((i) => !(i.id === Number(id) && i.size === size)),
    );
  },
  setQty(id, size, qty) {
    const items = this.get();
    const item = items.find((i) => i.id === Number(id) && i.size === size);
    if (!item) return;
    item.qty = Math.max(1, Math.min(20, qty));
    this.save(items);
  },
  count() {
    // Only count items whose product still exists — keeps the badge in
    // sync with the drawer, which already skips items it can't resolve
    // (e.g. a stale cart entry left over from a product that was
    // removed/deactivated, or from testing before real products existed).
    return this.get().reduce((n, i) => {
      return getProductById(i.id) ? n + i.qty : n;
    }, 0);
  },
  subtotal() {
    return this.get().reduce((sum, i) => {
      const p = getProductById(i.id);
      return p ? sum + p.price * i.qty : sum;
    }, 0);
  },
  renderBadge() {
    const badge = $(".cart-count");
    if (!badge) return;
    const n = this.count();
    badge.textContent = n || "0";
    badge.classList.toggle("visible", n > 0);
  },
  /* ── Cart drawer rendering ── */
  renderDrawer() {
    const list = $("#cartItems");
    const empty = $("#cartEmpty");
    const footer = $("#cartFooter");
    if (!list) return;

    const items = this.get();
    list.innerHTML = "";
    if (!items.length) {
      if (empty) empty.style.display = "";
      if (footer) footer.style.display = "none";
      return;
    }
    if (empty) empty.style.display = "none";
    if (footer) footer.style.display = "";

    items.forEach((item, idx) => {
      const p = getProductById(item.id);
      if (!p) return;
      const row = document.createElement("div");
      row.className = "cart-item";
      row.style.animationDelay = idx * 0.05 + "s";
      row.innerHTML = `
        <div class="cart-item-img">
          <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.parentElement.style.display='none'">
        </div>
        <div>
          <div class="cart-item-name">${p.name}</div>
          <div class="cart-item-brand">${p.brand}</div>
          <div class="cart-item-meta">Size: ${item.size}</div>
          <div class="cart-item-price">${money(p.price)}</div>
          <button class="cart-item-remove" data-id="${p.id}" data-size="${item.size}">Remove</button>
        </div>
        <div class="qty-control">
          <button class="qty-minus" data-id="${p.id}" data-size="${item.size}" aria-label="Decrease">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-plus" data-id="${p.id}" data-size="${item.size}" aria-label="Increase">+</button>
        </div>
      `;
      list.appendChild(row);
    });

    // totals
    const sub = this.subtotal();
    const $sub = $("#cartSubtotal");
    if ($sub) $sub.textContent = money(sub);
    const $total = $("#cartTotal");
    if ($total) $total.textContent = money(sub);

    // free-shipping progress
    const bar = $("#shipBar");
    const note = $("#shipNote");
    if (bar) {
      const pct = Math.min(100, (sub / this.FREE_SHIP_THRESHOLD) * 100);
      bar.style.width = pct + "%";
      if (note) {
        note.innerHTML =
          sub >= this.FREE_SHIP_THRESHOLD
            ? "✓ You've unlocked <strong>free shipping</strong>!"
            : `You're <strong>${money(this.FREE_SHIP_THRESHOLD - sub)}</strong> away from free shipping`;
      }
    }
  },
  openDrawer() {
    const drawer = $("#cartDrawer");
    const overlay = $("#cartOverlay");
    if (!drawer) return;
    this.renderDrawer();
    drawer.classList.add("open");
    if (overlay) overlay.classList.add("active");
    ScrollLock.lock();
  },
  closeDrawer() {
    const drawer = $("#cartDrawer");
    const overlay = $("#cartOverlay");
    if (drawer) drawer.classList.remove("open");
    if (overlay) overlay.classList.remove("active");
    ScrollLock.unlock();
  },
  showToast(msg) {
    let toast = $("#cartToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "cartToast";
      toast.className = "cart-toast";
      toast.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg><span></span>';
      document.body.appendChild(toast);
    }
    toast.querySelector("span").textContent = msg;
    toast.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  },
};
// Expose Cart on window so other scripts (e.g. the cart-drawer "Checkout"
// button's modal in checkout.js) can read the same cart instead of an
// undefined global, which previously made that modal think the bag was
// always empty.
window.PEO_CART = Cart;

/* ── Refresh price displays once admin-configured settings load ──
   settings.js resolves shipping.freeThreshold/flatRate from the
   backend asynchronously; until then Cart.FREE_SHIP_THRESHOLD uses
   a hardcoded fallback. Once the real value arrives, re-render
   anything already on screen that shows it. ─────────────────── */
document.addEventListener("peo:settings-ready", () => {
  const amount = money(Cart.FREE_SHIP_THRESHOLD);
  const announce = $("#announceShipAmt");
  if (announce) announce.textContent = amount;
  const perk = $("#perkShipAmt");
  if (perk) perk.textContent = amount;
  const drawer = $("#cartDrawer");
  if (drawer && drawer.classList.contains("open")) Cart.renderDrawer();
});

/* ── Wire up cart UI (once DOM ready) ──────────────────── */
(function initCartUI() {
  document.addEventListener("click", (e) => {
    // open cart
    if (e.target.closest("[data-open-cart]")) Cart.openDrawer();
    // close cart
    if (e.target.closest("[data-close-cart]")) Cart.closeDrawer();
    if (e.target.id === "cartOverlay") Cart.closeDrawer();
    // qty controls
    const minus = e.target.closest(".qty-minus");
    if (minus) {
      const row = minus.closest(".cart-item");
      const val = row ? $(".qty-val", row) : null;
      const cur = val ? parseInt(val.textContent, 10) : 1;
      Cart.setQty(minus.dataset.id, minus.dataset.size, cur - 1);
      Cart.renderDrawer();
      return;
    }
    const plus = e.target.closest(".qty-plus");
    if (plus) {
      const row = plus.closest(".cart-item");
      const val = row ? $(".qty-val", row) : null;
      const cur = val ? parseInt(val.textContent, 10) : 1;
      Cart.setQty(plus.dataset.id, plus.dataset.size, cur + 1);
      Cart.renderDrawer();
      return;
    }
    // remove
    const rm = e.target.closest(".cart-item-remove");
    if (rm) {
      Cart.remove(rm.dataset.id, rm.dataset.size);
      Cart.renderDrawer();
    }
    // add-to-cart buttons (product cards, detail page)
    const addBtn = e.target.closest("[data-add-to-cart]");
    if (addBtn) {
      const id = addBtn.dataset.addToCart;
      const p = getProductById(id);
      if (!p) return;
      // if a size selector exists on this page, require selection
      const sel = $(".size-option.selected");
      if ($("#sizeOptions")) {
        if (!sel) {
          const err = $("#sizeError");
          if (err) err.classList.add("show");
          return;
        }
        Cart.add(id, sel.dataset.size, 1);
      } else {
        Cart.add(id, p.sizes[0], 1);
      }
    }
    // wishlist toggles
    const wish = e.target.closest("[data-wishlist]");
    if (wish) {
      wish.classList.toggle("liked");
      const ico = $("svg", wish);
      if (ico)
        ico.style.fill = wish.classList.contains("liked")
          ? "currentColor"
          : "none";
    }
  });

  // size selector
  document.addEventListener("click", (e) => {
    const opt = e.target.closest(".size-option");
    if (!opt || opt.classList.contains("disabled")) return;
    $$(".size-option").forEach((o) => o.classList.remove("selected"));
    opt.classList.add("selected");
    const err = $("#sizeError");
    if (err) err.classList.remove("show");
  });

  // global add-to-cart from product cards (with size pick)
  document.addEventListener("click", (e) => {
    const q = e.target.closest(".product-quick");
    if (!q) return;
    const p = getProductById(q.dataset.productId);
    if (p && !p.sizes.length) return;
    const size =
      p.sizes.find((s) => !(p.soldSizes || []).includes(s)) || p.sizes[0];
    if (size) Cart.add(p.id, size, 1);
  });

  Cart.renderBadge();
  Cart.renderDrawer();
})();

/* ── Product card renderer (shared) ─────────────────────── */
function renderProductCard(p, opts = {}) {
  const sold = p.badge === "sold" || p.sizes.length === 0;
  const discount =
    p.originalPrice > p.price
      ? Math.round((1 - p.price / p.originalPrice) * 100)
      : 0;
  const badgeHtml = p.badge
    ? `<span class="badge badge-${p.badge}">${p.badge === "sale" ? `-${discount}%` : p.badge}</span>`
    : "";

  return `
  <article class="product-card reveal${opts.delay ? " delay-" + opts.delay : ""}" data-cat="${p.category}" data-id="${p.id}">
    <a href="product.html?id=${p.id}" class="product-media zoom-img">
      <img src="${p.image}" alt="${p.name}" loading="lazy"
           onerror="this.parentElement.style.display='none'">
      <div class="product-badges">${badgeHtml}</div>
      <button class="wishlist-btn" data-wishlist aria-label="Add to wishlist">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7.5-4.7-10-9.3C.5 8 2.6 4.5 6.2 4.5c2.2 0 3.9 1.2 4.8 3 0.9-1.8 2.6-3 4.8-3 3.6 0 5.7 3.5 4.2 7.2C19.5 16.3 12 21 12 21z"/></svg>
      </button>
      <span class="product-quick" data-product-id="${p.id}">Quick Add +</span>
    </a>
    <div class="product-info">
      <div class="product-brand">${p.brand}</div>
      <a href="product.html?id=${p.id}" class="product-name">${p.name}</a>
      <div class="product-price-row">
        <span class="product-price"><span class="currency">₦</span>${Number(p.price).toLocaleString("en-NG")}</span>
        ${p.originalPrice > p.price ? `<span class="product-price-old">₦${Number(p.originalPrice).toLocaleString("en-NG")}</span><span class="product-save">Save ${discount}%</span>` : ""}
      </div>
      <div class="product-rating">
        <span class="stars">${"★".repeat(Math.round(p.rating))}${"☆".repeat(5 - Math.round(p.rating))}</span>
        <span>${p.rating} (${p.reviews})</span>
      </div>
    </div>
  </article>`;
}

/* ── Shop page: filters, sort, search ──────────────────── */
(function initShop() {
  const grid = $("#shopGrid");
  if (!grid) return;

  const state = {
    cats: new Set(),
    sizes: new Set(),
    brands: new Set(),
    maxPrice: 300000,
    sort: "featured",
    search: "",
  };

  // build brand + size filter options dynamically
  const brandList = $("#brandOptions");
  if (brandList) {
    BRANDS.forEach((b) => {
      const label = document.createElement("label");
      label.className = "filter-option";
      label.innerHTML = `<input type="checkbox" value="${b}"><span>${b}</span><span class="count">${PRODUCTS.filter((p) => p.brand === b).length}</span>`;
      brandList.appendChild(label);
    });
  }
  const sizeList = $("#sizeOptions");
  if (sizeList) {
    const allSizes = [...new Set(PRODUCTS.flatMap((p) => p.sizes))].sort(
      (a, b) => {
        const num = (s) => parseInt(s, 10);
        return isNaN(num(a)) && isNaN(num(b))
          ? a.localeCompare(b)
          : (num(a) || 99) - (num(b) || 99);
      },
    );
    allSizes.forEach((s) => {
      const label = document.createElement("label");
      label.className = "filter-option";
      label.innerHTML = `<input type="checkbox" value="${s}"><span>Size ${s}</span>`;
      sizeList.appendChild(label);
    });
  }

  // Fill real category counts into the static filter checkboxes
  const catOpts = document.querySelectorAll(
    '#catOptions input[type="checkbox"]',
  );
  if (catOpts.length) {
    const groups = {};
    PRODUCTS.forEach((p) => {
      if (p.badge !== "sold")
        groups[p.category] = (groups[p.category] || 0) + 1;
    });
    catOpts.forEach((cb) => {
      const span =
        cb.closest("label") && cb.closest("label").querySelector(".count");
      if (span) span.textContent = groups[cb.value] || 0;
    });
  }

  function applyFilters() {
    let list = PRODUCTS.filter((p) => p.badge !== "sold");

    if (state.cats.size) list = list.filter((p) => state.cats.has(p.category));
    if (state.sizes.size)
      list = list.filter((p) => p.sizes.some((s) => state.sizes.has(s)));
    if (state.brands.size) list = list.filter((p) => state.brands.has(p.brand));
    list = list.filter((p) => p.price <= state.maxPrice);
    if (state.search) {
      const q = state.search.toLowerCase();
      list = list.filter((p) =>
        (p.name + " " + p.brand + " " + p.category).toLowerCase().includes(q),
      );
    }

    // sort
    switch (state.sort) {
      case "price-low":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        list.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        list.sort((a, b) => b.rating - a.rating);
        break;
      case "newest":
        list.sort((a, b) => b.id - a.id);
        break;
      default:
        list.sort((a, b) => b.featured - a.featured || a.id - b.id);
    }

    grid.innerHTML = list
      .map((p, i) => renderProductCard(p, { delay: (i % 4) + 1 }))
      .join("");
    const count = $("#resultCount");
    if (count) count.textContent = list.length;
    const none = $("#noResults");
    if (none) none.style.display = list.length ? "none" : "block";

    // re-trigger reveal for newly rendered cards
    if (window.PEAnim && typeof window.PEAnim.refreshReveals === "function") {
      window.PEAnim.refreshReveals();
    }
  }

  // checkbox filters
  $$('.filter-option input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", () => {
      const value = cb.value;
      const group = cb.closest(".filter-group");
      const key = group && group.dataset.group ? group.dataset.group : "cats";
      const set =
        key === "brands"
          ? state.brands
          : key === "sizes"
            ? state.sizes
            : state.cats;
      cb.checked ? set.add(value) : set.delete(value);
      applyFilters();
    });
  });

  // price range
  const range = $("#priceRange");
  if (range) {
    const label = $("#priceLabel");
    range.addEventListener("input", () => {
      state.maxPrice = Number(range.value);
      if (label)
        label.textContent = "₦" + state.maxPrice.toLocaleString("en-NG");
      applyFilters();
    });
  }

  // sort
  const sortSel = $("#sortSelect");
  if (sortSel)
    sortSel.addEventListener("change", () => {
      state.sort = sortSel.value;
      applyFilters();
    });

  // search
  const searchInput = $("#shopSearch");
  if (searchInput) {
    let t;
    searchInput.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.search = searchInput.value.trim();
        applyFilters();
      }, 250);
    });
  }

  // category chips (page load from ?cat=)
  const urlParams = new URLSearchParams(window.location.search);
  const urlCat = urlParams.get("cat");
  if (urlCat) state.cats.add(urlCat);

  // search (page load from ?search=, e.g. from the nav search bar on other pages)
  const urlSearch = urlParams.get("search");
  if (urlSearch) {
    state.search = urlSearch.trim();
    if (searchInput) searchInput.value = state.search;
  }

  // clear filters
  const clearBtn = $("#clearFilters");
  if (clearBtn)
    clearBtn.addEventListener("click", () => {
      state.cats.clear();
      state.sizes.clear();
      state.brands.clear();
      state.search = "";
      state.maxPrice = 300000;
      $$(".filter-option input").forEach((c) => (c.checked = false));
      if (range) {
        range.value = 300000;
        if (label) label.textContent = "₦300,000";
      }
      if (searchInput) searchInput.value = "";
      applyFilters();
    });

  applyFilters();
})();

/* ── Forms & validation ────────────────────────────────── */
(function () {
  document.addEventListener("submit", (e) => {
    const form = e.target;
    const needsVal = form.classList.contains("needs-validate");
    if (!needsVal) return;

    // Bootstrap-style validation display
    let valid = true;
    $$(":invalid", form).forEach((f) => {
      f.classList.add("error");
      valid = false;
    });
    if (!valid) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  // Clear error on input
  document.addEventListener("input", (e) => {
    const f = e.target;
    if (f.classList.contains("error")) {
      if (f.validity.valid) f.classList.remove("error");
    }
  });
})();

/* ── Accordions ────────────────────────────────────────── */
(function () {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-accordion]");
    if (!btn) return;
    const id = btn.dataset.accordion;
    const panel = document.getElementById(id);
    if (!panel) return;
    btn.classList.toggle("active");
    panel.classList.toggle("open");
  });
})();

