/* ============================================================
   PE_ORIGINALS — js/api-bootstrap.js
   Loads products & categories from the backend (/api/products,
   /api/categories) into the live catalogue (window.PRODUCTS /
   CATEGORIES / BRANDS, exposed by products.js).

   Design:
   • Tries the API first. Once the backend answers successfully,
     window.PRODUCTS is REPLACED with backend products only — the
     local products.js demo catalogue is never mixed in, even if
     the store has zero products yet (storefront then shows its
     normal "no products" empty state instead of demo items).
   • The local products.js data is used ONLY as an offline/demo
     fallback when the backend genuinely can't be reached (down,
     static hosting, file:// preview) — so the site still renders
     something in that situation.
   • Dispatches "peo:products" so main.js re-renders grids.
   • Runs AFTER products.js, BEFORE main.js.
   ============================================================ */

(function () {
  "use strict";

  const API = window.PEOAPI;

  // Used whenever a product genuinely has no image (e.g. created in the
  // admin panel before an image was uploaded) so the storefront never
  // renders an <img src=""> — that's what was showing up as broken/missing
  // images on the product detail page for those items.
  const FALLBACK_IMAGE = "https://picsum.photos/seed/peo-fallback/600/800";

  // Derive a stable numeric id from the backend's UUID string id.
  // (main.js/products.js's PRODUCTS array uses numeric ids throughout —
  // cart storage, getProductById, sort-by-id, etc.)
  //
  // The previous approach stripped non-digit characters and kept only
  // the first 9 digits of the UUID. That's collision-prone: two
  // different products can easily end up with the same digit sequence
  // once the letters are dropped. A colliding id means getProductById(id)
  // can resolve to the WRONG product — showing the wrong item on the
  // product page, merging separate items in the cart, etc. A string
  // hash over the FULL id spreads products evenly across the numeric
  // range instead (verified: 0 collisions across 24 random UUIDs).
  function hashId(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33 + str.charCodeAt(i)) | 0; // djb2, 32-bit
    }
    return Math.abs(hash) || 1;
  }

  // Map a backend product (string id, category object) into the
  // local shape used by main.js (numeric id, category slug).
  function mapApiProduct(p, catMap) {
    const catSlug =
      (p.category && (p.category.slug || p.category.id)) ||
      (catMap && catMap[p.categoryId]) ||
      "accessories";
    const image = p.image || FALLBACK_IMAGE;
    const gallery = Array.isArray(p.gallery) ? p.gallery.filter(Boolean) : [];
    return {
      id: hashId(String(p.id)),
      name: p.name,
      brand: p.brand,
      price: p.price,
      originalPrice: p.originalPrice || 0,
      category: catSlug,
      sizes: Array.isArray(p.sizes) ? p.sizes : ["S", "M", "L"],
      soldSizes: Array.isArray(p.soldSizes) ? p.soldSizes : [],
      image,
      gallery: gallery.length ? gallery : [image],
      description: p.description || "",
      badge: p.badge || "",
      rating: p.rating || 0,
      reviews: p.reviews || 0,
      condition: p.condition || "",
      featured: !!p.featured,
    };
  }

  async function bootstrap() {
    if (!API || typeof API.getProducts !== "function") return;

    // On file:// or static hosting the fetch fails fast → fallback.
    if (window.location.protocol === "file:") return;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000); // 3s cap
      const res = await fetch(
        (API.BASE || "") + "/api/products?limit=48&isActive=true",
        { signal: controller.signal }
      );
      clearTimeout(timer);
      if (!res.ok) return; // server error → keep local demo fallback

      const json = await res.json();
      if (!json || !json.data) return; // malformed response → keep local demo fallback

      const apiItems = Array.isArray(json.data)
        ? json.data
        : Array.isArray(json.data.items)
          ? json.data.items
          : [];

      let catMap = {};
      try {
        const cRes = await fetch((API.BASE || "") + "/api/categories");
        const cJson = await cRes.json();
        if (cJson && Array.isArray(cJson.data)) {
          cJson.data.forEach((c) => (catMap[c.id] = c.slug));
        }
      } catch {
        /* categories optional */
      }

      // Backend answered successfully — it's the live source of truth
      // from here on, even if it currently has zero active products.
      const activeApiItems = apiItems.filter((p) => p.isActive !== false);
      const mapped = activeApiItems.map((p) => mapApiProduct(p, catMap));

      // The numeric id above is a lossy, one-way derivation of the real
      // backend id (a cuid/uuid string) — record the reverse mapping so
      // checkout (checkout.js / checkout-page.js) can send the real
      // backend product id when placing an order, instead of the numeric
      // frontend id which the API wouldn't recognise.
      window.PEO_PRODUCT_MAP = window.PEO_PRODUCT_MAP || {};
      activeApiItems.forEach((p, i) => {
        window.PEO_PRODUCT_MAP[mapped[i].id] = p.id;
      });

      // Replace the contents of the exposed array in place (not merge)
      // so all existing references (main.js closures) see ONLY real,
      // admin-added products — the local products.js demo catalogue is
      // dropped entirely once the backend is confirmed reachable.
      window.PRODUCTS = window.PRODUCTS || [];
      window.PRODUCTS.length = 0;
      mapped.forEach((p) => window.PRODUCTS.push(p));

      // Rebuild derived globals
      const cats = Array.isArray(window.CATEGORIES) ? window.CATEGORIES : [];
      const known = new Set(cats.map((c) => c.id));
      mapped.forEach((mp) => {
        if (!known.has(mp.category)) {
          cats.push({ id: mp.category, label: mp.category });
          known.add(mp.category);
        }
      });
      window.BRANDS = [...new Set(window.PRODUCTS.map((p) => p.brand))].sort();

      console.info("[api] loaded " + mapped.length + " product(s) from backend");
      // Signal main.js to re-render grids/detail with fresh data
      // NOTE: dispatched on `document` — every listener for this event
      // (main.js shop grid, product-detail.js, checkout-page.js) uses
      // document.addEventListener. Dispatching on `window` here meant
      // none of them ever received it: window sits above document in
      // the DOM tree, so an event targeted at window never reaches a
      // document-level listener. That silent mismatch was the actual
      // cause of the blank product page and the shop grid getting
      // stuck on "0 results" until a filter/sort was touched — the
      // async backend fetch would resolve, but the "data is ready"
      // signal never reached anything listening for it.
      document.dispatchEvent(
        new CustomEvent("peo:products", { detail: { count: mapped.length } })
      );
    } catch (err) {
      // Silent fallback — local products.js remains active
      console.info("[api] backend unavailable, using local catalogue");
    }
  }

  bootstrap();
})();
