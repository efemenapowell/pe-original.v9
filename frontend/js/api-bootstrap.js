/* ============================================================
   PE_ORIGINALS — js/api-bootstrap.js
   Loads products & categories from the backend (/api/products,
   /api/categories) and merges them into the live catalogue
   (window.PRODUCTS / CATEGORIES / BRANDS, exposed by products.js).

   Design:
   • Tries the API first. On ANY failure (backend down, static
     hosting) it silently keeps the local products.js data, so
     the site still works as a static demo.
   • Merges API products with local ones by numeric id — API
     items win (single source of truth when the backend is live).
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
      id: Number(String(p.id).replace(/\D/g, "").slice(0, 9)) || Date.now() % 1e6,
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
      if (!res.ok) return;

      const json = await res.json();
      if (!json || !json.data) return;

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

      if (!apiItems.length) return;

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

      // Merge into the SAME arrays main.js reads (window-exposed).
      const local = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
      const merged = local.slice();

      mapped.forEach((mp) => {
        const idx = merged.findIndex((m) => m.id === mp.id);
        if (idx >= 0) merged[idx] = mp;
        else merged.push(mp);
      });

      // Replace the contents of the exposed arrays in place so all
      // existing references (main.js closures) see the new data.
      window.PRODUCTS.length = 0;
      merged.forEach((p) => window.PRODUCTS.push(p));

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

      console.info("[api] loaded " + mapped.length + " products from backend");
      // Signal main.js to re-render grids/detail with fresh data
      window.dispatchEvent(
        new CustomEvent("peo:products", { detail: { count: mapped.length } })
      );
    } catch (err) {
      // Silent fallback — local products.js remains active
      console.info("[api] backend unavailable, using local catalogue");
    }
  }

  bootstrap();
})();
