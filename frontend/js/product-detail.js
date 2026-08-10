/* ============================================================
   PE_ORIGINALS — js/product-detail.js
   Renders the single-product page (#productRoot) and the
   "Complete the Look" related grid (#relatedGrid) on
   product.html. Loads after main.js / products.js /
   api-bootstrap.js so it can reuse getProductById(),
   getRelatedProducts(), renderProductCard(), $, $$, money().
   ============================================================ */
(function () {
  "use strict";
  const root = $("#productRoot");
  if (!root) return; // not on product.html

  const relatedGrid = $("#relatedGrid");
  const crumb = $("#pdBreadcrumbName");

  function render() {
    const id = new URLSearchParams(window.location.search).get("id");
    const p = getProductById(id);

    if (!p) {
      // An empty PRODUCTS array just means we're still waiting on the
      // API response — only show "not found" once real data has loaded.
      if (window.PRODUCTS && window.PRODUCTS.length) {
        root.innerHTML = `
          <div style="text-align:center; padding:60px 20px;">
            <h2>Product not found</h2>
            <p style="color:var(--ink-500); margin:12px 0 24px;">This piece may have sold out or been removed.</p>
            <a href="shop.html" class="btn">Back to Shop</a>
          </div>`;
        if (crumb) crumb.textContent = "Not found";
      }
      return;
    }

    const discount =
      p.originalPrice > p.price
        ? Math.round((1 - p.price / p.originalPrice) * 100)
        : 0;
    const gallery = p.gallery && p.gallery.length ? p.gallery : [p.image];

    if (crumb) crumb.textContent = p.name;
    document.title = p.name + " — PE_ORIGINALS";

    root.innerHTML = `
      <div class="product-detail-grid">
        <div class="gallery">
          <div class="gallery-thumbs" id="galleryThumbs">
            ${gallery
              .map(
                (img, i) => `
              <button type="button" class="gallery-thumb${i === 0 ? " active" : ""}" data-img="${img}">
                <img src="${img}" alt="${p.name} — photo ${i + 1}">
              </button>`,
              )
              .join("")}
          </div>
          <div class="gallery-main">
            ${p.badge ? `<span class="badge badge-${p.badge}">${p.badge === "sale" ? `-${discount}%` : p.badge}</span>` : ""}
            <img id="galleryMainImg" src="${gallery[0]}" alt="${p.name}"
                 onerror="this.src='https://picsum.photos/seed/peo-fallback/600/800'">
          </div>
        </div>
        <div class="pd-info">
          <div class="pd-brand">${p.brand}</div>
          <h1 class="pd-title">${p.name}</h1>
          <div class="pd-rating">
            <span class="stars">${"★".repeat(Math.round(p.rating))}${"☆".repeat(5 - Math.round(p.rating))}</span>
            <span>${p.rating} (${p.reviews} reviews)</span>
          </div>
          <div class="pd-price-row">
            <span class="pd-price">${money(p.price)}</span>
            ${p.originalPrice > p.price ? `<span class="pd-price-old">${money(p.originalPrice)}</span><span class="pd-save-badge">Save ${discount}%</span>` : ""}
          </div>
          ${p.condition ? `<div class="pd-condition">Condition: <strong>${p.condition}</strong></div>` : ""}
          ${p.description ? `<p class="pd-desc">${p.description}</p>` : ""}
          <div class="size-selector">
            <div class="size-selector-label"><span>Select Size</span></div>
            <div class="size-options" id="sizeOptions">
              ${p.sizes
                .map(
                  (s) => `
                <button type="button" class="size-option${(p.soldSizes || []).includes(s) ? " disabled" : ""}" data-size="${s}">${s}</button>`,
                )
                .join("")}
            </div>
            <div class="size-error" id="sizeError">Please select a size</div>
          </div>
          <div class="pd-actions">
            <button class="btn btn-block" data-add-to-cart="${p.id}">Add to Bag</button>
            <button class="pd-wish-btn" data-wishlist aria-label="Add to wishlist">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7.5-4.7-10-9.3C.5 8 2.6 4.5 6.2 4.5c2.2 0 3.9 1.2 4.8 3 0.9-1.8 2.6-3 4.8-3 3.6 0 5.7 3.5 4.2 7.2C19.5 16.3 12 21 12 21z"/></svg>
            </button>
          </div>
          <div class="pd-meta">
            <span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 17h18M5 17V9a4 4 0 014-4h6a4 4 0 014 4v8"/><circle cx="8" cy="20" r="2"/><circle cx="16" cy="20" r="2"/></svg>
              Free shipping over ${money((window.PEO_SETTINGS && window.PEO_SETTINGS.shipping.freeShipThreshold) || 550000)}
            </span>
            <span><strong>Authenticity guaranteed</strong> — every piece is checked before it ships</span>
          </div>
        </div>
      </div>`;

    // Gallery thumb swap
    $$(".gallery-thumb", root).forEach((thumb) => {
      thumb.addEventListener("click", () => {
        $$(".gallery-thumb", root).forEach((t) => t.classList.remove("active"));
        thumb.classList.add("active");
        const mainImg = $("#galleryMainImg");
        if (mainImg) mainImg.src = thumb.dataset.img;
      });
    });

    // Related products
    if (relatedGrid) {
      const related =
        typeof getRelatedProducts === "function" ? getRelatedProducts(p, 3) : [];
      relatedGrid.innerHTML = related
        .map((rp, i) => renderProductCard(rp, { delay: (i % 4) + 1 }))
        .join("");
    }

    if (window.PEAnim && typeof window.PEAnim.refreshReveals === "function") {
      window.PEAnim.refreshReveals();
    }
  }

  render();
  document.addEventListener("peo:products", render);
})();
